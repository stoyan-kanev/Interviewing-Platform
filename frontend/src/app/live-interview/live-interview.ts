import { Component, ElementRef, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WebSocketService } from '../services/websocket';
import { NgClass, NgIf } from '@angular/common';

@Component({
    selector: 'app-live-interview',
    templateUrl: './live-interview.html',
    styleUrls: ['./live-interview.css'],
    standalone: true,
    imports: [NgClass, NgIf],
})
export class LiveInterviewComponent implements OnInit, AfterViewInit {
    @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

    micEnabled = true;
    cameraEnabled = true;

    role: 'host' | 'guest' = 'guest';
    isHost = false;
    candidateName = '';

    showUnmuteCTA = false;

    debugInfo = {
        localTracks: 0,
        remoteTracks: 0,
        connectionState: 'new',
        iceConnectionState: 'new',
        signalingState: 'stable'
    };

    private canNegotiate = false;
    private makingOffer = false;
    private polite = false;
    private lastOfferAt = 0;
    private static readonly OFFER_COOLDOWN_MS = 1500;

    private peer!: RTCPeerConnection;

    private localStream: MediaStream = new MediaStream();
    private remoteStream!: MediaStream;
    private roomId!: string;

    private pendingIce: RTCIceCandidateInit[] = [];
    private remoteDescSet = false;

    private localTracksAttached = false;
    private renegotiateRequested = false;

    private viewReady!: Promise<void>;
    private resolveViewReady!: () => void;

    private roleReady!: Promise<void>;
    private resolveRoleReady!: () => void;

    private mediaReady!: Promise<void>;
    private resolveMediaReady!: () => void;

    private initialNegotiationDone = false;

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
        });

        this.ws.joinRoom(this.roomId, desiredRole);

        await this.viewReady;
        await this.roleReady;
        await this.initCamera();

        this.createPeerConnection();
        this.setupWebSocketListeners();

        await this.ensureLocalTracksAttached();

        console.log('✅ Sending ready signal as:', this.isHost ? 'host' : 'guest');
        this.ws.sendReady(this.roomId, this.isHost ? 'host' : 'guest');
    }

    ngAfterViewInit(): void {
        this.resolveViewReady();
        console.log('👁️ View ready');
    }

    private async fetchRoom(roomUuid: string): Promise<any> {
        const res = await fetch(`http://10.70.71.111:8000/interview-rooms/public/${roomUuid}/`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error('room not ok');
        return await res.json();
    }

    private async fetchMeOrNull(): Promise<any | null> {
        const res = await fetch('http://10.70.71.111:8000/auth/me/', { credentials: 'include' });
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

        this.addLocalTracksImmediate();

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

            // Премахваме стари tracks от същия тип преди да добавим новия
            const existingTracks = this.remoteStream.getTracks().filter(t => t.kind === e.track.kind);
            existingTracks.forEach(t => {
                this.remoteStream.removeTrack(t);
                console.log('🗑️ Removed old remote track:', t.kind, t.id);
            });

            this.remoteStream.addTrack(e.track);
            this.updateDebugInfo();

            // Force video element to update
            const rv = this.remoteVideoRef.nativeElement;
            rv.srcObject = this.remoteStream;
            setTimeout(() => rv.play().catch(console.error), 100);

            this.handleRemoteTrackAdded();
        };

        this.peer.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('❄️ Sending ICE candidate:', e.candidate.candidate);
                this.ws.sendIceCandidate(this.roomId, e.candidate);
            }
        };

        this.peer.onnegotiationneeded = async () => {
            console.log('🛎️ onnegotiationneeded fired, canNegotiate:', this.canNegotiate);
            if (this.canNegotiate && this.isHost && !this.makingOffer) {
                await this.createAndSendOffer();
            }
        };

        this.peer.onconnectionstatechange = () => {
            const st = this.peer.connectionState;
            console.log('🧭 connectionState changed to:', st);
            this.debugInfo.connectionState = st;

            if (st === 'connected') {
                this.initialNegotiationDone = true;
                console.log('🎉 WebRTC connection established!');
                this.logPeerConnectionState();
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
    }

    private addLocalTracksImmediate(): void {
        if (!this.localStream) return;

        const videoTrack = this.localStream.getVideoTracks()[0];
        const audioTrack = this.localStream.getAudioTracks()[0];

        console.log('🔗 Adding tracks immediately:', {
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

        this.localTracksAttached = true;
    }

    private async handleRemoteTrackAdded(): Promise<void> {
        if (this.isHost && !this.initialNegotiationDone && this.canNegotiate) {
            setTimeout(async () => {
                if (!this.makingOffer && this.peer.signalingState === 'stable') {
                    console.log('🔄 Host renegotiating after receiving remote tracks');
                    await this.createAndSendOffer();
                }
            }, 500);
        }
    }

    private async createAndSendOffer(): Promise<void> {
        if (!this.peer || this.makingOffer) return;

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

            if (this.initialNegotiationDone && this.peer?.connectionState === 'connected') {
                console.log('🛑 startNegotiation ignored: already connected');
                return;
            }

            this.canNegotiate = true;
            console.log('✅ Can now negotiate');

            if (!this.isHost || !this.peer) {
                console.log('🚫 Not host or no peer, skipping offer creation');
                return;
            }

            await this.createAndSendOffer();
        });

        this.ws.onOffer().subscribe(async (offer) => {
            console.log('📦 Offer received:', offer);

            if (!this.peer) {
                console.warn('❌ Offer received before peer created');
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

                // Добавяне на pending ICE candidates
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

            if (!this.peer) {
                console.warn('❌ Answer received before peer created');
                return;
            }

            try {
                console.log('✅ Processing answer...');
                await this.peer.setRemoteDescription(answer);
                this.remoteDescSet = true;
                console.log('✅ Remote description set (answer)');

                if (!this.initialNegotiationDone) {
                    this.initialNegotiationDone = true;
                }

                // Добавяне на pending ICE candidates
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

            if (!this.peer) {
                console.warn('❌ ICE received before peer created');
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

    private async ensureLocalTracksAttached(): Promise<void> {
        await this.mediaReady.catch(() => {});
        console.log('✅ Local tracks already attached');
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

    // UI controls
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
        this.peer?.close();
        this.localStream?.getTracks().forEach((t) => t.stop());
        this.ws.disconnect();
        window.location.href = '/';
    }

    diagnoseConnection(): void {
        console.log('🔍 Full Connection Diagnosis:');
        console.log('Role:', this.role, 'IsHost:', this.isHost);
        console.log('Room ID:', this.roomId);
        console.log('Local stream tracks:', this.localStream?.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState
        })));
        console.log('Remote stream tracks:', this.remoteStream?.getTracks().map(t => ({
            kind: t.kind,
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState
        })));

        if (this.peer) {
            console.log('Peer connection state:', this.peer.connectionState);
            console.log('ICE connection state:', this.peer.iceConnectionState);
            console.log('Signaling state:', this.peer.signalingState);
            console.log('ICE gathering state:', this.peer.iceGatheringState);

            // Проверете какво изпращат transceivers
            this.peer.getTransceivers().forEach((transceiver, index) => {
                console.log(`Transceiver ${index}:`, {
                    direction: transceiver.direction,
                    currentDirection: transceiver.currentDirection,
                    mid: transceiver.mid,
                    senderTrack: transceiver.sender.track ? {
                        kind: transceiver.sender.track.kind,
                        id: transceiver.sender.track.id,
                        enabled: transceiver.sender.track.enabled
                    } : null,
                    receiverTrack: transceiver.receiver.track ? {
                        kind: transceiver.receiver.track.kind,
                        id: transceiver.receiver.track.id,
                        enabled: transceiver.receiver.track.enabled
                    } : null
                });
            });
        }
    }

    showDebugInfo(): void {
        console.log('🔍 Debug Info:', this.debugInfo);
        this.logPeerConnectionState();
    }
}
