// Real P2P Core Implementation
import type {
  Message,
  FileTransfer,
  P2PConfig,
  ConnectionState,
} from '../types/p2p';

// Simple EventEmitter implementation for browser
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }

  removeAllListeners(): void {
    this.events = {};
  }
}

// Default P2P configuration
export const defaultP2PConfig: P2PConfig = {
  signalingUrl: 'ws://localhost:4000',
  signalingServer: 'ws://localhost:4000',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  chunkSize: 16384,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  connectionTimeout: 30000,
  heartbeatInterval: 5000,
  maxRetries: 3,
  enableLogging: true,
  autoReconnect: true,
};

// Real SignalingClient implementation
export class SignalingClient extends EventEmitter {
  private currentRoomId: string | null = null;
  private ws: WebSocket | null = null;
  private config: P2PConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  constructor(config?: P2PConfig) {
    super();
    this.config = { ...defaultP2PConfig, ...config };
  }

  async connect(url?: string): Promise<void> {
    const wsUrl =
      url || this.config.signalingUrl || this.config.signalingServer;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('SignalingClient: Connected to signaling server');
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('SignalingClient: Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('SignalingClient: Disconnected from signaling server');
          this.emit('disconnected');
          if (this.config.autoReconnect) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = error => {
          console.error('SignalingClient: WebSocket error:', error);
          reject(error);
        };

        // Connection timeout
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentRoomId = null;
    this.emit('disconnected');
    console.log('SignalingClient: Disconnected from signaling server');
  }

  async joinRoom(roomId: string): Promise<void> {
    this.currentRoomId = roomId;
    this.sendMessage({
      type: 'join-room',
      roomId,
      timestamp: Date.now(),
    });
    console.log(`SignalingClient: Joined room ${roomId}`);
  }

  async leaveRoom(): Promise<void> {
    if (this.currentRoomId) {
      this.sendMessage({
        type: 'leave-room',
        roomId: this.currentRoomId,
        timestamp: Date.now(),
      });
      console.log(`SignalingClient: Left room ${this.currentRoomId}`);
      this.currentRoomId = null;
    }
  }

  sendOffer(peerId: string, offer: RTCSessionDescriptionInit): void {
    this.sendMessage({
      type: 'offer',
      targetPeerId: peerId,
      offer,
      timestamp: Date.now(),
    });
    console.log(`SignalingClient: Sending offer to ${peerId}`);
  }

  sendAnswer(peerId: string, answer: RTCSessionDescriptionInit): void {
    this.sendMessage({
      type: 'answer',
      targetPeerId: peerId,
      answer,
      timestamp: Date.now(),
    });
    console.log(`SignalingClient: Sending answer to ${peerId}`);
  }

  sendIceCandidate(peerId: string, candidate: RTCIceCandidateInit): void {
    this.sendMessage({
      type: 'ice-candidate',
      targetPeerId: peerId,
      candidate,
      timestamp: Date.now(),
    });
    console.log(`SignalingClient: Sending ICE candidate to ${peerId}`);
  }

  getIsConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn(
        'SignalingClient: Cannot send message, WebSocket not connected'
      );
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'peer-joined':
        this.emit('peer-joined', {
          peerId: message.peerId,
          name: message.name || `Peer ${message.peerId}`,
        });
        break;

      case 'peer-left':
        this.emit('peer-left', {
          peerId: message.peerId,
        });
        break;

      case 'offer':
        this.emit('offer-received', {
          senderId: message.senderId,
          offer: message.offer,
        });
        break;

      case 'answer':
        this.emit('answer-received', {
          senderId: message.senderId,
          answer: message.answer,
        });
        break;

      case 'ice-candidate':
        this.emit('ice-candidate-received', {
          senderId: message.senderId,
          candidate: message.candidate,
        });
        break;

      case 'room-peers':
        // Handle existing peers in room
        if (message.peers && Array.isArray(message.peers)) {
          message.peers.forEach((peer: any) => {
            this.emit('peer-joined', {
              peerId: peer.id,
              name: peer.name || `Peer ${peer.id}`,
            });
          });
        }
        break;

      default:
        console.log('SignalingClient: Unknown message type:', message.type);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `SignalingClient: Attempting reconnect ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`
      );

      this.reconnectTimer = window.setTimeout(() => {
        this.connect().catch(error => {
          console.error('SignalingClient: Reconnect failed:', error);
        });
      }, this.config.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('SignalingClient: Max reconnect attempts reached');
      this.emit('reconnect-failed');
    }
  }
}

// Real P2PConnectionManager implementation
export class P2PConnectionManager extends EventEmitter {
  private connections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private config: P2PConfig;

  constructor(config?: P2PConfig) {
    super();
    this.config = { ...defaultP2PConfig, ...config };
  }

  async createConnection(peerId: string): Promise<RTCPeerConnection> {
    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    // Set up event handlers
    connection.onicecandidate = event => {
      if (event.candidate) {
        this.emit('ice-candidate', {
          peerId,
          candidate: event.candidate,
        });
      }
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      console.log(`Connection state changed for ${peerId}: ${state}`);

      this.emit('connection-state-changed', {
        peerId,
        state: {
          status: this.mapConnectionState(state),
          peer: { id: peerId, name: `Peer ${peerId}`, status: 'connecting' },
          connection,
          lastActivity: new Date(),
          reconnectAttempts: 0,
        } as ConnectionState,
      });

      if (state === 'connected') {
        this.emit('peer-connected', {
          peer: { id: peerId, name: `Peer ${peerId}`, status: 'connected' },
        });
      } else if (state === 'disconnected' || state === 'failed') {
        this.emit('peer-disconnected', {
          peer: { id: peerId, name: `Peer ${peerId}`, status: 'offline' },
        });
        this.removeConnection(peerId);
      }
    };

    this.connections.set(peerId, connection);
    return connection;
  }

  private mapConnectionState(
    state: RTCPeerConnectionState
  ): ConnectionState['status'] {
    switch (state) {
      case 'connected':
        return 'connected';
      case 'connecting':
        return 'connecting';
      case 'disconnected':
        return 'disconnected';
      case 'failed':
        return 'failed';
      default:
        return 'disconnected';
    }
  }

  removeConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }
  }

  getConnection(peerId: string): RTCPeerConnection | undefined {
    return this.connections.get(peerId);
  }

  getDataChannel(peerId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(peerId);
  }

  getAllConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.connections);
  }

  createDataChannel(
    peerId: string,
    label: string = 'data'
  ): RTCDataChannel | null {
    const connection = this.connections.get(peerId);
    if (!connection) {
      console.error(`No connection found for peer ${peerId}`);
      return null;
    }

    const dataChannel = connection.createDataChannel(label, {
      ordered: true,
    });

    dataChannel.onopen = () => {
      console.log(`Data channel opened for ${peerId}`);
      this.emit('data-channel-open', { peerId });
    };

    dataChannel.onmessage = event => {
      this.emit('data-received', {
        peerId,
        data: event.data,
      });
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed for ${peerId}`);
      this.dataChannels.delete(peerId);
    };

    this.dataChannels.set(peerId, dataChannel);
    return dataChannel;
  }

  sendData(peerId: string, data: string | ArrayBuffer): boolean {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error(`Data channel not available for peer ${peerId}`);
      return false;
    }

    try {
      if (typeof data === 'string') {
        dataChannel.send(data);
      } else {
        dataChannel.send(data);
      }
      return true;
    } catch (error) {
      console.error(`Failed to send data to ${peerId}:`, error);
      return false;
    }
  }

  closeAllConnections(): void {
    for (const [peerId, connection] of this.connections) {
      connection.close();
      console.log(`Closed connection for peer ${peerId}`);
    }

    for (const [peerId, dataChannel] of this.dataChannels) {
      dataChannel.close();
      console.log(`Closed data channel for peer ${peerId}`);
    }

    this.connections.clear();
    this.dataChannels.clear();
  }

  getConnectionState(peerId: string): any {
    const connection = this.connections.get(peerId);
    if (!connection) {
      return null;
    }

    return {
      peer: { id: peerId, name: `Peer ${peerId}`, status: 'connecting' },
      status: this.mapConnectionState(connection.connectionState),
      connection,
      dataChannel: this.dataChannels.get(peerId),
      lastActivity: new Date(),
      reconnectAttempts: 0,
    };
  }
}

// Real MessageHandler implementation
export class MessageHandler extends EventEmitter {
  private connectionManager: P2PConnectionManager;

  constructor(connectionManager: P2PConnectionManager) {
    super();
    this.connectionManager = connectionManager;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.connectionManager.on('data-received', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          this.handleReceivedMessage(event.peerId, data);
        }
      } catch (error) {
        console.error('Failed to parse received data as message:', error);
      }
    });
  }

  sendMessage(peerId: string, content: string, replyTo?: string): Message {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      senderId: 'current-user',
      content,
      timestamp: new Date(),
      type: 'text',
      status: 'sending',
      replyTo,
    };

    const messageData = {
      ...message,
      type: 'message',
    };

    const success = this.connectionManager.sendData(
      peerId,
      JSON.stringify(messageData)
    );
    if (success) {
      message.status = 'sent';
      this.emit('message-sent', { peerId, message });
    } else {
      message.status = 'failed';
    }

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

// Real FileTransferManager implementation
export class FileTransferManager extends EventEmitter {
  private connectionManager: P2PConnectionManager;
  private activeTransfers = new Map<string, FileTransfer>();

  constructor(connectionManager: P2PConnectionManager, _config?: P2PConfig) {
    super();
    this.connectionManager = connectionManager;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.connectionManager.on('data-received', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'file-transfer') {
          this.handleFileTransferMessage(event.peerId, data);
        }
      } catch (error) {
        // Might be binary data, ignore for now
      }
    });
  }

  sendFile(
    peerId: string,
    file: File,
    _onProgress?: (progress: number) => void
  ): FileTransfer {
    const transfer: FileTransfer = {
      id: `transfer-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      senderId: 'current-user',
      receiverId: peerId,
      status: 'pending',
      progress: 0,
      chunks: [],
      timestamp: new Date(),
    };

    this.activeTransfers.set(transfer.id, transfer);

    // Send file transfer request
    const requestData = {
      type: 'file-transfer',
      action: 'request',
      transferId: transfer.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };

    const success = this.connectionManager.sendData(
      peerId,
      JSON.stringify(requestData)
    );
    if (!success) {
      transfer.status = 'failed';
      this.emit('file-transfer-failed', {
        transferId: transfer.id,
        error: 'Failed to send request',
      });
    } else {
      this.emit('file-transfer-request', { transfer });
    }

    return transfer;
  }

  acceptFileTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      transfer.status = 'accepted';
      this.emit('file-transfer-accepted', { transferId });

      // Send acceptance message
      const acceptData = {
        type: 'file-transfer',
        action: 'accept',
        transferId,
      };
      this.connectionManager.sendData(
        transfer.senderId,
        JSON.stringify(acceptData)
      );
    }
  }

  rejectFileTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      transfer.status = 'rejected';
      this.emit('file-transfer-rejected', { transferId });

      // Send rejection message
      const rejectData = {
        type: 'file-transfer',
        action: 'reject',
        transferId,
      };
      this.connectionManager.sendData(
        transfer.senderId,
        JSON.stringify(rejectData)
      );
      this.activeTransfers.delete(transferId);
    }
  }

  cancelFileTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      transfer.status = 'cancelled';
      this.emit('file-transfer-cancelled', { transferId });

      // Send cancellation message
      const cancelData = {
        type: 'file-transfer',
        action: 'cancel',
        transferId,
      };
      const targetPeer =
        transfer.senderId === 'current-user'
          ? transfer.receiverId
          : transfer.senderId;
      this.connectionManager.sendData(targetPeer, JSON.stringify(cancelData));
      this.activeTransfers.delete(transferId);
    }
  }

  private handleFileTransferMessage(peerId: string, data: any): void {
    switch (data.action) {
      case 'request':
        // Handle incoming file transfer request
        const transfer: FileTransfer = {
          id: data.transferId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          fileType: data.fileType,
          senderId: peerId,
          receiverId: 'current-user',
          status: 'pending',
          progress: 0,
          chunks: [],
          timestamp: new Date(),
        };
        this.activeTransfers.set(transfer.id, transfer);
        this.emit('file-transfer-request', { transfer });
        break;

      case 'accept':
        this.emit('file-transfer-accepted', { transferId: data.transferId });
        break;

      case 'reject':
        this.emit('file-transfer-rejected', { transferId: data.transferId });
        this.activeTransfers.delete(data.transferId);
        break;

      case 'cancel':
        this.emit('file-transfer-cancelled', { transferId: data.transferId });
        this.activeTransfers.delete(data.transferId);
        break;
    }
  }

  getActiveTransfers(): FileTransfer[] {
    return Array.from(this.activeTransfers.values());
  }
}
