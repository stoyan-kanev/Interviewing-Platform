import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
    private socket!: Socket;

    connect(): void {
        const SERVER_URL = this.getServerUrl();

        this.socket = io(SERVER_URL);
        this.socket.on('connect', () => {
            console.log('✅ Connected to WebSocket server, socket ID:', this.socket.id);
            console.log('🌐 Server URL:', SERVER_URL);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from WebSocket server');
        });

        this.socket.on('connect_error', (error) => {
            console.error('🚫 Connection error:', error);
            console.error('🌐 Tried to connect to:', SERVER_URL);
        });
    }

    private getServerUrl(): string {
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8001';
        }

        return `http://${hostname}:8001`;
    }

    disconnect(): void {
        if (this.socket) {
            console.log('👋 Manually disconnecting from WebSocket');
            this.socket.disconnect();
        }
    }

    // Room management
    joinRoom(roomId: string, role: 'host' | 'guest') {
        console.log('🚪 Joining room:', roomId, 'as:', role);
        this.socket.emit('joinRoom', { roomId, role });
    }

    onRoleAssigned(): Observable<'host' | 'guest'> {
        return new Observable((observer) => {
            this.socket.on('roleAssigned', (role: 'host' | 'guest') => {
                console.log('📥 Role assigned:', role);
                observer.next(role);
            });
        });
    }

    sendReady(roomId: string, role: 'host' | 'guest') {
        console.log('✅ Sending ready signal for room:', roomId, 'as:', role);
        this.socket.emit('ready', { roomId, role });
    }

    // Negotiation management
    sendNeedRenegotiate(roomId: string) {
        console.log('🔄 Requesting renegotiation for room:', roomId);
        this.socket.emit('needRenegotiate', { roomId });
    }

    onStartNegotiation(): Observable<void> {
        return new Observable<void>(observer => {
            this.socket.on('startNegotiation', () => {
                console.log('🚦 Start negotiation signal received');
                observer.next();
            });
        });
    }

    // НОВИ events за connection management
    onResetConnection(): Observable<void> {
        return new Observable<void>(observer => {
            this.socket.on('resetConnection', () => {
                console.log('🔄 Reset connection signal received');
                observer.next();
            });
        });
    }

    sendConnectionEstablished(roomId: string) {
        console.log('🎉 Sending connection established for room:', roomId);
        this.socket.emit('connectionEstablished', { roomId });
    }

    // User events
    onUserJoined(): Observable<any> {
        return new Observable((observer) => {
            this.socket.on('userJoined', (data: any) => {
                console.log('👋 User joined event:', data);
                observer.next(data);
            });
        });
    }

    onUserLeft(): Observable<any> {
        return new Observable((observer) => {
            this.socket.on('userLeft', (data: any) => {
                console.log('👋 User left event:', data);
                observer.next(data);
            });
        });
    }

    onRoomFull(): Observable<void> {
        return new Observable((observer) => {
            this.socket.on('roomFull', () => {
                console.log('🚫 Room is full');
                observer.next();
            });
        });
    }

    sendUserJoined(roomId: string) {
        console.log('👋 Notifying user joined for room:', roomId);
        this.socket.emit('userJoined', roomId);
    }

    // WebRTC signaling
    sendOffer(roomId: string, offer: RTCSessionDescriptionInit): void {
        console.log('📤 Sending offer to room:', roomId, offer);
        this.socket.emit('offer', { roomId, offer });
    }

    onOffer(): Observable<RTCSessionDescriptionInit> {
        return new Observable((observer) => {
            this.socket.on('offer', (offer) => {
                console.log('📥 Offer received:', offer);
                observer.next(offer);
            });
        });
    }

    sendAnswer(roomId: string, answer: RTCSessionDescriptionInit): void {
        console.log('📤 Sending answer to room:', roomId, answer);
        this.socket.emit('answer', { roomId, answer });
    }

    onAnswer(): Observable<RTCSessionDescriptionInit> {
        return new Observable((observer) => {
            this.socket.on('answer', (answer) => {
                console.log('📥 Answer received:', answer);
                observer.next(answer);
            });
        });
    }

    sendIceCandidate(roomId: string, candidate: RTCIceCandidate): void {
        console.log('❄️ Sending ICE candidate to room:', roomId, candidate.candidate);
        this.socket.emit('ice-candidate', { roomId, candidate });
    }

    onIceCandidate(): Observable<RTCIceCandidate> {
        return new Observable((observer) => {
            this.socket.on('ice-candidate', (candidate) => {
                console.log('📥 ICE candidate received:', candidate.candidate);
                observer.next(candidate);
            });
        });
    }

    // Debug helpers
    sendDebugRooms(): void {
        this.socket.emit('debugRooms');
    }

    onDebugInfo(): Observable<any> {
        return new Observable((observer) => {
            this.socket.on('debugInfo', (info) => {
                console.log('🔍 Debug info received:', info);
                observer.next(info);
            });
        });
    }
}
