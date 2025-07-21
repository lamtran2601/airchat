import {
  P2PConnectionManager,
  SignalingClient,
  MessageHandler,
  FileTransferManager,
  defaultP2PConfig,
} from '@p2p/core';
import type { P2PConfig, Message } from '../types/p2p';
import { useP2PStore } from '../stores/useP2PStore';

class P2PService {
  private connectionManager: P2PConnectionManager;
  private signalingClient: SignalingClient;
  private messageHandler: MessageHandler;
  private fileTransferManager: FileTransferManager;
  private config: P2PConfig;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;

  constructor(config?: Partial<P2PConfig>) {
    // Ensure signalingServer is always defined for compatibility
    const mergedConfig = { ...defaultP2PConfig, ...config };
    if (!mergedConfig.signalingServer) {
      mergedConfig.signalingServer = mergedConfig.signalingUrl;
    }
    this.config = mergedConfig as P2PConfig;
    this.connectionManager = new P2PConnectionManager(this.config);
    this.signalingClient = new SignalingClient(this.config);
    this.messageHandler = new MessageHandler(this.connectionManager);
    this.fileTransferManager = new FileTransferManager(
      this.connectionManager,
      this.config
    );

    this.setupEventHandlers();
  }

  // Initialize the service
  async initialize(userId: string, userName: string): Promise<void> {
    this.currentUserId = userId;
    this.currentUserName = userName;
    useP2PStore.getState().setCurrentUser(userId, userName);

    try {
      await this.signalingClient.connect(this.config.signalingServer);
      useP2PStore.getState().setConnected(true);
      console.log('P2P Service initialized successfully');

      // Add notification for successful connection
      useP2PStore.getState().addNotification({
        id: `init-success-${Date.now()}`,
        type: 'success',
        title: 'Connected',
        message: 'Successfully connected to P2P network',
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to initialize P2P Service:', error);

      // Add error notification
      useP2PStore.getState().addNotification({
        id: `init-error-${Date.now()}`,
        type: 'error',
        title: 'Connection Failed',
        message:
          'Failed to connect to P2P network. Please check your internet connection and try again.',
        timestamp: new Date(),
        autoClose: false,
        actions: [
          {
            label: 'Retry',
            action: () => this.initialize(userId, userName),
            variant: 'primary',
          },
        ],
      });

      useP2PStore.getState().setConnected(false);
      throw error;
    }
  }

  // Join a room
  async joinRoom(roomId: string): Promise<void> {
    try {
      useP2PStore.getState().setConnecting(true);
      await this.signalingClient.joinRoom(roomId);
      useP2PStore.getState().setCurrentRoomId(roomId);

      useP2PStore.getState().setConnecting(false);
      console.log(`Joined room ${roomId}`);
    } catch (error) {
      useP2PStore.getState().setConnecting(false);
      console.error('Failed to join room:', error);

      // Add error notification
      useP2PStore.getState().addNotification({
        id: `join-room-error-${Date.now()}`,
        type: 'error',
        title: 'Failed to Join Room',
        message: `Could not join room "${roomId}". Please check the room ID and try again.`,
        timestamp: new Date(),
        autoClose: false,
        actions: [
          {
            label: 'Retry',
            action: () => this.joinRoom(roomId),
            variant: 'primary',
          },
        ],
      });

      throw error;
    }
  }

  // Leave current room
  leaveRoom(): void {
    this.signalingClient.leaveRoom();
    this.connectionManager.closeAllConnections();
    useP2PStore.getState().setCurrentRoomId(null);
    useP2PStore.getState().reset();
  }

  // Send a message to a peer
  sendMessage(peerId: string, content: string, replyTo?: string): Message {
    const message = this.messageHandler.sendMessage(peerId, content, replyTo);

    // Update the message with current user ID
    message.senderId = this.currentUserId || 'unknown';
    useP2PStore.getState().addMessage(message);

    return message;
  }

  // Send a message to all connected peers
  broadcastMessage(content: string): Message[] {
    const store = useP2PStore.getState();
    const connectedPeers = Array.from(store.peers.values()).filter(
      peer => store.connectionStates.get(peer.id)?.status === 'connected'
    );

    return connectedPeers.map(peer => this.sendMessage(peer.id, content));
  }

  // Initiate file transfer
  initiateFileTransfer(file: File, receiverId: string): void {
    const transfer = this.fileTransferManager.sendFile(
      receiverId,
      file,
      (progress: number) => {
        useP2PStore.getState().updateFileTransfer(transfer.id, { progress });
      }
    );

    useP2PStore.getState().addFileTransfer(transfer);
  }

  // Accept file transfer
  acceptFileTransfer(transferId: string): void {
    this.fileTransferManager.acceptFileTransfer(transferId);
  }

  // Reject file transfer
  rejectFileTransfer(transferId: string): void {
    this.fileTransferManager.rejectFileTransfer(transferId);
    useP2PStore.getState().removeFileTransfer(transferId);
  }

  // Get connection status
  getConnectionStatus(): boolean {
    return this.signalingClient.getIsConnected();
  }

  // Disconnect
  disconnect(): void {
    this.signalingClient.disconnect();
    this.connectionManager.closeAllConnections();
    useP2PStore.getState().reset();
  }

  // Create a peer connection and send offer
  private async createPeerConnection(peerId: string): Promise<void> {
    try {
      const connection = await this.connectionManager.createConnection(peerId);

      // Create data channel for outgoing connections
      const dataChannel = this.connectionManager.createDataChannel(
        peerId,
        'data'
      );

      if (dataChannel) {
        dataChannel.onopen = () => {
          console.log('Outgoing data channel opened for', peerId);
        };
      }

      // Create and send offer
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      this.signalingClient.sendOffer(peerId, offer);

      console.log('Created peer connection and sent offer to', peerId);
    } catch (error) {
      console.error('Failed to create peer connection for', peerId, error);
    }
  }

  // Attempt to reconnect to the signaling server
  async reconnect(): Promise<void> {
    if (!this.currentUserId || !this.currentUserName) {
      throw new Error('Cannot reconnect: user not initialized');
    }

    try {
      useP2PStore.getState().setConnecting(true);
      await this.signalingClient.connect(this.config.signalingServer);
      useP2PStore.getState().setConnected(true);
      useP2PStore.getState().setConnecting(false);

      // Rejoin current room if we were in one
      const currentRoomId = useP2PStore.getState().currentRoomId;
      if (currentRoomId) {
        await this.joinRoom(currentRoomId);
      }

      useP2PStore.getState().addNotification({
        id: `reconnect-success-${Date.now()}`,
        type: 'success',
        title: 'Reconnected',
        message: 'Successfully reconnected to P2P network',
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    } catch (error) {
      useP2PStore.getState().setConnecting(false);
      useP2PStore.getState().setConnected(false);

      useP2PStore.getState().addNotification({
        id: `reconnect-error-${Date.now()}`,
        type: 'error',
        title: 'Reconnection Failed',
        message: 'Failed to reconnect to P2P network. Please try again.',
        timestamp: new Date(),
        autoClose: false,
        actions: [
          {
            label: 'Retry',
            action: () => this.reconnect(),
            variant: 'primary',
          },
        ],
      });

      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Connection manager events
    this.connectionManager.on('peer-connected', (event: any) => {
      const store = useP2PStore.getState();
      store.addPeer(event.peer);
      store.addNotification({
        id: `peer-connected-${event.peer.id}`,
        type: 'success',
        title: 'Peer Connected',
        message: `Connected to ${event.peer.name || event.peer.id}`,
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    });

    this.connectionManager.on('peer-disconnected', (event: any) => {
      const store = useP2PStore.getState();
      store.removePeer(event.peer.id);
      store.addNotification({
        id: `peer-disconnected-${event.peer.id}`,
        type: 'warning',
        title: 'Peer Disconnected',
        message: `${event.peer.name || event.peer.id} disconnected`,
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    });

    this.connectionManager.on('connection-state-changed', (event: any) => {
      useP2PStore
        .getState()
        .updateConnectionState(event.state.peer.id, event.state);
    });

    // Data received from connection manager - forward to message handler
    this.connectionManager.on('data-received', (event: any) => {
      this.messageHandler.handleReceivedMessage(event.peerId, event.data);
    });

    // Handle ICE candidates from connection manager
    this.connectionManager.on('ice-candidate', (event: any) => {
      this.signalingClient.sendIceCandidate(event.peerId, event.candidate);
    });

    // Message handler events
    this.messageHandler.on('message-received', (event: any) => {
      useP2PStore.getState().addMessage(event.message);
    });

    // File transfer events
    this.fileTransferManager.on('file-transfer-request', (event: any) => {
      useP2PStore.getState().addFileTransfer(event.transfer);
      useP2PStore.getState().addNotification({
        id: `file-transfer-${event.transfer.id}`,
        type: 'info',
        title: 'File Transfer Request',
        message: `${event.transfer.fileName} from ${event.transfer.senderId}`,
        timestamp: new Date(),
        autoClose: false,
      });
    });

    this.fileTransferManager.on('file-transfer-progress', (event: any) => {
      useP2PStore.getState().updateFileTransfer(event.transferId, {
        progress: event.progress,
        status: 'transferring',
      });
    });

    this.fileTransferManager.on('file-transfer-accepted', (event: any) => {
      useP2PStore.getState().updateFileTransfer(event.transferId, {
        status: 'accepted',
      });
      useP2PStore.getState().addNotification({
        id: `transfer-accepted-${event.transferId}`,
        type: 'success',
        title: 'File Transfer Accepted',
        message: 'The recipient accepted your file transfer',
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    });

    this.fileTransferManager.on('file-transfer-rejected', (event: any) => {
      useP2PStore.getState().updateFileTransfer(event.transferId, {
        status: 'rejected',
      });
      useP2PStore.getState().addNotification({
        id: `transfer-rejected-${event.transferId}`,
        type: 'warning',
        title: 'File Transfer Rejected',
        message: 'The recipient rejected your file transfer',
        timestamp: new Date(),
        autoClose: true,
        duration: 5000,
      });
    });

    this.fileTransferManager.on('file-transfer-completed', (event: any) => {
      useP2PStore.getState().updateFileTransfer(event.transferId, {
        status: 'completed',
        progress: 100,
      });
      useP2PStore.getState().addNotification({
        id: `transfer-completed-${event.transferId}`,
        type: 'success',
        title: 'File Transfer Complete',
        message: 'File transfer completed successfully',
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    });

    this.fileTransferManager.on('file-transfer-failed', (event: any) => {
      useP2PStore.getState().updateFileTransfer(event.transferId, {
        status: 'failed',
        error: event.error,
      });
      useP2PStore.getState().addNotification({
        id: `transfer-failed-${event.transferId}`,
        type: 'error',
        title: 'File Transfer Failed',
        message: `File transfer failed: ${event.error}`,
        timestamp: new Date(),
        autoClose: false,
        actions: [
          {
            label: 'Retry',
            action: () => {
              // In a real implementation, we'd retry the transfer
              console.log('Retry file transfer:', event.transferId);
            },
            variant: 'primary',
          },
        ],
      });
    });

    this.fileTransferManager.on('file-transfer-cancelled', (event: any) => {
      useP2PStore.getState().updateFileTransfer(event.transferId, {
        status: 'cancelled',
      });
      useP2PStore.getState().addNotification({
        id: `transfer-cancelled-${event.transferId}`,
        type: 'info',
        title: 'File Transfer Cancelled',
        message: 'File transfer was cancelled',
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    });

    // Signaling events (WebRTC negotiation)
    this.signalingClient.on('peer-joined' as any, async (event: any) => {
      const { peerId } = event;
      console.log(`Handling peer-joined event for peer ${peerId}`);
      // When a new peer joins, existing peers should create connections to them
      await this.createPeerConnection(peerId);
    });

    this.signalingClient.on('offer-received' as any, async (event: any) => {
      const { senderId, offer } = event;
      try {
        // Log peer connection for debugging
        console.log('Peer connecting:', senderId);
        const connection =
          await this.connectionManager.createConnection(senderId);

        // Set up data channel for incoming connections
        connection.ondatachannel = event => {
          const dataChannel = event.channel;
          console.log('Data channel received from', senderId);

          dataChannel.onopen = () => {
            console.log('Incoming data channel opened for', senderId);
            this.connectionManager.emit('data-channel-open', {
              peerId: senderId,
            });
          };

          dataChannel.onmessage = messageEvent => {
            this.connectionManager.emit('data-received', {
              peerId: senderId,
              data: messageEvent.data,
            });
          };
        };

        await connection.setRemoteDescription(offer);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        this.signalingClient.sendAnswer(senderId, answer);
      } catch (error) {
        console.error('Failed to handle offer:', error);
      }
    });

    this.signalingClient.on('answer-received' as any, async (event: any) => {
      const { senderId, answer } = event;
      const state = this.connectionManager.getConnectionState(senderId);
      if (state?.connection) {
        try {
          await state.connection.setRemoteDescription(answer);
        } catch (error) {
          console.error('Failed to handle answer:', error);
        }
      }
    });

    this.signalingClient.on(
      'ice-candidate-received' as any,
      async (event: any) => {
        const { senderId, candidate } = event;
        const state = this.connectionManager.getConnectionState(senderId);
        if (state?.connection) {
          try {
            await state.connection.addIceCandidate(candidate);
          } catch (error) {
            console.error('Failed to handle ICE candidate:', error);
          }
        }
      }
    );
  }
}

// Export singleton instance
export const p2pService = new P2PService({
  signalingServer:
    (import.meta as any).env?.VITE_SIGNALING_URL || 'http://localhost:4000',
});

export default P2PService;
