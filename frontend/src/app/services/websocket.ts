import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class WebSocketService {
    private socket!: Socket;

    connect(roomId: string): void {
        this.socket = io('http://localhost:8001');

        this.socket.on('connect', () => {
            console.log('✅ Connected to WebSocket server');
            this.socket.emit('join-room', roomId);
        });
    }

    sendOffer(roomId: string, offer: RTCSessionDescriptionInit): void {
        this.socket.emit('offer', { roomId, offer });
    }

    sendAnswer(roomId: string, answer: RTCSessionDescriptionInit): void {
        this.socket.emit('answer', { roomId, answer });
    }

    sendIceCandidate(roomId: string, candidate: RTCIceCandidate): void {
        this.socket.emit('ice-candidate', { roomId, candidate });
    }

    onOffer(): Observable<RTCSessionDescriptionInit> {
        return new Observable((subscriber) => {
            this.socket.on('offer', (offer) => subscriber.next(offer));
        });
    }

    onAnswer(): Observable<RTCSessionDescriptionInit> {
        return new Observable((subscriber) => {
            this.socket.on('answer', (answer) => subscriber.next(answer));
        });
    }

    onIceCandidate(): Observable<RTCIceCandidate> {
        return new Observable((subscriber) => {
            this.socket.on('ice-candidate', (candidate) => subscriber.next(candidate));
        });
    }

    onUserJoined(): Observable<string> {
        return new Observable((subscriber) => {
            this.socket.on('user-joined', (socketId) => subscriber.next(socketId));
        });
    }
}
