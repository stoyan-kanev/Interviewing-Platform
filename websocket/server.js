const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:4200',
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`🟢 ${socket.id} joined room ${roomId}`);
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('offer', ({ roomId, offer }) => {
        socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', ({ roomId, answer }) => {
        socket.to(roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
        socket.to(roomId).emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

const PORT = 8001;
server.listen(PORT, () => console.log(`🚀 WebSocket server running on http://localhost:${PORT}`));
