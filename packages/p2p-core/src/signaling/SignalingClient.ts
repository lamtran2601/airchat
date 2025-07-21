import { io, Socket } from 'socket.io-client';
import type {
  P2PConfig,
  PeerInfo,
  SignalingMessage,
  EventHandler,
  P2PEvent,
} from '@p2p/types';
import { EventBus } from '../utils/EventBus.js';

interface RoomJoinedEvent {
  roomId: string;
  peers: string[];
}

interface PeerJoinedEvent {
  peerId: string;
}

interface PeerLeftEvent {
  peerId: string;
}

export class SignalingClient {
  private socket: Socket | null = null;
  private eventBus = new EventBus();
  private config: P2PConfig;
  private currentRoomId: string | null = null;
  private isConnected = false;

  constructor(config: P2PConfig) {
    this.config = config;
  }

  // Event handling
  on<T extends P2PEvent>(eventType: T['type'], handler: EventHandler<T>): void {
    this.eventBus.on(eventType, handler);
  }

  off<T extends P2PEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): void {
    this.eventBus.off(eventType, handler);
  }

  // Connect to signaling server
  async connect(signalingUrl?: string): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    // Use provided URL or fall back to config URL or signalingServer for backward compatibility
    const url =
      signalingUrl || this.config.signalingUrl || this.config.signalingServer;
    if (!url) {
      throw new Error('No signaling URL provided');
    }

    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
      });

      this.setupSocketHandlers();

      this.socket.on('connect', () => {
        console.log('Connected to signaling server');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', error => {
        console.error('Failed to connect to signaling server:', error);
        this.isConnected = false;
        reject(error);
      });
    });
  }

  // Disconnect from signaling server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoomId = null;
    }
  }

  // Join a room
  async joinRoom(roomId: string): Promise<string[]> {
    if (!this.socket?.connected) {
      throw new Error('Not connected to signaling server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Room join timeout'));
      }, 10000);

      this.socket!.once('room-joined', (data: RoomJoinedEvent) => {
        clearTimeout(timeout);
        this.currentRoomId = roomId;
        console.log(`Joined room ${roomId} with peers:`, data.peers);
        resolve(data.peers);
      });

      this.socket!.emit('join-room', roomId);
    });
  }

  // Leave current room
  leaveRoom(): void {
    if (this.socket?.connected && this.currentRoomId) {
      this.socket.emit('leave-room');
      this.currentRoomId = null;
    }
  }

  // Send WebRTC offer
  sendOffer(targetPeerId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('offer', {
      target: targetPeerId,
      offer,
    });

    console.log(`Sent offer to peer ${targetPeerId}`);
  }

  // Send WebRTC answer
  sendAnswer(targetPeerId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('answer', {
      target: targetPeerId,
      answer,
    });

    console.log(`Sent answer to peer ${targetPeerId}`);
  }

  // Send ICE candidate
  sendIceCandidate(targetPeerId: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to signaling server');
    }

    this.socket.emit('ice-candidate', {
      target: targetPeerId,
      candidate,
    });

    console.log(`Sent ICE candidate to peer ${targetPeerId}`);
  }

  // Get current room ID
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  // Check if connected
  getIsConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    // Handle disconnection
    this.socket.on('disconnect', reason => {
      console.log('Disconnected from signaling server:', reason);
      this.isConnected = false;
      this.currentRoomId = null;
    });

    // Handle peer joining room
    this.socket.on('peer-joined', (data: PeerJoinedEvent) => {
      console.log(`Peer ${data.peerId} joined the room`);
      this.eventBus.emit({
        type: 'peer-joined',
        peerId: data.peerId,
      } as any);
    });

    // Handle peer leaving room
    this.socket.on('peer-left', (data: PeerLeftEvent) => {
      console.log(`Peer ${data.peerId} left the room`);
      // This will be handled by the room management system
    });

    // Handle WebRTC offer
    this.socket.on(
      'offer',
      (data: { sender: string; offer: RTCSessionDescriptionInit }) => {
        console.log(`Received offer from peer ${data.sender}`);
        this.eventBus.emit({
          type: 'offer-received',
          senderId: data.sender,
          offer: data.offer,
        } as any);
      }
    );

    // Handle WebRTC answer
    this.socket.on(
      'answer',
      (data: { sender: string; answer: RTCSessionDescriptionInit }) => {
        console.log(`Received answer from peer ${data.sender}`);
        this.eventBus.emit({
          type: 'answer-received',
          senderId: data.sender,
          answer: data.answer,
        } as any);
      }
    );

    // Handle ICE candidate
    this.socket.on(
      'ice-candidate',
      (data: { sender: string; candidate: RTCIceCandidateInit }) => {
        console.log(`Received ICE candidate from peer ${data.sender}`);
        this.eventBus.emit({
          type: 'ice-candidate-received',
          senderId: data.sender,
          candidate: data.candidate,
        } as any);
      }
    );

    // Handle errors
    this.socket.on('error', error => {
      console.error('Signaling error:', error);
    });

    // Handle reconnection
    this.socket.on('reconnect', attemptNumber => {
      console.log(`Reconnected to signaling server (attempt ${attemptNumber})`);
      this.isConnected = true;

      // Rejoin room if we were in one
      if (this.currentRoomId) {
        this.socket!.emit('join-room', this.currentRoomId);
      }
    });

    this.socket.on('reconnect_error', error => {
      console.error('Reconnection failed:', error);
    });
  }
}
