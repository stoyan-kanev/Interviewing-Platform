import {
    AfterViewInit,
    Component,
    ElementRef,
    OnInit,
    ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {WebSocketService} from '../services/websocket';
import {NgClass} from '@angular/common';

@Component({
    selector: 'app-live-interview',
    templateUrl: './live-interview.html',
    styleUrls: ['./live-interview.css'],
    imports: [
        NgClass,
    ]
})
export class LiveInterviewComponent implements OnInit, AfterViewInit {
    @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

    micEnabled = true;
    cameraEnabled = true;
    remoteMicEnabled = true;

    private peer!: RTCPeerConnection;
    private localStream!: MediaStream;
    private remoteStream!: MediaStream;
    private roomId!: string;
    candidateName = '';

    constructor(
        private route: ActivatedRoute,
        private ws: WebSocketService
    ) {}

    async ngOnInit(): Promise<void> {
        this.roomId = this.route.snapshot.paramMap.get('room_id')!;
        this.candidateName = localStorage.getItem('candidate_name') || 'Анонимен';
        this.ws.connect(this.roomId);
        this.setupWebSocketListeners();
    }

    async ngAfterViewInit() {
        await this.initCamera();
        this.createPeerConnection();
    }

    async initCamera() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            this.localVideoRef.nativeElement.srcObject = this.localStream;
        } catch (error) {
            console.error('❌ Грешка при стартиране на камерата:', error);
        }
    }

    createPeerConnection() {
        this.peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        this.localStream.getTracks().forEach((track) => {
            this.peer.addTrack(track, this.localStream);
        });

        this.remoteStream = new MediaStream();
        this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;

        this.peer.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                this.remoteStream.addTrack(track);
            });
        };

        this.peer.onicecandidate = (event) => {
            if (event.candidate) {
                this.ws.sendIceCandidate(this.roomId, event.candidate);
            }
        };
    }

    setupWebSocketListeners() {
        this.ws.onUserJoined().subscribe(async () => {
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);
            this.ws.sendOffer(this.roomId, offer);
        });

        this.ws.onOffer().subscribe(async (offer) => {
            await this.peer.setRemoteDescription(offer);
            const answer = await this.peer.createAnswer();
            await this.peer.setLocalDescription(answer);
            this.ws.sendAnswer(this.roomId, answer);
        });

        this.ws.onAnswer().subscribe(async (answer) => {
            await this.peer.setRemoteDescription(answer);
        });

        this.ws.onIceCandidate().subscribe(async (candidate) => {
            try {
                await this.peer.addIceCandidate(candidate);
            } catch (err) {
                console.error('❌ Error adding ICE candidate', err);
            }
        });
    }

    toggleMic() {
        if (!this.localStream) return;
        this.micEnabled = !this.micEnabled;
        this.localStream.getAudioTracks().forEach((track) => {
            track.enabled = this.micEnabled;
        });
    }

    toggleCamera() {
        if (!this.localStream) return;
        this.cameraEnabled = !this.cameraEnabled;
        this.localStream.getVideoTracks().forEach((track) => {
            track.enabled = this.cameraEnabled;
        });
    }

    leaveCall() {
        this.peer?.close();
        this.localStream?.getTracks().forEach((track) => track.stop());
        window.location.href = '/';
    }
}
