import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the P2P core stubs directly in the test
vi.mock('../services/p2p-core-stubs', () => {
  const mockConnectionManager = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    createConnection: vi.fn(),
    closeConnection: vi.fn(),
    closeAllConnections: vi.fn(),
    sendData: vi.fn(),
    createDataChannel: vi.fn(),
    getConnectionState: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  const mockSignalingClient = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIceCandidate: vi.fn(),
    getIsConnected: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  const mockMessageHandler = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    sendMessage: vi.fn(),
    handleReceivedMessage: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  const mockFileTransferManager = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    initiateTransfer: vi.fn(),
    acceptTransfer: vi.fn(),
    rejectTransfer: vi.fn(),
    cancelTransfer: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return {
    P2PConnectionManager: vi
      .fn()
      .mockImplementation(() => mockConnectionManager),
    SignalingClient: vi.fn().mockImplementation(() => mockSignalingClient),
    MessageHandler: vi.fn().mockImplementation(() => mockMessageHandler),
    FileTransferManager: vi
      .fn()
      .mockImplementation(() => mockFileTransferManager),
    defaultP2PConfig: {
      signalingServer: 'ws://localhost:4000',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      connectionTimeout: 30000,
      heartbeatInterval: 5000,
      maxRetries: 3,
      chunkSize: 16384,
    },
  };
});

// Now import the service after mocks are set up
import P2PService, { p2pService } from '../services/P2PService';
import { useP2PStore } from '../stores/useP2PStore';

// Mock the store
vi.mock('../stores/useP2PStore', () => ({
  useP2PStore: {
    getState: vi.fn(),
  },
}));

describe('P2PService', () => {
  let service: P2PService;
  let mockStoreState: any;
  let mockStoreActions: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStoreActions = {
      setCurrentUser: vi.fn(),
      setConnected: vi.fn(),
      setConnecting: vi.fn(),
      setCurrentRoomId: vi.fn(),
      addPeer: vi.fn(),
      removePeer: vi.fn(),
      addMessage: vi.fn(),
      addFileTransfer: vi.fn(),
      removeFileTransfer: vi.fn(),
      updateFileTransfer: vi.fn(),
      addNotification: vi.fn(),
      updateConnectionState: vi.fn(),
      reset: vi.fn(),
    };

    mockStoreState = {
      peers: new Map(),
      connectionStates: new Map(),
      ...mockStoreActions,
    };

    vi.mocked(useP2PStore.getState).mockReturnValue(mockStoreState);

    service = new P2PService({
      signalingUrl: 'http://localhost:4000',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with default config', () => {
      const newService = new P2PService();
      expect(newService).toBeDefined();
    });

    it('merges custom config with defaults', () => {
      const customConfig = {
        signalingUrl: 'http://custom-server.com',
        maxReconnectAttempts: 5,
      };

      const newService = new P2PService(customConfig);
      expect(newService).toBeDefined();
    });

    it('sets up event handlers', () => {
      expect(mockP2PConnectionManager.on).toHaveBeenCalledWith(
        'peer-connected',
        expect.any(Function)
      );
      expect(mockP2PConnectionManager.on).toHaveBeenCalledWith(
        'peer-disconnected',
        expect.any(Function)
      );
      expect(mockP2PConnectionManager.on).toHaveBeenCalledWith(
        'connection-state-changed',
        expect.any(Function)
      );
      expect(mockP2PConnectionManager.on).toHaveBeenCalledWith(
        'data-received',
        expect.any(Function)
      );
      expect(mockMessageHandler.on).toHaveBeenCalledWith(
        'message-received',
        expect.any(Function)
      );
      expect(mockFileTransferManager.on).toHaveBeenCalledWith(
        'file-transfer-request',
        expect.any(Function)
      );
      expect(mockFileTransferManager.on).toHaveBeenCalledWith(
        'file-transfer-progress',
        expect.any(Function)
      );
    });
  });

  describe('initialize', () => {
    it('successfully initializes service', async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);

      await service.initialize('user-123', 'Test User');

      expect(mockStoreActions.setCurrentUser).toHaveBeenCalledWith(
        'user-123',
        'Test User'
      );
      expect(mockSignalingClient.connect).toHaveBeenCalled();
      expect(mockStoreActions.setConnected).toHaveBeenCalledWith(true);
    });

    it('handles initialization failure', async () => {
      const error = new Error('Connection failed');
      mockSignalingClient.connect.mockRejectedValue(error);

      await expect(service.initialize('user-123', 'Test User')).rejects.toThrow(
        'Connection failed'
      );
      expect(mockStoreActions.setConnected).not.toHaveBeenCalledWith(true);
    });
  });

  describe('joinRoom', () => {
    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');
    });

    it('successfully joins room with existing peers', async () => {
      const existingPeers = ['peer-1', 'peer-2'];
      mockSignalingClient.joinRoom.mockResolvedValue(existingPeers);
      mockP2PConnectionManager.createConnection.mockResolvedValue({
        createOffer: vi
          .fn()
          .mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
      });

      await service.joinRoom('TEST123');

      expect(mockStoreActions.setConnecting).toHaveBeenCalledWith(true);
      expect(mockSignalingClient.joinRoom).toHaveBeenCalledWith('TEST123');
      expect(mockStoreActions.setCurrentRoomId).toHaveBeenCalledWith('TEST123');
      expect(mockP2PConnectionManager.createConnection).toHaveBeenCalledTimes(
        2
      );
      expect(mockStoreActions.setConnecting).toHaveBeenCalledWith(false);
    });

    it('handles room join failure', async () => {
      const error = new Error('Room join failed');
      mockSignalingClient.joinRoom.mockRejectedValue(error);

      await expect(service.joinRoom('TEST123')).rejects.toThrow(
        'Room join failed'
      );
      expect(mockStoreActions.setConnecting).toHaveBeenCalledWith(true);
      expect(mockStoreActions.setConnecting).toHaveBeenCalledWith(false);
    });

    it('creates peer connections for existing peers', async () => {
      const existingPeers = ['peer-1'];
      mockSignalingClient.joinRoom.mockResolvedValue(existingPeers);

      const mockConnection = {
        createOffer: vi
          .fn()
          .mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
      };
      mockP2PConnectionManager.createConnection.mockResolvedValue(
        mockConnection
      );

      await service.joinRoom('TEST123');

      expect(mockP2PConnectionManager.createConnection).toHaveBeenCalledWith(
        'peer-1',
        expect.objectContaining({ id: 'peer-1', status: 'connecting' })
      );
      expect(mockP2PConnectionManager.createDataChannel).toHaveBeenCalledWith(
        'peer-1'
      );
      expect(mockSignalingClient.sendOffer).toHaveBeenCalledWith('peer-1', {
        type: 'offer',
        sdp: 'mock-sdp',
      });
    });
  });

  describe('leaveRoom', () => {
    it('leaves room and cleans up connections', () => {
      service.leaveRoom();

      expect(mockSignalingClient.leaveRoom).toHaveBeenCalled();
      expect(mockP2PConnectionManager.closeAllConnections).toHaveBeenCalled();
      expect(mockStoreActions.setCurrentRoomId).toHaveBeenCalledWith(null);
      expect(mockStoreActions.reset).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');
    });

    it('sends message to specific peer', () => {
      const mockMessage = {
        id: 'msg-123',
        senderId: 'temp-id',
        content: 'Test message',
        timestamp: new Date(),
        type: 'text' as const,
      };

      mockMessageHandler.sendMessage.mockReturnValue(mockMessage);

      const result = service.sendMessage('peer-1', 'Test message');

      expect(mockMessageHandler.sendMessage).toHaveBeenCalledWith(
        'peer-1',
        'Test message',
        expect.any(Function),
        undefined
      );
      expect(result.senderId).toBe('user-123');
      expect(mockStoreActions.addMessage).toHaveBeenCalledWith(result);
    });

    it('sends message with reply reference', () => {
      const mockMessage = {
        id: 'msg-123',
        senderId: 'temp-id',
        content: 'Reply message',
        timestamp: new Date(),
        type: 'text' as const,
      };

      mockMessageHandler.sendMessage.mockReturnValue(mockMessage);

      service.sendMessage('peer-1', 'Reply message', 'original-msg-id');

      expect(mockMessageHandler.sendMessage).toHaveBeenCalledWith(
        'peer-1',
        'Reply message',
        expect.any(Function),
        'original-msg-id'
      );
    });
  });

  describe('broadcastMessage', () => {
    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');
    });

    it('broadcasts message to all connected peers', () => {
      const connectedPeers = new Map([
        ['peer-1', { id: 'peer-1', status: 'connected' }],
        ['peer-2', { id: 'peer-2', status: 'connected' }],
      ]);

      const connectionStates = new Map([
        ['peer-1', { status: 'connected' }],
        ['peer-2', { status: 'connected' }],
      ]);

      mockStoreState.peers = connectedPeers;
      mockStoreState.connectionStates = connectionStates;

      const mockMessage = {
        id: 'msg-123',
        senderId: 'temp-id',
        content: 'Broadcast message',
        timestamp: new Date(),
        type: 'text' as const,
      };

      mockMessageHandler.sendMessage.mockReturnValue(mockMessage);

      const results = service.broadcastMessage('Broadcast message');

      expect(results).toHaveLength(2);
      expect(mockMessageHandler.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('only sends to connected peers', () => {
      const peers = new Map([
        ['peer-1', { id: 'peer-1', status: 'connected' }],
        ['peer-2', { id: 'peer-2', status: 'connecting' }],
      ]);

      const connectionStates = new Map([
        ['peer-1', { status: 'connected' }],
        ['peer-2', { status: 'connecting' }],
      ]);

      mockStoreState.peers = peers;
      mockStoreState.connectionStates = connectionStates;

      const mockMessage = {
        id: 'msg-123',
        senderId: 'temp-id',
        content: 'Broadcast message',
        timestamp: new Date(),
        type: 'text' as const,
      };

      mockMessageHandler.sendMessage.mockReturnValue(mockMessage);

      const results = service.broadcastMessage('Broadcast message');

      expect(results).toHaveLength(1);
      expect(mockMessageHandler.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('file transfer operations', () => {
    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');
    });

    it('initiates file transfer', () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const mockTransfer = {
        id: 'transfer-123',
        fileName: 'test.txt',
        fileSize: 4,
        senderId: 'user-123',
        receiverId: 'peer-1',
        status: 'pending' as const,
        progress: 0,
        timestamp: new Date(),
      };

      mockFileTransferManager.initiateTransfer.mockReturnValue(mockTransfer);

      service.initiateFileTransfer(mockFile, 'peer-1');

      expect(mockFileTransferManager.initiateTransfer).toHaveBeenCalledWith(
        mockFile,
        'peer-1',
        expect.any(Function)
      );
      expect(mockStoreActions.addFileTransfer).toHaveBeenCalledWith(
        mockTransfer
      );
    });

    it('accepts file transfer', () => {
      service.acceptFileTransfer('transfer-123');

      expect(mockFileTransferManager.acceptTransfer).toHaveBeenCalledWith(
        'transfer-123',
        expect.any(Function)
      );
    });

    it('rejects file transfer', () => {
      service.rejectFileTransfer('transfer-123');

      expect(mockFileTransferManager.rejectTransfer).toHaveBeenCalledWith(
        'transfer-123',
        expect.any(Function)
      );
      expect(mockStoreActions.removeFileTransfer).toHaveBeenCalledWith(
        'transfer-123'
      );
    });
  });

  describe('connection status', () => {
    it('returns connection status', () => {
      mockSignalingClient.getIsConnected.mockReturnValue(true);

      const status = service.getConnectionStatus();

      expect(status).toBe(true);
      expect(mockSignalingClient.getIsConnected).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('disconnects and resets state', () => {
      service.disconnect();

      expect(mockSignalingClient.disconnect).toHaveBeenCalled();
      expect(mockP2PConnectionManager.closeAllConnections).toHaveBeenCalled();
      expect(mockStoreActions.reset).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    let peerConnectedHandler: Function;
    let peerDisconnectedHandler: Function;
    let connectionStateChangedHandler: Function;
    let dataReceivedHandler: Function;
    let messageReceivedHandler: Function;
    let fileTransferRequestHandler: Function;
    let fileTransferProgressHandler: Function;

    beforeEach(() => {
      // Extract event handlers from mock calls
      const connectionManagerCalls = mockP2PConnectionManager.on.mock.calls;
      peerConnectedHandler = connectionManagerCalls.find(
        call => call[0] === 'peer-connected'
      )[1];
      peerDisconnectedHandler = connectionManagerCalls.find(
        call => call[0] === 'peer-disconnected'
      )[1];
      connectionStateChangedHandler = connectionManagerCalls.find(
        call => call[0] === 'connection-state-changed'
      )[1];
      dataReceivedHandler = connectionManagerCalls.find(
        call => call[0] === 'data-received'
      )[1];

      const messageHandlerCalls = mockMessageHandler.on.mock.calls;
      messageReceivedHandler = messageHandlerCalls.find(
        call => call[0] === 'message-received'
      )[1];

      const fileTransferCalls = mockFileTransferManager.on.mock.calls;
      fileTransferRequestHandler = fileTransferCalls.find(
        call => call[0] === 'file-transfer-request'
      )[1];
      fileTransferProgressHandler = fileTransferCalls.find(
        call => call[0] === 'file-transfer-progress'
      )[1];
    });

    it('handles peer connected event', () => {
      const peerInfo = { id: 'peer-1', name: 'Test Peer', status: 'connected' };

      peerConnectedHandler({ peer: peerInfo });

      expect(mockStoreActions.addPeer).toHaveBeenCalledWith(peerInfo);
      expect(mockStoreActions.addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Peer Connected',
          message: 'Connected to Test Peer',
        })
      );
    });

    it('handles peer disconnected event', () => {
      const peerInfo = {
        id: 'peer-1',
        name: 'Test Peer',
        status: 'disconnected',
      };

      peerDisconnectedHandler({ peer: peerInfo });

      expect(mockStoreActions.removePeer).toHaveBeenCalledWith('peer-1');
      expect(mockStoreActions.addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Peer Disconnected',
          message: 'Test Peer disconnected',
        })
      );
    });

    it('handles connection state changed event', () => {
      const connectionState = {
        peer: { id: 'peer-1' },
        status: 'connected',
        connection: null,
        dataChannel: null,
        lastActivity: new Date(),
      };

      connectionStateChangedHandler({ state: connectionState });

      expect(mockStoreActions.updateConnectionState).toHaveBeenCalledWith(
        'peer-1',
        connectionState
      );
    });

    it('handles data received event', () => {
      const eventData = {
        peerId: 'peer-1',
        data: { type: 'message', content: 'Hello' },
      };

      dataReceivedHandler(eventData);

      expect(mockMessageHandler.handleReceivedMessage).toHaveBeenCalledWith(
        'peer-1',
        eventData.data
      );
    });

    it('handles message received event', () => {
      const message = {
        id: 'msg-123',
        senderId: 'peer-1',
        content: 'Hello',
        timestamp: new Date(),
        type: 'text',
      };

      messageReceivedHandler({ message });

      expect(mockStoreActions.addMessage).toHaveBeenCalledWith(message);
    });

    it('handles file transfer request event', () => {
      const transfer = {
        id: 'transfer-123',
        fileName: 'test.txt',
        fileSize: 1024,
        senderId: 'peer-1',
        receiverId: 'user-123',
        status: 'pending',
        progress: 0,
        timestamp: new Date(),
      };

      fileTransferRequestHandler({ transfer });

      expect(mockStoreActions.addFileTransfer).toHaveBeenCalledWith(transfer);
      expect(mockStoreActions.addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'File Transfer Request',
          message: 'test.txt from peer-1',
        })
      );
    });

    it('handles file transfer progress event', () => {
      const progressData = { transferId: 'transfer-123', progress: 50 };

      fileTransferProgressHandler(progressData);

      expect(mockStoreActions.updateFileTransfer).toHaveBeenCalledWith(
        'transfer-123',
        { progress: 50 }
      );
    });
  });

  describe('signaling events', () => {
    let peerJoinedHandler: Function;
    let offerReceivedHandler: Function;
    let answerReceivedHandler: Function;
    let iceCandidateReceivedHandler: Function;

    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');

      // Extract signaling event handlers
      const signalingCalls = mockSignalingClient.on.mock.calls;
      peerJoinedHandler = signalingCalls.find(
        call => call[0] === 'peer-joined'
      )[1];
      offerReceivedHandler = signalingCalls.find(
        call => call[0] === 'offer-received'
      )[1];
      answerReceivedHandler = signalingCalls.find(
        call => call[0] === 'answer-received'
      )[1];
      iceCandidateReceivedHandler = signalingCalls.find(
        call => call[0] === 'ice-candidate-received'
      )[1];
    });

    it('handles peer joined event', async () => {
      const mockConnection = {
        createOffer: vi
          .fn()
          .mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
      };
      mockP2PConnectionManager.createConnection.mockResolvedValue(
        mockConnection
      );

      await peerJoinedHandler({ peerId: 'new-peer' });

      expect(mockP2PConnectionManager.createConnection).toHaveBeenCalledWith(
        'new-peer',
        expect.objectContaining({ id: 'new-peer', status: 'connecting' })
      );
    });

    it('handles offer received event', async () => {
      const offer = { type: 'offer', sdp: 'mock-offer-sdp' };
      const mockConnection = {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        createAnswer: vi
          .fn()
          .mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
      };
      mockP2PConnectionManager.createConnection.mockResolvedValue(
        mockConnection
      );

      await offerReceivedHandler({ senderId: 'peer-1', offer });

      expect(mockP2PConnectionManager.createConnection).toHaveBeenCalled();
      expect(mockConnection.setRemoteDescription).toHaveBeenCalledWith(offer);
      expect(mockConnection.createAnswer).toHaveBeenCalled();
      expect(mockSignalingClient.sendAnswer).toHaveBeenCalledWith('peer-1', {
        type: 'answer',
        sdp: 'mock-answer-sdp',
      });
    });

    it('handles answer received event', async () => {
      const answer = { type: 'answer', sdp: 'mock-answer-sdp' };
      const mockConnection = {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      };

      mockP2PConnectionManager.getConnectionState.mockReturnValue({
        connection: mockConnection,
      });

      await answerReceivedHandler({ senderId: 'peer-1', answer });

      expect(mockConnection.setRemoteDescription).toHaveBeenCalledWith(answer);
    });

    it('handles ICE candidate received event', async () => {
      const candidate = { candidate: 'mock-candidate', sdpMLineIndex: 0 };
      const mockConnection = {
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
      };

      mockP2PConnectionManager.getConnectionState.mockReturnValue({
        connection: mockConnection,
      });

      await iceCandidateReceivedHandler({ senderId: 'peer-1', candidate });

      expect(mockConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });
  });

  describe('advanced P2P scenarios', () => {
    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');
    });

    it('handles multiple peer connections simultaneously', async () => {
      const peers = ['peer-1', 'peer-2', 'peer-3'];
      mockSignalingClient.joinRoom.mockResolvedValue(peers);

      const mockConnection = {
        createOffer: vi
          .fn()
          .mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
      };
      mockP2PConnectionManager.createConnection.mockResolvedValue(
        mockConnection
      );

      await service.joinRoom('TEST123');

      expect(mockP2PConnectionManager.createConnection).toHaveBeenCalledTimes(
        3
      );
      expect(mockSignalingClient.sendOffer).toHaveBeenCalledTimes(3);
    });

    it('handles peer disconnection during file transfer', async () => {
      // Set up file transfer
      const transfer = createTestFileTransfer({
        id: 'transfer-1',
        senderId: 'user-123',
        receiverId: 'peer-1',
        status: 'in-progress',
      });

      mockStoreState.fileTransfers = [transfer];

      // Simulate peer disconnection
      const peerDisconnectedHandler =
        mockP2PConnectionManager.on.mock.calls.find(
          call => call[0] === 'peer-disconnected'
        )[1];

      peerDisconnectedHandler({ peer: { id: 'peer-1', name: 'Peer 1' } });

      expect(mockStoreActions.removePeer).toHaveBeenCalledWith('peer-1');
      // File transfer should be cancelled or marked as failed
    });

    it('handles connection recovery after network interruption', async () => {
      // Simulate connection loss
      mockSignalingClient.getIsConnected.mockReturnValue(false);

      const status = service.getConnectionStatus();
      expect(status).toBe(false);

      // Simulate reconnection
      mockSignalingClient.getIsConnected.mockReturnValue(true);
      mockSignalingClient.connect.mockResolvedValue(undefined);

      await service.initialize('user-123', 'Test User');
      expect(mockStoreActions.setConnected).toHaveBeenCalledWith(true);
    });

    it('handles large file transfer with chunking', () => {
      const largeFile = new File(
        ['x'.repeat(10 * 1024 * 1024)],
        'large-file.txt',
        {
          type: 'text/plain',
        }
      );

      const mockTransfer = {
        id: 'large-transfer',
        fileName: 'large-file.txt',
        fileSize: 10 * 1024 * 1024,
        senderId: 'user-123',
        receiverId: 'peer-1',
        status: 'pending' as const,
        progress: 0,
        timestamp: new Date(),
      };

      mockFileTransferManager.initiateTransfer.mockReturnValue(mockTransfer);

      service.initiateFileTransfer(largeFile, 'peer-1');

      expect(mockFileTransferManager.initiateTransfer).toHaveBeenCalledWith(
        largeFile,
        'peer-1',
        expect.any(Function)
      );
      expect(mockStoreActions.addFileTransfer).toHaveBeenCalledWith(
        mockTransfer
      );
    });

    it('handles concurrent message sending to multiple peers', () => {
      const peers = new Map([
        ['peer-1', { id: 'peer-1', status: 'connected' }],
        ['peer-2', { id: 'peer-2', status: 'connected' }],
        ['peer-3', { id: 'peer-3', status: 'connected' }],
      ]);

      const connectionStates = new Map([
        ['peer-1', { status: 'connected' }],
        ['peer-2', { status: 'connected' }],
        ['peer-3', { status: 'connected' }],
      ]);

      mockStoreState.peers = peers;
      mockStoreState.connectionStates = connectionStates;

      const mockMessage = {
        id: 'msg-123',
        senderId: 'temp-id',
        content: 'Broadcast to all',
        timestamp: new Date(),
        type: 'text' as const,
      };

      mockMessageHandler.sendMessage.mockReturnValue(mockMessage);

      const results = service.broadcastMessage('Broadcast to all');

      expect(results).toHaveLength(3);
      expect(mockMessageHandler.sendMessage).toHaveBeenCalledTimes(3);
      expect(mockStoreActions.addMessage).toHaveBeenCalledTimes(3);
    });

    it('handles WebRTC connection state changes', () => {
      const connectionStateChangedHandler =
        mockP2PConnectionManager.on.mock.calls.find(
          call => call[0] === 'connection-state-changed'
        )[1];

      const connectionState = {
        peer: { id: 'peer-1' },
        status: 'connected' as const,
        connection: { connectionState: 'connected' },
        dataChannel: { readyState: 'open' },
        lastActivity: new Date(),
      };

      connectionStateChangedHandler({ state: connectionState });

      expect(mockStoreActions.updateConnectionState).toHaveBeenCalledWith(
        'peer-1',
        connectionState
      );
    });

    it('handles data channel message reception', () => {
      const dataReceivedHandler = mockP2PConnectionManager.on.mock.calls.find(
        call => call[0] === 'data-received'
      )[1];

      const messageData = {
        peerId: 'peer-1',
        data: {
          type: 'message',
          id: 'msg-123',
          content: 'Hello from peer!',
          timestamp: new Date().toISOString(),
        },
      };

      dataReceivedHandler(messageData);

      expect(mockMessageHandler.handleReceivedMessage).toHaveBeenCalledWith(
        'peer-1',
        messageData.data
      );
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(async () => {
      mockSignalingClient.connect.mockResolvedValue(undefined);
      await service.initialize('user-123', 'Test User');
    });

    it('handles signaling server disconnection gracefully', async () => {
      mockSignalingClient.getIsConnected.mockReturnValue(false);

      const status = service.getConnectionStatus();
      expect(status).toBe(false);

      // Should not crash when trying to send messages
      expect(() => {
        service.broadcastMessage('Test message');
      }).not.toThrow();
    });

    it('handles invalid file transfer requests', () => {
      expect(() => {
        service.acceptFileTransfer('non-existent-transfer');
      }).not.toThrow();

      expect(() => {
        service.rejectFileTransfer('non-existent-transfer');
      }).not.toThrow();
    });

    it('handles WebRTC connection failures', async () => {
      const mockConnection = {
        createOffer: vi.fn().mockRejectedValue(new Error('WebRTC error')),
      };
      mockP2PConnectionManager.createConnection.mockResolvedValue(
        mockConnection
      );

      // Should handle connection creation failure gracefully
      await expect(service.joinRoom('TEST123')).rejects.toThrow();
    });

    it('handles malformed signaling messages', async () => {
      const offerReceivedHandler = mockSignalingClient.on.mock.calls.find(
        call => call[0] === 'offer-received'
      )[1];

      // Should handle malformed offer gracefully
      expect(() => {
        offerReceivedHandler({ senderId: 'peer-1', offer: null });
      }).not.toThrow();

      expect(() => {
        offerReceivedHandler({
          senderId: null,
          offer: { type: 'offer', sdp: 'test' },
        });
      }).not.toThrow();
    });
  });
});
