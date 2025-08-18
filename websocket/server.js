const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// roomId -> { host: socketId|null, guest: socketId|null, hostReady: boolean, guestReady: boolean }
const rooms = {};

io.on('connection', (socket) => {
    console.log('✅ Connected:', socket.id);

    socket.on('joinRoom', ({ roomId, role }) => {
        if (!roomId) return;

        console.log(`🔍 Join request: ${socket.id} wants role "${role}" in room ${roomId}`);

        if (!rooms[roomId]) rooms[roomId] = { host: null, guest: null, hostReady: false, guestReady: false };
        const room = rooms[roomId];

        let finalRole = role;

        // Логика за присвояване на роли
        if (role === 'host') {
            if (room.host && room.host !== socket.id) {
                console.log(`⚠️ Host slot taken, assigning guest role to ${socket.id}`);
                finalRole = 'guest';
            }
        }

        if (finalRole === 'guest') {
            if (room.guest && room.guest !== socket.id) {
                if (room.host && room.guest) {
                    console.log(`❌ Room ${roomId} is full`);
                    socket.emit('roomFull');
                    return;
                }
            }
        }

        // Присвояване на ролята
        if (finalRole === 'host') {
            room.host = socket.id;
            console.log(`👑 ${socket.id} is now HOST in room ${roomId}`);
        } else {
            room.guest = socket.id;
            console.log(`👤 ${socket.id} is now GUEST in room ${roomId}`);
        }

        socket.join(roomId);
        socket.emit('roleAssigned', finalRole);

        console.log(`📊 Room ${roomId} state:`, {
            host: room.host,
            guest: room.guest,
            hostReady: room.hostReady,
            guestReady: room.guestReady
        });

        // Уведоми другия участник, че някой се е присъединил
        socket.to(roomId).emit('userJoined', { role: finalRole, socketId: socket.id });
    });

    socket.on('ready', ({ roomId, role }) => {
        const room = rooms[roomId];
        if (!room) {
            console.log(`❌ Ready event for non-existent room: ${roomId}`);
            return;
        }

        console.log(`📌 ${role} (${socket.id}) is ready in room ${roomId}`);

        if (role === 'host') room.hostReady = true;
        else room.guestReady = true;

        console.log(`📊 Room ${roomId} ready state:`, {
            host: room.host,
            guest: room.guest,
            hostReady: room.hostReady,
            guestReady: room.guestReady,
            bothReady: room.host && room.guest && room.hostReady && room.guestReady
        });

        // Започни negotiation САМО когато и двамата са ready
        if (room.host && room.guest && room.hostReady && room.guestReady) {
            console.log(`🚀 Starting negotiation for room ${roomId} - signaling HOST`);
            io.to(room.host).emit('startNegotiation');
        }
    });

    socket.on('needRenegotiate', ({ roomId }) => {
        const room = rooms[roomId];
        console.log(`🔄 Renegotiation requested for room ${roomId} by ${socket.id}`);
        if (room?.host) {
            console.log(`📤 Sending startNegotiation to host ${room.host}`);
            io.to(room.host).emit('startNegotiation');
        }
    });

    // WebRTC signaling с logging
    socket.on('offer', ({ roomId, offer }) => {
        console.log(`📤 Offer sent by ${socket.id} to room ${roomId}`);
        socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', ({ roomId, answer }) => {
        console.log(`📤 Answer sent by ${socket.id} to room ${roomId}`);
        socket.to(roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        console.log(`❄️ ICE candidate from ${socket.id} to room ${roomId}`);
        socket.to(roomId).emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);

        // Почисти rooms
        for (const roomId in rooms) {
            const room = rooms[roomId];
            let changed = false;

            if (room.host === socket.id) {
                console.log(`👑 Host ${socket.id} left room ${roomId}`);
                room.host = null;
                room.hostReady = false;
                changed = true;
            }
            if (room.guest === socket.id) {
                console.log(`👤 Guest ${socket.id} left room ${roomId}`);
                room.guest = null;
                room.guestReady = false;
                changed = true;
            }

            if (changed) {
                // Уведоми останалия участник
                socket.to(roomId).emit('userLeft', { socketId: socket.id });

                if (!room.host && !room.guest) {
                    console.log(`🗑️ Deleting empty room ${roomId}`);
                    delete rooms[roomId];
                }
                break;
            }
        }
    });

    // Debug команда за преглед на rooms
    socket.on('debugRooms', () => {
        socket.emit('debugInfo', { rooms });
    });
});

server.listen(8001, '10.70.71.111', () => {
    console.log('🚀 WebSocket server running on http://10.70.71.111:8001');
});