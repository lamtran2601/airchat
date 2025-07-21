// Stub implementations of P2P core classes for testing and development
// These will be replaced with actual implementations when the P2P library is available

import type { Message, FileTransfer, P2PConfig } from '../types/p2p';

// Event emitter base class
class EventEmitter {
  private handlers = new Map<string, Function[]>();

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, data?: any): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}

// P2P Connection Manager stub
export class P2PConnectionManager extends EventEmitter {
  constructor(config?: P2PConfig) {
    super();
    // Store config for potential future use
    config = config || defaultP2PConfig;
  }

  async createConnection(peerId: string): Promise<RTCPeerConnection> {
    // Return a mock RTCPeerConnection
    const mockConnection = {
      createOffer: () => Promise.resolve({ type: 'offer', sdp: 'mock-sdp' }),
      createAnswer: () => Promise.resolve({ type: 'answer', sdp: 'mock-sdp' }),
      setLocalDescription: () => Promise.resolve(),
      setRemoteDescription: () => Promise.resolve(),
      addIceCandidate: () => Promise.resolve(),
      connectionState: 'connected',
      iceConnectionState: 'connected',
    } as any;

    // Simulate connection establishment
    setTimeout(() => {
      this.emit('peer-connected', {
        peer: { id: peerId, name: `Peer ${peerId}` },
      });
    }, 100);

    return mockConnection;
  }

  closeConnection(peerId: string): void {
    this.emit('peer-disconnected', { peer: { id: peerId } });
  }

  closeAllConnections(): void {
    this.emit('all-connections-closed');
  }

  sendData(peerId: string, data: any): void {
    // Simulate data sending
    console.log(`Sending data to ${peerId}:`, data);
  }

  createDataChannel(peerId: string, label: string): any {
    return {
      label,
      readyState: 'open',
      send: (data: any) =>
        console.log(`Sending via data channel to ${peerId}:`, data),
    };
  }

  getConnectionState(_peerId: string): any {
    return {
      connection: {
        connectionState: 'connected',
        setRemoteDescription: () => Promise.resolve(),
        addIceCandidate: () => Promise.resolve(),
      },
      dataChannel: {
        readyState: 'open',
      },
    };
  }
}

// Signaling Client stub
export class SignalingClient extends EventEmitter {
  private connected = false;
  private currentRoomId: string | null = null;

  constructor(config?: P2PConfig) {
    super();
    // Store config for potential future use
    config = config || defaultP2PConfig;
  }

  async connect(_url?: string): Promise<void> {
    this.connected = true;
    this.emit('connected');
  }

  disconnect(): void {
    this.connected = false;
    this.emit('disconnected');
  }

  async joinRoom(roomId: string): Promise<string[]> {
    // Return mock existing peers
    const existingPeers = ['peer-1', 'peer-2'];
    this.emit('room-joined', { roomId, peers: existingPeers });
    return existingPeers;
  }

  leaveRoom(roomId?: string): void {
    const targetRoomId = roomId || this.currentRoomId;
    if (targetRoomId) {
      this.currentRoomId = null;
      this.emit('room-left', { roomId: targetRoomId });
    }
  }

  sendOffer(peerId: string, _offer: RTCSessionDescriptionInit): void {
    // Simulate sending offer
    setTimeout(() => {
      this.emit('answer-received', {
        senderId: peerId,
        answer: { type: 'answer', sdp: 'mock-answer-sdp' },
      });
    }, 50);
  }

  sendAnswer(peerId: string, _answer: RTCSessionDescriptionInit): void {
    // Simulate sending answer
    console.log(`Sending answer to ${peerId}`);
  }

  sendIceCandidate(peerId: string, _candidate: RTCIceCandidateInit): void {
    // Simulate sending ICE candidate
    console.log(`Sending ICE candidate to ${peerId}`);
  }

  getIsConnected(): boolean {
    return this.connected;
  }
}

// Message Handler stub
export class MessageHandler extends EventEmitter {
  sendMessage(peerId: string, content: string, replyTo?: string): Message {
    const message: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'current-user',
      content,
      timestamp: new Date(),
      type: 'text',
      status: 'sent',
      replyTo,
    };

    // Simulate message sending
    setTimeout(() => {
      this.emit('message-sent', { peerId, message });
    }, 10);

    return message;
  }

  handleReceivedMessage(peerId: string, data: any): void {
    const message: Message = {
      id: data.id || `msg-${Date.now()}`,
      senderId: peerId,
      content: data.content,
      timestamp: new Date(data.timestamp),
      type: data.type || 'text',
      status: 'delivered',
      replyTo: data.replyTo,
    };

    this.emit('message-received', { message });
  }
}

// File Transfer Manager stub
export class FileTransferManager extends EventEmitter {
  private chunkSize: number;

  constructor(chunkSize?: number) {
    super();
    this.chunkSize = chunkSize || 16384; // 16KB default
  }

  initiateTransfer(
    file: File,
    peerId: string,
    _onProgress?: (progress: number) => void
  ): FileTransfer {
    const transfer: FileTransfer = {
      id: `transfer-${Date.now()}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      senderId: 'current-user',
      receiverId: peerId,
      status: 'pending',
      progress: 0,
      chunks: [],
      timestamp: new Date(),
      metadata: {
        mimeType: file.type,
        chunks: Math.ceil(file.size / this.chunkSize),
        chunkSize: this.chunkSize,
      },
    };

    // Emit transfer request
    setTimeout(() => {
      this.emit('file-transfer-request', { transfer });
    }, 50);

    return transfer;
  }

  // Simulate actual file transfer with chunking
  private simulateFileTransfer(
    transferId: string,
    onProgress?: (progress: number) => void
  ): void {
    let progress = 0;
    const totalChunks = 10; // Simulate 10 chunks
    let currentChunk = 0;

    const transferChunk = () => {
      if (currentChunk >= totalChunks) {
        this.emit('file-transfer-completed', { transferId });
        return;
      }

      currentChunk++;
      progress = Math.round((currentChunk / totalChunks) * 100);

      if (onProgress) onProgress(progress);
      this.emit('file-transfer-progress', { transferId, progress });

      // Simulate network delay and potential failures
      const delay = Math.random() * 200 + 100; // 100-300ms delay
      const failureChance = 0.05; // 5% chance of failure per chunk

      setTimeout(() => {
        if (Math.random() < failureChance) {
          this.emit('file-transfer-failed', {
            transferId,
            error: 'Network error during chunk transfer',
          });
          return;
        }
        transferChunk();
      }, delay);
    };

    transferChunk();
  }

  acceptTransfer(transferId: string): void {
    this.emit('file-transfer-accepted', { transferId });

    // Start the actual file transfer
    setTimeout(() => {
      this.simulateFileTransfer(transferId);
    }, 100);
  }

  rejectTransfer(transferId: string): void {
    this.emit('file-transfer-rejected', { transferId });
  }

  cancelTransfer(transferId: string): void {
    this.emit('file-transfer-cancelled', { transferId });
  }
}

// Default P2P configuration
export const defaultP2PConfig: P2PConfig = {
  signalingServer: 'ws://localhost:4000',
  signalingUrl: 'ws://localhost:4000', // For compatibility with base interface
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  connectionTimeout: 30000,
  heartbeatInterval: 5000,
  maxRetries: 3,
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  chunkSize: 16384,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  enableLogging: true,
  autoReconnect: true,
};
