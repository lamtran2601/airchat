import type {
  ConnectionState,
  PeerInfo,
  P2PConfig,
  P2PEvent,
  EventHandler,
} from '@p2p/types';
import { EventBus } from '../utils/EventBus.js';
import { generateId } from '../utils/index.js';

export class P2PConnectionManager {
  private connections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private connectionStates = new Map<string, ConnectionState>();
  private eventBus = new EventBus();
  private config: P2PConfig;

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

  // EventEmitter compatibility methods for frontend
  emit(event: string, data: any): void {
    this.eventBus.emit({ type: event, ...data });
  }

  // Create a new peer connection
  async createConnection(
    peerId: string,
    peerInfo?: PeerInfo
  ): Promise<RTCPeerConnection> {
    if (this.connections.has(peerId)) {
      throw new Error(`Connection to peer ${peerId} already exists`);
    }

    // Create default peerInfo if not provided (for frontend compatibility)
    const defaultPeerInfo: PeerInfo = peerInfo || {
      id: peerId,
      name: `Peer ${peerId}`,
      status: 'connecting',
    };

    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 3,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Set up connection event handlers
    this.setupConnectionHandlers(connection, peerId, defaultPeerInfo);

    // Store connection
    this.connections.set(peerId, connection);

    // Initialize connection state
    const connectionState: ConnectionState = {
      status: 'connecting',
      peer: defaultPeerInfo,
      connection,
      reconnectAttempts: 0,
    };
    this.connectionStates.set(peerId, connectionState);

    // Emit connection state change
    this.eventBus.emit({
      type: 'connection-state-changed',
      state: connectionState,
    });

    return connection;
  }

  // Create data channel for a peer
  createDataChannel(peerId: string, label = 'messages'): RTCDataChannel {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    const dataChannel = connection.createDataChannel(label, {
      ordered: true,
      maxRetransmits: 3,
    });

    this.setupDataChannelHandlers(dataChannel, peerId);
    this.dataChannels.set(peerId, dataChannel);

    return dataChannel;
  }

  // Send data to a peer
  sendData(peerId: string, data: string | ArrayBuffer): boolean {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`Data channel not ready for peer ${peerId}`);
      return false;
    }

    try {
      if (typeof data === 'string') {
        dataChannel.send(data);
      } else {
        // Convert ArrayBuffer to Uint8Array for sending
        dataChannel.send(new Uint8Array(data));
      }
      return true;
    } catch (error) {
      console.error(`Failed to send data to peer ${peerId}:`, error);
      return false;
    }
  }

  // Get connection state for a peer
  getConnectionState(peerId: string): ConnectionState | undefined {
    return this.connectionStates.get(peerId);
  }

  // Get all connection states
  getAllConnectionStates(): ConnectionState[] {
    return Array.from(this.connectionStates.values());
  }

  // Close connection to a peer
  closeConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    const dataChannel = this.dataChannels.get(peerId);
    const state = this.connectionStates.get(peerId);

    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }

    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }

    if (state) {
      state.status = 'disconnected';
      this.connectionStates.delete(peerId);

      this.eventBus.emit({
        type: 'peer-disconnected',
        peer: state.peer,
      });
    }
  }

  // Close all connections
  closeAllConnections(): void {
    for (const peerId of this.connections.keys()) {
      this.closeConnection(peerId);
    }
  }

  private setupConnectionHandlers(
    connection: RTCPeerConnection,
    peerId: string,
    peerInfo: PeerInfo
  ): void {
    connection.onicecandidate = event => {
      if (event.candidate) {
        // ICE candidate will be handled by signaling client
        console.log(`ICE candidate for peer ${peerId}:`, event.candidate);
      }
    };

    connection.onconnectionstatechange = () => {
      const state = this.connectionStates.get(peerId);
      if (!state) return;

      switch (connection.connectionState) {
        case 'connected':
          state.status = 'connected';
          state.lastConnected = new Date();
          state.reconnectAttempts = 0;
          this.eventBus.emit({
            type: 'peer-connected',
            peer: peerInfo,
          });
          break;
        case 'disconnected':
        case 'failed':
          state.status = 'failed';
          this.handleConnectionFailure(peerId);
          break;
        case 'connecting':
          state.status = 'connecting';
          break;
      }

      this.eventBus.emit({
        type: 'connection-state-changed',
        state,
      });
    };

    connection.ondatachannel = event => {
      const dataChannel = event.channel;
      this.setupDataChannelHandlers(dataChannel, peerId);
      this.dataChannels.set(peerId, dataChannel);
    };

    connection.onicegatheringstatechange = () => {
      console.log(
        `ICE gathering state for peer ${peerId}:`,
        connection.iceGatheringState
      );
    };
  }

  private setupDataChannelHandlers(
    dataChannel: RTCDataChannel,
    peerId: string
  ): void {
    dataChannel.onopen = () => {
      console.log(`Data channel opened for peer ${peerId}`);
      const state = this.connectionStates.get(peerId);
      if (state) {
        state.dataChannel = dataChannel;
      }
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed for peer ${peerId}`);
    };

    dataChannel.onerror = error => {
      console.error(`Data channel error for peer ${peerId}:`, error);
    };

    dataChannel.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        console.log(`Message received from peer ${peerId}:`, message);

        // Emit data received event for the message handler to process
        this.eventBus.emit({
          type: 'data-received',
          peerId,
          data: event.data,
        });
      } catch (error) {
        console.error(`Failed to parse message from peer ${peerId}:`, error);
      }
    };
  }

  private async handleConnectionFailure(peerId: string): Promise<void> {
    const state = this.connectionStates.get(peerId);
    if (!state) return;

    state.reconnectAttempts++;

    if (state.reconnectAttempts <= this.config.maxReconnectAttempts) {
      const delay = Math.min(
        this.config.reconnectDelay * Math.pow(2, state.reconnectAttempts - 1),
        30000 // Max 30 seconds
      );

      console.log(
        `Attempting to reconnect to peer ${peerId} in ${delay}ms (attempt ${state.reconnectAttempts})`
      );

      setTimeout(() => {
        this.attemptReconnection(peerId);
      }, delay);
    } else {
      console.log(`Max reconnection attempts reached for peer ${peerId}`);
      this.closeConnection(peerId);
    }
  }

  private async attemptReconnection(peerId: string): Promise<void> {
    const state = this.connectionStates.get(peerId);
    if (!state) return;

    try {
      // Close existing connection
      const oldConnection = this.connections.get(peerId);
      if (oldConnection) {
        oldConnection.close();
      }

      // Create new connection
      await this.createConnection(peerId, state.peer);
      console.log(`Reconnection attempt for peer ${peerId} initiated`);
    } catch (error) {
      console.error(`Reconnection failed for peer ${peerId}:`, error);
      this.handleConnectionFailure(peerId);
    }
  }
}
