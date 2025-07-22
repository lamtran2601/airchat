import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  // Optimize for minimal resource usage
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Simple room-based signaling
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    console.log(`${socket.id} joining room: ${roomId}`);
    
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    // Notify others in room
    socket.to(roomId).emit('peer-joined', { peerId: socket.id });
    
    // Send current room participants to the new user
    const participants = Array.from(rooms.get(roomId)).filter(id => id !== socket.id);
    socket.emit('room-participants', { participants });
  });

  // Simple message relay for WebRTC signaling
  socket.on('offer', (data) => {
    console.log(`Relaying offer from ${socket.id} to room ${data.room}`);
    socket.to(data.room).emit('offer', { from: socket.id, offer: data.offer });
  });

  socket.on('answer', (data) => {
    console.log(`Relaying answer from ${socket.id} to room ${data.room}`);
    socket.to(data.room).emit('answer', { from: socket.id, answer: data.answer });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`Relaying ICE candidate from ${socket.id} to room ${data.room}`);
    socket.to(data.room).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clean up rooms
    for (const [roomId, participants] of rooms) {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        socket.to(roomId).emit('peer-left', { peerId: socket.id });

        if (participants.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
});
