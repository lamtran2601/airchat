import { Server, Socket } from 'socket.io';

interface PeerInfo {
  id: string;
  roomId: string;
  joinedAt: Date;
}

interface RoomStats {
  id: string;
  peerCount: number;
  createdAt: Date;
}

export class SignalingService {
  private static rooms = new Map<string, Set<string>>();
  private static peers = new Map<string, PeerInfo>();
  private static stats = {
    totalConnections: 0,
    activeConnections: 0,
    totalRooms: 0,
    messagesRelayed: 0,
  };

  constructor(private io: Server) {
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      SignalingService.stats.totalConnections++;
      SignalingService.stats.activeConnections++;

      // Handle room joining
      socket.on('join-room', (roomId: string) => {
        this.handleJoinRoom(socket, roomId);
      });

      // Handle WebRTC signaling messages
      socket.on('offer', (data: { target: string; offer: RTCSessionDescriptionInit }) => {
        this.relayMessage(socket, 'offer', data);
      });

      socket.on('answer', (data: { target: string; answer: RTCSessionDescriptionInit }) => {
        this.relayMessage(socket, 'answer', data);
      });

      socket.on('ice-candidate', (data: { target: string; candidate: RTCIceCandidateInit }) => {
        this.relayMessage(socket, 'ice-candidate', data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle leaving room
      socket.on('leave-room', () => {
        this.handleLeaveRoom(socket);
      });
    });
  }

  private handleJoinRoom(socket: Socket, roomId: string) {
    console.log(`👥 ${socket.id} joining room: ${roomId}`);

    // Leave current room if any
    this.handleLeaveRoom(socket);

    // Join new room
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!SignalingService.rooms.has(roomId)) {
      SignalingService.rooms.set(roomId, new Set());
      SignalingService.stats.totalRooms++;
    }

    const room = SignalingService.rooms.get(roomId)!;
    
    // Notify existing peers about new peer
    const existingPeers = Array.from(room);
    socket.emit('room-joined', { roomId, peers: existingPeers });
    
    // Notify existing peers about new peer joining
    socket.to(roomId).emit('peer-joined', { peerId: socket.id });

    // Add peer to room
    room.add(socket.id);
    SignalingService.peers.set(socket.id, {
      id: socket.id,
      roomId,
      joinedAt: new Date(),
    });

    console.log(`✅ ${socket.id} joined room ${roomId}. Room size: ${room.size}`);
  }

  private handleLeaveRoom(socket: Socket) {
    const peerInfo = SignalingService.peers.get(socket.id);
    if (!peerInfo) return;

    const { roomId } = peerInfo;
    const room = SignalingService.rooms.get(roomId);
    
    if (room) {
      room.delete(socket.id);
      socket.leave(roomId);
      
      // Notify other peers about peer leaving
      socket.to(roomId).emit('peer-left', { peerId: socket.id });
      
      // Clean up empty room
      if (room.size === 0) {
        SignalingService.rooms.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted (empty)`);
      }
      
      console.log(`👋 ${socket.id} left room ${roomId}. Room size: ${room.size}`);
    }

    SignalingService.peers.delete(socket.id);
  }

  private handleDisconnect(socket: Socket) {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    SignalingService.stats.activeConnections--;
    
    this.handleLeaveRoom(socket);
  }

  private relayMessage(socket: Socket, event: string, data: { target: string; [key: string]: any }) {
    const { target, ...payload } = data;
    
    // Add sender information
    const messageWithSender = {
      ...payload,
      sender: socket.id,
    };

    // Relay message to target peer
    socket.to(target).emit(event, messageWithSender);
    SignalingService.stats.messagesRelayed++;
    
    console.log(`📨 Relayed ${event} from ${socket.id} to ${target}`);
  }

  public static getStats() {
    return {
      ...SignalingService.stats,
      rooms: Array.from(SignalingService.rooms.entries()).map(([id, peers]) => ({
        id,
        peerCount: peers.size,
        peers: Array.from(peers),
      })),
      timestamp: new Date().toISOString(),
    };
  }

  public static getRoomStats(): RoomStats[] {
    return Array.from(SignalingService.rooms.entries()).map(([id, peers]) => ({
      id,
      peerCount: peers.size,
      createdAt: new Date(), // This would be tracked properly in a real implementation
    }));
  }
}
