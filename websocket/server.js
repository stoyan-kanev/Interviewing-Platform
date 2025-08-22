const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// roomId -> { host: socketId|null, guest: socketId|null, hostReady: boolean, guestReady: boolean, negotiationStarted: boolean, lastActivity: timestamp, codeEditorUsers: Map }
const rooms = {};

// Cleanup старите rooms на всеки 30 секунди
setInterval(() => {
    const now = Date.now();
    const ROOM_TIMEOUT = 5 * 60 * 1000; // 5 минути

    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (now - room.lastActivity > ROOM_TIMEOUT) {
            console.log(`🗑️ Cleaning up inactive room ${roomId}`);
            delete rooms[roomId];
        }
    }
}, 30000);

// Функция за намиране на локалния IP адрес
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// Code execution function (simplified - в production използвайте sandbox)
function executeCode(code, language) {
    try {
        if (language === 'javascript') {
            // Използваме eval само за demo - НЕ правете това в production!
            const originalLog = console.log;
            let output = '';
            console.log = (...args) => {
                output += args.join(' ') + '\n';
            };

            eval(code);
            console.log = originalLog;
            return { output: output || 'Code executed successfully' };
        } else {
            return { output: `Code execution for ${language} is not implemented in this demo.\nCode:\n${code}` };
        }
    } catch (error) {
        return { error: `Error: ${error.message}` };
    }
}

// Reset negotiation състоянието на room
function resetNegotiation(roomId) {
    const room = rooms[roomId];
    if (room) {
        console.log(`🔄 Resetting negotiation for room ${roomId}`);
        room.negotiationStarted = false;
        room.lastActivity = Date.now();

        // Уведоми всички участници че трябва да reset-нат connection
        io.to(roomId).emit('resetConnection');
    }
}

// Функция за автоматично стартиране на negotiation
function tryStartNegotiation(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    console.log(`🔍 Checking if negotiation can start for room ${roomId}:`, {
        host: !!room.host,
        guest: !!room.guest,
        hostReady: room.hostReady,
        guestReady: room.guestReady,
        negotiationStarted: room.negotiationStarted
    });

    // Започни negotiation САМО когато и двамата са ready и не е започвало преди
    if (room.host && room.guest && room.hostReady && room.guestReady && !room.negotiationStarted) {
        console.log(`🚀 Starting negotiation for room ${roomId} - signaling HOST`);
        room.negotiationStarted = true;
        room.lastActivity = Date.now();

        // Изпращаме със small delay за да се уверим че tracks са готови
        setTimeout(() => {
            if (rooms[roomId]?.host) { // Double check че room все още съществува
                io.to(room.host).emit('startNegotiation');
            }
        }, 500);
    }
}

io.on('connection', (socket) => {
    console.log('✅ Connected:', socket.id);

    // ============ VIDEO CALL EVENTS ============

    socket.on('joinRoom', ({ roomId, role }) => {
        if (!roomId) return;

        console.log(`🔍 Join request: ${socket.id} wants role "${role}" in room ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                host: null,
                guest: null,
                hostReady: false,
                guestReady: false,
                negotiationStarted: false,
                lastActivity: Date.now(),
                codeEditorUsers: new Map()
            };
        }
        const room = rooms[roomId];
        room.lastActivity = Date.now();

        let finalRole = role;

        // Ако някой се опитва да се присъедини отново със същата роля
        if (role === 'host' && room.host === socket.id) {
            console.log(`🔄 Host ${socket.id} rejoining room ${roomId}`);
            resetNegotiation(roomId);
        } else if (role === 'guest' && room.guest === socket.id) {
            console.log(`🔄 Guest ${socket.id} rejoining room ${roomId}`);
            resetNegotiation(roomId);
        }

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

        // Ако някой сменя ролята си, reset-ваме negotiation
        if ((finalRole === 'host' && room.host !== socket.id) ||
            (finalRole === 'guest' && room.guest !== socket.id)) {
            resetNegotiation(roomId);
        }

        // Присвояване на ролята
        if (finalRole === 'host') {
            room.host = socket.id;
            room.hostReady = false; // Reset ready състоянието
            console.log(`👑 ${socket.id} is now HOST in room ${roomId}`);
        } else {
            room.guest = socket.id;
            room.guestReady = false; // Reset ready състоянието
            console.log(`👤 ${socket.id} is now GUEST in room ${roomId}`);
        }

        socket.join(roomId);
        socket.emit('roleAssigned', finalRole);

        console.log(`📊 Room ${roomId} state:`, {
            host: room.host,
            guest: room.guest,
            hostReady: room.hostReady,
            guestReady: room.guestReady,
            negotiationStarted: room.negotiationStarted
        });

        // Уведоми другия участник, че някой се е присъединил
        socket.to(roomId).emit('userJoined', { role: finalRole, socketId: socket.id });

        // Проверка дали може да започне negotiation
        setTimeout(() => tryStartNegotiation(roomId), 1000);
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

        room.lastActivity = Date.now();

        console.log(`📊 Room ${roomId} ready state:`, {
            host: room.host,
            guest: room.guest,
            hostReady: room.hostReady,
            guestReady: room.guestReady,
            negotiationStarted: room.negotiationStarted
        });

        // Проверка дали може да започне negotiation
        setTimeout(() => tryStartNegotiation(roomId), 500);
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
        if (rooms[roomId]) rooms[roomId].lastActivity = Date.now();
    });

    socket.on('answer', ({ roomId, answer }) => {
        console.log(`📤 Answer sent by ${socket.id} to room ${roomId}`);
        socket.to(roomId).emit('answer', answer);
        if (rooms[roomId]) rooms[roomId].lastActivity = Date.now();
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        console.log(`❄️ ICE candidate from ${socket.id} to room ${roomId}`);
        socket.to(roomId).emit('ice-candidate', candidate);
        if (rooms[roomId]) rooms[roomId].lastActivity = Date.now();
    });

    // Нов event за connection established
    socket.on('connectionEstablished', ({ roomId }) => {
        console.log(`🎉 Connection established in room ${roomId} by ${socket.id}`);
        if (rooms[roomId]) {
            rooms[roomId].lastActivity = Date.now();
        }
    });

    // ============ CODE EDITOR EVENTS ============

    socket.on('joinCodeEditor', ({ roomId, user }) => {
        console.log(`📝 ${user.name} joining code editor in room ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                host: null,
                guest: null,
                hostReady: false,
                guestReady: false,
                negotiationStarted: false,
                lastActivity: Date.now(),
                codeEditorUsers: new Map()
            };
        }

        const room = rooms[roomId];
        room.codeEditorUsers.set(socket.id, user);
        room.lastActivity = Date.now();

        socket.join(`${roomId}-code`);

        // Уведоми другите потребители
        socket.to(`${roomId}-code`).emit('codeEditorUserJoined', user);

        // Изпрати списък с текущите потребители на новия user
        const otherUsers = Array.from(room.codeEditorUsers.values()).filter(u => u.id !== user.id);
        otherUsers.forEach(otherUser => {
            socket.emit('codeEditorUserJoined', otherUser);
        });
    });

    socket.on('leaveCodeEditor', ({ roomId, userId }) => {
        console.log(`📝 User ${userId} leaving code editor in room ${roomId}`);

        const room = rooms[roomId];
        if (room) {
            room.codeEditorUsers.delete(socket.id);
            socket.to(`${roomId}-code`).emit('codeEditorUserLeft', userId);
        }

        socket.leave(`${roomId}-code`);
    });

    socket.on('codeChange', ({ roomId, change }) => {
        console.log(`📝 Code change in room ${roomId} by ${change.userId}`);
        socket.to(`${roomId}-code`).emit('codeChange', change);

        if (rooms[roomId]) {
            rooms[roomId].lastActivity = Date.now();
        }
    });

    socket.on('languageChange', ({ roomId, language, userId }) => {
        console.log(`🔄 Language change to ${language} in room ${roomId}`);
        socket.to(`${roomId}-code`).emit('languageChange', { language, userId });

        if (rooms[roomId]) {
            rooms[roomId].lastActivity = Date.now();
        }
    });

    socket.on('codeExecution', ({ roomId, code, language, userId }) => {
        console.log(`▶️ Code execution request in room ${roomId} by ${userId}`);

        const result = executeCode(code, language);

        // Изпращаме резултата обратно на всички в стаята
        io.to(`${roomId}-code`).emit('codeExecutionResult', result);

        if (rooms[roomId]) {
            rooms[roomId].lastActivity = Date.now();
        }
    });

    socket.on('codeReset', ({ roomId, code, userId }) => {
        console.log(`🔄 Code reset in room ${roomId} by ${userId}`);
        socket.to(`${roomId}-code`).emit('codeChange', {
            range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: Number.MAX_SAFE_INTEGER,
                endColumn: 1
            },
            text: code,
            timestamp: Date.now(),
            userId: userId
        });

        if (rooms[roomId]) {
            rooms[roomId].lastActivity = Date.now();
        }
    });

    // ============ DISCONNECT HANDLING ============

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
                resetNegotiation(roomId);
                changed = true;
            }
            if (room.guest === socket.id) {
                console.log(`👤 Guest ${socket.id} left room ${roomId}`);
                room.guest = null;
                room.guestReady = false;
                resetNegotiation(roomId);
                changed = true;
            }

            if (changed) {
                // Уведоми останалия участник
                socket.to(roomId).emit('userLeft', { socketId: socket.id });

                // Почисти и от code editor
                if (room.codeEditorUsers && room.codeEditorUsers.has(socket.id)) {
                    const user = room.codeEditorUsers.get(socket.id);
                    room.codeEditorUsers.delete(socket.id);
                    socket.to(`${roomId}-code`).emit('codeEditorUserLeft', user.id);
                }

                if (!room.host && !room.guest) {
                    console.log(`🗑️ Deleting empty room ${roomId}`);
                    delete rooms[roomId];
                }
                break;
            }
        }
    });

    // ============ DEBUG COMMANDS ============

    socket.on('debugRooms', () => {
        socket.emit('debugInfo', { rooms: Object.fromEntries(
                Object.entries(rooms).map(([roomId, room]) => [
                    roomId,
                    {
                        ...room,
                        codeEditorUsers: Array.from(room.codeEditorUsers?.values() || [])
                    }
                ])
            )});
    });
});

// ============ SERVER STARTUP ============

const localIP = getLocalIPAddress();
const PORT = process.env.PORT || 8001;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
    console.log(`🚀 WebSocket server running on:`);
    console.log(`   - Local:   http://127.0.0.1:${PORT}`);
    console.log(`   - Network: http://${localIP}:${PORT}`);
    console.log(`   - All interfaces: http://${HOST}:${PORT}`);
    console.log('');
    console.log('📋 Supported events:');
    console.log('   Video Call: joinRoom, ready, offer, answer, ice-candidate');
    console.log('   Code Editor: joinCodeEditor, codeChange, languageChange, codeExecution');
    console.log('   Debug: debugRooms');
});