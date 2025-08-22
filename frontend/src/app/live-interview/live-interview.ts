import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WebSocketService } from '../services/websocket';
import { NgClass, NgIf } from '@angular/common';
import {SharedCodeEditorComponent} from '../code-editor/code-editor';

@Component({
    selector: 'app-live-interview',
    template: `
<div class="interview-container">
    <!-- Debug Info (optional) -->
<!--    <div class="debug-info" style="position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-size: 12px; z-index: 1000;">-->
<!--        <div>Role: {{role}}</div>-->
<!--        <div>Local Tracks: {{debugInfo.localTracks}}</div>-->
<!--        <div>Remote Tracks: {{debugInfo.remoteTracks}}</div>-->
<!--        <div>Connection: {{debugInfo.connectionState}}</div>-->
<!--        <div>ICE: {{debugInfo.iceConnectionState}}</div>-->
<!--        <button (click)="showDebugInfo()">Log State</button>-->
<!--        <button *ngIf="showUnmuteCTA" class="unmute-cta" (click)="unmuteRemote()">Tap to unmute 🔊</button>-->
<!--    </div>-->

    <!-- Main Content with Toggle -->
    <div class="main-content" [class.split-view]="showCodeEditor">


        <!-- Video Section (your working code) -->
        <div class="video-section" [class.collapsed]="showCodeEditor">
            <div class="video-wrapper">
                <div class="videos">
                    <!-- HOST VIEW -->
                    <ng-container *ngIf="role === 'host'; else guestTemplate">
                        <div class="my-cam-warper">
                            <video #localVideo autoplay muted playsinline></video>
                            <div class="participant-name">{{ candidateName }} (Вие)</div>
                            <div class="status-indicator">
                                🟢 Онлайн
                                <span *ngIf="!micEnabled">🔇 Без звук</span>
                            </div>
                            <div class="controls">
                                <button (click)="toggleMic()">
                                    <i class="fas" [ngClass]="micEnabled ? 'fa-microphone' : 'fa-microphone-slash'"></i>
                                </button>
                                <button (click)="toggleCamera()">
                                    <i class="fas" [ngClass]="cameraEnabled ? 'fa-video' : 'fa-video-slash'"></i>
                                </button>
                            </div>
                        </div>

                        <div class="remote-cam">
                            <video #remoteVideo autoplay playsinline></video>
                            <div class="participant-name">Събеседник</div>
                            <div class="status-indicator">🟢 Онлайн</div>
                        </div>
                    </ng-container>

                    <!-- GUEST VIEW -->
                    <ng-template #guestTemplate>
                        <div class="remote-cam">
                            <video #remoteVideo autoplay playsinline></video>
                            <div class="participant-name">Интервюиращ</div>
                            <div class="status-indicator">🟢 Онлайн</div>
                        </div>

                        <div class="my-cam-warper">
                            <video #localVideo autoplay muted playsinline></video>
                            <div class="participant-name">{{ candidateName }} (Вие)</div>
                            <div class="status-indicator">
                                🟢 Онлайн
                                <span *ngIf="!micEnabled">🔇 Без звук</span>
                            </div>
                            <div class="controls">
                                <button (click)="toggleMic()">
                                    <i class="fas" [ngClass]="micEnabled ? 'fa-microphone' : 'fa-microphone-slash'"></i>
                                </button>
                                <button (click)="toggleCamera()">
                                    <i class="fas" [ngClass]="cameraEnabled ? 'fa-video' : 'fa-video-slash'"></i>
                                </button>
                            </div>
                        </div>
                    </ng-template>
                </div>

                <!-- Control buttons -->
                <div class="interview-controls">
                    <button (click)="toggleCodeEditor()" class="toggle-editor-btn">
                        {{ showCodeEditor ? '📹 Show Video Only' : '💻 Show Code Editor' }}
                    </button>

                    <button (click)="leaveCall()" class="leave-call-btn">
                        ⛔ Напусни срещата
                    </button>
                </div>
            </div>
        </div>

        <!-- Code Editor Section -->
        <div class="code-editor-section" *ngIf="showCodeEditor">
            <app-shared-code-editor
                [roomId]="roomId"
                [userId]="currentUserId"
                [userName]="candidateName"
                [isHost]="isHost">
            </app-shared-code-editor>
        </div>

    </div>
</div>
    `,
    styleUrls: ['./live-interview.css'],
    standalone: true,
    imports: [NgClass, NgIf, SharedCodeEditorComponent],
})
export class LiveInterviewComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

    micEnabled = true;
    cameraEnabled = true;

    role: 'host' | 'guest' = 'guest';
    isHost = false;
    candidateName = '';

    // NEW: Code editor toggle
    showCodeEditor = false;

    showUnmuteCTA = false;

    // Debug info
    debugInfo = {
        localTracks: 0,
        remoteTracks: 0,
        connectionState: 'new',
        iceConnectionState: 'new',
        signalingState: 'stable'
    };

    // Negotiation guards
    private canNegotiate = false;
    private makingOffer = false;
    private polite = false;
    private lastOfferAt = 0;
    private static readonly OFFER_COOLDOWN_MS = 1500;

    // WebRTC
    private peer!: RTCPeerConnection;
    private localStream: MediaStream = new MediaStream();
    private remoteStream!: MediaStream;
    roomId!: string;

    private pendingIce: RTCIceCandidateInit[] = [];
    private remoteDescSet = false;

    // State flags
    private mediaInitialized = false;
    private peerConnectionReady = false;
    private negotiationPending = false;
    private connectionEstablished = false;
    private isDestroyed = false;

    // Orchestration promises
    private viewReady!: Promise<void>;
    private resolveViewReady!: () => void;

    private roleReady!: Promise<void>;
    private resolveRoleReady!: () => void;

    private mediaReady!: Promise<void>;
    private resolveMediaReady!: () => void;

    constructor(
        private route: ActivatedRoute,
        private ws: WebSocketService
    ) {
        this.viewReady = new Promise<void>(res => (this.resolveViewReady = res));
        this.roleReady = new Promise<void>(res => (this.resolveRoleReady = res));
        this.mediaReady = new Promise<void>(res => (this.resolveMediaReady = res));
    }

    async ngOnInit(): Promise<void> {
        this.roomId = this.route.snapshot.paramMap.get('room_id')!;
        this.candidateName = localStorage.getItem('candidate_name') || 'Анонимен';

        console.log('🏠 Room ID:', this.roomId);
        console.log('👤 Candidate Name:', this.candidateName);

        const room = await this.fetchRoom(this.roomId).catch(() => null);
        const me = await this.fetchMeOrNull().catch(() => null);

        console.log('🏢 Room data:', room);
        console.log('👤 User data:', me);

        const desiredRole: 'host' | 'guest' =
            me && room && me.id === room.owner ? 'host' : 'guest';

        console.log('🎯 Desired role:', desiredRole);

        this.ws.connect();

        this.ws.onRoleAssigned().subscribe(async (role) => {
            console.log('🎯 Final assigned role:', role);
            this.role = role;
            this.isHost = role === 'host';
            this.polite = role === 'guest';
            this.resolveRoleReady();
        });

        this.ws.onUserJoined().subscribe((data: any) => {
            console.log('👋 User joined:', data);
            setTimeout(() => {
                this.attemptNegotiation();
            }, 1000);
        });

        this.ws.onResetConnection().subscribe(() => {
            console.log('🔄 Reset connection signal received');
            this.resetConnection();
        });

        this.ws.joinRoom(this.roomId, desiredRole);

        await this.viewReady;
        await this.roleReady;
        await this.initCamera();

        this.createPeerConnection();
        this.setupWebSocketListeners();

        console.log('✅ Sending ready signal as:', this.isHost ? 'host' : 'guest');
        this.ws.sendReady(this.roomId, this.isHost ? 'host' : 'guest');
    }

    ngAfterViewInit(): void {
        this.resolveViewReady();
        console.log('👁️ View ready');
    }

    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.cleanup();
    }

    private cleanup(): void {
        console.log('🧹 Cleaning up component');

        if (this.peer) {
            this.peer.close();
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        this.ws.disconnect();
    }

    private resetConnection(): void {
        console.log('🔄 Resetting WebRTC connection');

        this.canNegotiate = false;
        this.connectionEstablished = false;
        this.remoteDescSet = false;
        this.pendingIce = [];

        if (this.peer) {
            this.peer.close();
        }

        setTimeout(() => {
            if (!this.isDestroyed) {
                this.createPeerConnection();
                this.addLocalTracksWhenReady();
            }
        }, 500);
    }

    private async fetchRoom(roomUuid: string): Promise<any> {
        const res = await fetch(`http://localhost:8000/interview-rooms/public/${roomUuid}/`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error('room not ok');
        return await res.json();
    }

    private async fetchMeOrNull(): Promise<any | null> {
        const res = await fetch('http://localhost:8000/auth/me/', { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
    }

    private async initCamera(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 },
                audio: true
            });
            this.localStream = stream;

            console.log('🎙️ Media acquired:', {
                audio: this.localStream.getAudioTracks().length,
                video: this.localStream.getVideoTracks().length,
                audioTrackId: this.localStream.getAudioTracks()[0]?.id,
                videoTrackId: this.localStream.getVideoTracks()[0]?.id
            });

            const lv = this.localVideoRef.nativeElement;
            lv.srcObject = this.localStream;
            lv.muted = true;
            lv.autoplay = true;
            lv.playsInline = true;
            setTimeout(() => lv.play().catch(console.error), 0);

            this.mediaInitialized = true;
            this.updateDebugInfo();
            this.resolveMediaReady?.();
        } catch (err) {
            console.warn('⚠️ Камера/микрофон отказани – receive-only:', err);
            this.localStream = new MediaStream();
            const lv = this.localVideoRef.nativeElement;
            lv.srcObject = this.localStream;
            lv.muted = true;
            lv.autoplay = true;
            lv.playsInline = true;
            setTimeout(() => lv.play().catch(console.error), 0);
            this.mediaInitialized = true;
            this.resolveMediaReady?.();
        }
    }

    private createPeerConnection(): void {
        this.peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
            ],
        });

        console.log('🔗 Peer connection created');

        this.remoteStream = new MediaStream();
        const rv = this.remoteVideoRef.nativeElement;
        rv.srcObject = this.remoteStream;
        rv.muted = false;
        rv.autoplay = true;
        rv.playsInline = true;
        setTimeout(() => rv.play().catch(() => { this.showUnmuteCTA = true; }), 0);

        this.peer.ontrack = (e) => {
            console.log('🎥 Track received:', {
                kind: e.track.kind,
                id: e.track.id,
                label: e.track.label,
                enabled: e.track.enabled,
                readyState: e.track.readyState,
                streams: e.streams.map(s => s.id)
            });

            const existingTracks = this.remoteStream.getTracks().filter(t => t.kind === e.track.kind);
            existingTracks.forEach(t => {
                this.remoteStream.removeTrack(t);
                console.log('🗑️ Removed old remote track:', t.kind, t.id);
            });

            this.remoteStream.addTrack(e.track);
            this.updateDebugInfo();

            const rv = this.remoteVideoRef.nativeElement;
            rv.srcObject = this.remoteStream;
            setTimeout(() => rv.play().catch(console.error), 100);
        };

        this.peer.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('❄️ Sending ICE candidate:', e.candidate.candidate);
                this.ws.sendIceCandidate(this.roomId, e.candidate);
            }
        };

        this.peer.onnegotiationneeded = () => {
            console.log('🛎️ onnegotiationneeded fired - scheduling negotiation');
            this.scheduleNegotiation();
        };

        this.peer.onconnectionstatechange = () => {
            const st = this.peer.connectionState;
            console.log('🧭 connectionState changed to:', st);
            this.debugInfo.connectionState = st;

            if (st === 'connected' && !this.connectionEstablished) {
                this.connectionEstablished = true;
                console.log('🎉 WebRTC connection established!');
                this.ws.sendConnectionEstablished(this.roomId);
                this.logPeerConnectionState();
            } else if (st === 'disconnected' || st === 'failed') {
                console.log('❌ Connection lost, attempting reset');
                this.connectionEstablished = false;
                setTimeout(() => {
                    if (!this.isDestroyed) {
                        this.resetConnection();
                    }
                }, 2000);
            }
        };

        this.peer.oniceconnectionstatechange = () => {
            console.log('❄️ iceConnectionState:', this.peer.iceConnectionState);
            this.debugInfo.iceConnectionState = this.peer.iceConnectionState;
        };

        this.peer.onsignalingstatechange = () => {
            console.log('📡 signalingState:', this.peer.signalingState);
            this.debugInfo.signalingState = this.peer.signalingState;
        };

        this.peer.onicegatheringstatechange = () => {
            console.log('📦 iceGatheringState:', this.peer.iceGatheringState);
        };

        this.peerConnectionReady = true;
        console.log('✅ Peer connection fully ready');

        this.addLocalTracksWhenReady();
    }

    private async addLocalTracksWhenReady(): Promise<void> {
        await this.mediaReady;

        if (!this.mediaInitialized || !this.peerConnectionReady || !this.peer) {
            console.log('⏳ Waiting for media or peer connection...');
            setTimeout(() => this.addLocalTracksWhenReady(), 100);
            return;
        }

        const videoTrack = this.localStream.getVideoTracks()[0];
        const audioTrack = this.localStream.getAudioTracks()[0];

        console.log('🔗 Adding tracks when ready:', {
            video: !!videoTrack,
            audio: !!audioTrack,
            videoId: videoTrack?.id,
            audioId: audioTrack?.id
        });

        if (videoTrack) {
            this.peer.addTrack(videoTrack, this.localStream);
            console.log('📹 Video track added');
        }

        if (audioTrack) {
            this.peer.addTrack(audioTrack, this.localStream);
            console.log('🎙️ Audio track added');
        }

        console.log('✅ All local tracks added, ready for negotiation');
    }

    private scheduleNegotiation(): void {
        if (this.negotiationPending) {
            console.log('⏳ Negotiation already pending');
            return;
        }

        this.negotiationPending = true;

        setTimeout(() => {
            this.negotiationPending = false;
            this.attemptNegotiation();
        }, 500);
    }

    private async attemptNegotiation(): Promise<void> {
        if (!this.peer || this.isDestroyed) {
            console.log('🚫 No peer connection or component destroyed');
            return;
        }

        if (this.connectionEstablished && this.peer.connectionState === 'connected') {
            console.log('🛑 Already connected, skipping negotiation');
            return;
        }

        if (!this.canNegotiate && !this.isHost) {
            console.log('🔄 Guest requesting renegotiation from host');
            this.ws.sendNeedRenegotiate(this.roomId);
            return;
        }

        if (!this.canNegotiate || !this.isHost || this.makingOffer) {
            console.log('🚫 Cannot negotiate now:', {
                canNegotiate: this.canNegotiate,
                isHost: this.isHost,
                makingOffer: this.makingOffer
            });
            return;
        }

        await this.createAndSendOffer();
    }

    private async createAndSendOffer(): Promise<void> {
        if (!this.peer || this.makingOffer || this.isDestroyed) return;

        const now = Date.now();
        if (now - this.lastOfferAt < LiveInterviewComponent.OFFER_COOLDOWN_MS) {
            console.log('🚫 Offer cooldown active');
            return;
        }

        try {
            this.makingOffer = true;
            console.log('🚦 Creating offer...');

            this.logPeerConnectionState();

            const offer = await this.peer.createOffer();
            console.log('📝 Offer created:', offer);

            await this.peer.setLocalDescription(offer);
            console.log('✅ Local description set');

            this.ws.sendOffer(this.roomId, offer);
            this.lastOfferAt = Date.now();
            console.log('📤 Offer sent to room');
        } catch (e) {
            console.error('❌ createAndSendOffer error', e);
        } finally {
            this.makingOffer = false;
        }
    }

    private setupWebSocketListeners(): void {
        this.ws.onStartNegotiation().subscribe(async () => {
            console.log('🚦 startNegotiation received');

            if (this.connectionEstablished && this.peer?.connectionState === 'connected') {
                console.log('🛑 startNegotiation ignored: already connected');
                return;
            }

            this.canNegotiate = true;
            console.log('✅ Can now negotiate');

            setTimeout(() => {
                this.attemptNegotiation();
            }, 200);
        });

        this.ws.onOffer().subscribe(async (offer) => {
            console.log('📦 Offer received:', offer);

            if (!this.peer || this.isDestroyed) {
                console.warn('❌ Offer received before peer created or after destroy');
                return;
            }

            const isStable = this.peer.signalingState === 'stable';
            if (!this.polite && (!isStable || this.makingOffer)) {
                console.warn('🚫 Ignoring glare offer (impolite side)');
                return;
            }

            try {
                console.log('✅ Processing offer...');
                await this.peer.setRemoteDescription(offer);
                this.remoteDescSet = true;
                console.log('✅ Remote description set');

                console.log('📝 Creating answer...');
                const answer = await this.peer.createAnswer();
                console.log('📝 Answer created:', answer);

                await this.peer.setLocalDescription(answer);
                console.log('✅ Local description set (answer)');

                this.ws.sendAnswer(this.roomId, answer);
                console.log('📤 Answer sent');

                console.log('🔄 Processing', this.pendingIce.length, 'pending ICE candidates');
                for (const c of this.pendingIce) {
                    try {
                        await this.peer.addIceCandidate(c);
                    } catch (e) {
                        console.error('❌ pending ICE error:', e);
                    }
                }
                this.pendingIce = [];
            } catch (e) {
                console.error('❌ onOffer error', e);
            }
        });

        this.ws.onAnswer().subscribe(async (answer) => {
            console.log('📦 Answer received:', answer);

            if (!this.peer || this.isDestroyed) {
                console.warn('❌ Answer received before peer created or after destroy');
                return;
            }

            try {
                console.log('✅ Processing answer...');
                await this.peer.setRemoteDescription(answer);
                this.remoteDescSet = true;
                console.log('✅ Remote description set (answer)');

                console.log('🔄 Processing', this.pendingIce.length, 'pending ICE candidates');
                for (const c of this.pendingIce) {
                    try {
                        await this.peer.addIceCandidate(c);
                    } catch (e) {
                        console.error('❌ pending ICE error:', e);
                    }
                }
                this.pendingIce = [];
            } catch (e) {
                console.error('❌ onAnswer error', e);
            }
        });

        this.ws.onIceCandidate().subscribe(async (candidate) => {
            console.log('❄️ ICE candidate received:', candidate);

            if (!this.peer || this.isDestroyed) {
                console.warn('❌ ICE received before peer created or after destroy');
                return;
            }

            if (!this.remoteDescSet) {
                this.pendingIce.push(candidate);
                console.log('📦 ICE candidate queued (no remote desc yet), total queued:', this.pendingIce.length);
                return;
            }

            try {
                await this.peer.addIceCandidate(candidate);
                console.log('✅ ICE candidate added');
            }
            catch (err) {
                console.error('❌ addIceCandidate error', err);
            }
        });
    }

    private updateDebugInfo(): void {
        this.debugInfo.localTracks = this.localStream?.getTracks().length || 0;
        this.debugInfo.remoteTracks = this.remoteStream?.getTracks().length || 0;

        if (this.peer) {
            this.debugInfo.connectionState = this.peer.connectionState;
            this.debugInfo.iceConnectionState = this.peer.iceConnectionState;
            this.debugInfo.signalingState = this.peer.signalingState;
        }
    }

    private logPeerConnectionState(): void {
        if (!this.peer) return;

        console.log('🔍 Peer Connection State:', {
            connectionState: this.peer.connectionState,
            signalingState: this.peer.signalingState,
            iceConnectionState: this.peer.iceConnectionState,
            iceGatheringState: this.peer.iceGatheringState,
            localTracks: this.localStream?.getTracks().length || 0,
            remoteTracks: this.remoteStream?.getTracks().length || 0,
            transceivers: this.peer.getTransceivers().map(t => ({
                direction: t.direction,
                currentDirection: t.currentDirection,
                mid: t.mid,
                sender: {
                    track: t.sender.track ? {
                        kind: t.sender.track.kind,
                        id: t.sender.track.id,
                        enabled: t.sender.track.enabled
                    } : null
                },
                receiver: {
                    track: t.receiver.track ? {
                        kind: t.receiver.track.kind,
                        id: t.receiver.track.id,
                        enabled: t.receiver.track.enabled
                    } : null
                }
            }))
        });
    }

    // ============ UI CONTROLS (your working methods) ============

    unmuteRemote() {
        const rv = this.remoteVideoRef.nativeElement;
        rv.muted = false;
        rv.play().catch(console.error);
        this.showUnmuteCTA = false;
    }

    toggleMic(): void {
        this.micEnabled = !this.micEnabled;
        this.localStream.getAudioTracks().forEach((t) => (t.enabled = this.micEnabled));
        console.log('🎙️ Mic', this.micEnabled ? 'enabled' : 'disabled');
    }

    toggleCamera(): void {
        this.cameraEnabled = !this.cameraEnabled;
        this.localStream.getVideoTracks().forEach((t) => (t.enabled = this.cameraEnabled));
        console.log('📹 Camera', this.cameraEnabled ? 'enabled' : 'disabled');
    }

    leaveCall(): void {
        console.log('👋 Leaving call...');
        this.cleanup();
        window.location.href = '/';
    }

    // ============ NEW: CODE EDITOR CONTROLS ============

    toggleCodeEditor(): void {
        this.showCodeEditor = !this.showCodeEditor;
        console.log('💻 Code editor toggled:', this.showCodeEditor ? 'shown' : 'hidden');
    }

    get currentUserId(): string {
        let userId = localStorage.getItem('interview_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('interview_user_id', userId);
        }
        return userId;
    }

    // ============ DEBUG METHODS ============

    manualRetry(): void {
        console.log('🔄 Manual retry triggered');
        this.resetConnection();
    }

    diagnoseConnection(): void {
        console.log('🔍 Full Connection Diagnosis:');
        console.log('Role:', this.role, 'IsHost:', this.isHost);
        console.log('Room ID:', this.roomId);
        console.log('Connection established:', this.connectionEstablished);
        console.log('Can negotiate:', this.canNegotiate);
        this.logPeerConnectionState();
    }

    showDebugInfo(): void {
        console.log('🔍 Debug Info:', this.debugInfo);
        this.logPeerConnectionState();
    }
}
