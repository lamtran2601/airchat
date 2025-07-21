import { vi } from 'vitest';
import type {
  P2PConfig,
  PeerInfo,
  Message,
  ConnectionState,
} from '../types/p2p';

// Mock EventBus with proper event emitter
export const mockEventBus = {
  on: vi.fn((event: string, handler: Function) => {
    if (!mockEventBus._handlers) {
      mockEventBus._handlers = new Map();
    }
    if (!mockEventBus._handlers.has(event)) {
      mockEventBus._handlers.set(event, []);
    }
    mockEventBus._handlers.get(event).push(handler);
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, data: any) => {
    if (mockEventBus._handlers?.has(event)) {
      mockEventBus._handlers.get(event).forEach((handler: Function) => {
        handler(data);
      });
    }
  }),
  removeAllListeners: vi.fn(),
  _handlers: new Map(),
};

// Mock P2PConnectionManager with proper event emitter
export const mockP2PConnectionManager = {
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
  closeAllConnections: vi.fn(),
  sendData: vi.fn(),
  createDataChannel: vi.fn(),
  getConnectionState: vi.fn(),
  on: vi.fn((event: string, handler: Function) => {
    // Store handlers for later triggering in tests
    if (!mockP2PConnectionManager._handlers) {
      mockP2PConnectionManager._handlers = new Map();
    }
    if (!mockP2PConnectionManager._handlers.has(event)) {
      mockP2PConnectionManager._handlers.set(event, []);
    }
    mockP2PConnectionManager._handlers.get(event).push(handler);
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, data: any) => {
    if (mockP2PConnectionManager._handlers?.has(event)) {
      mockP2PConnectionManager._handlers
        .get(event)
        .forEach((handler: Function) => {
          handler(data);
        });
    }
  }),
  removeAllListeners: vi.fn(),
  _handlers: new Map(), // Internal storage for event handlers
};

// Mock SignalingClient with proper event emitter
export const mockSignalingClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendOffer: vi.fn(),
  sendAnswer: vi.fn(),
  sendIceCandidate: vi.fn(),
  getIsConnected: vi.fn(),
  on: vi.fn((event: string, handler: Function) => {
    if (!mockSignalingClient._handlers) {
      mockSignalingClient._handlers = new Map();
    }
    if (!mockSignalingClient._handlers.has(event)) {
      mockSignalingClient._handlers.set(event, []);
    }
    mockSignalingClient._handlers.get(event).push(handler);
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, data: any) => {
    if (mockSignalingClient._handlers?.has(event)) {
      mockSignalingClient._handlers.get(event).forEach((handler: Function) => {
        handler(data);
      });
    }
  }),
  removeAllListeners: vi.fn(),
  _handlers: new Map(),
};

// Mock MessageHandler with proper event emitter
export const mockMessageHandler = {
  sendMessage: vi.fn(),
  handleReceivedMessage: vi.fn(),
  on: vi.fn((event: string, handler: Function) => {
    if (!mockMessageHandler._handlers) {
      mockMessageHandler._handlers = new Map();
    }
    if (!mockMessageHandler._handlers.has(event)) {
      mockMessageHandler._handlers.set(event, []);
    }
    mockMessageHandler._handlers.get(event).push(handler);
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, data: any) => {
    if (mockMessageHandler._handlers?.has(event)) {
      mockMessageHandler._handlers.get(event).forEach((handler: Function) => {
        handler(data);
      });
    }
  }),
  removeAllListeners: vi.fn(),
  _handlers: new Map(),
};

// Mock FileTransferManager with proper event emitter
export const mockFileTransferManager = {
  initiateTransfer: vi.fn(),
  acceptTransfer: vi.fn(),
  rejectTransfer: vi.fn(),
  cancelTransfer: vi.fn(),
  on: vi.fn((event: string, handler: Function) => {
    if (!mockFileTransferManager._handlers) {
      mockFileTransferManager._handlers = new Map();
    }
    if (!mockFileTransferManager._handlers.has(event)) {
      mockFileTransferManager._handlers.set(event, []);
    }
    mockFileTransferManager._handlers.get(event).push(handler);
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, data: any) => {
    if (mockFileTransferManager._handlers?.has(event)) {
      mockFileTransferManager._handlers
        .get(event)
        .forEach((handler: Function) => {
          handler(data);
        });
    }
  }),
  removeAllListeners: vi.fn(),
  _handlers: new Map(),
};

// Mock default config
export const mockDefaultP2PConfig: P2PConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  signalingUrl: 'http://localhost:4000',
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  chunkSize: 16384,
  maxFileSize: 100 * 1024 * 1024,
};

// Mock implementations
vi.mock('../../services/p2p-core-stubs', () => ({
  P2PConnectionManager: vi.fn().mockImplementation(() => {
    // Override specific methods while preserving the event emitter functionality
    mockP2PConnectionManager.createConnection = vi.fn().mockResolvedValue({
      createOffer: vi
        .fn()
        .mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
      createAnswer: vi
        .fn()
        .mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
      setLocalDescription: vi.fn().mockResolvedValue(undefined),
      setRemoteDescription: vi.fn().mockResolvedValue(undefined),
      addIceCandidate: vi.fn().mockResolvedValue(undefined),
    });
    mockP2PConnectionManager.getConnectionState = vi.fn().mockReturnValue({
      connection: {
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
      },
    });
    return mockP2PConnectionManager;
  }),
  SignalingClient: vi.fn().mockImplementation(() => {
    mockSignalingClient.connect = vi.fn().mockResolvedValue(undefined);
    mockSignalingClient.joinRoom = vi.fn().mockResolvedValue([]);
    mockSignalingClient.getIsConnected = vi.fn().mockReturnValue(true);
    return mockSignalingClient;
  }),
  MessageHandler: vi.fn().mockImplementation(() => {
    mockMessageHandler.sendMessage = vi.fn().mockReturnValue({
      id: 'mock-message-id',
      senderId: 'temp-id',
      content: 'mock content',
      timestamp: new Date(),
      type: 'text',
    });
    return mockMessageHandler;
  }),
  FileTransferManager: vi.fn().mockImplementation(() => {
    mockFileTransferManager.initiateTransfer = vi.fn().mockReturnValue({
      id: 'mock-transfer-id',
      fileName: 'mock-file.txt',
      fileSize: 1024,
      senderId: 'user-123',
      receiverId: 'peer-1',
      status: 'pending',
      progress: 0,
      timestamp: new Date(),
    });
    return mockFileTransferManager;
  }),
  EventBus: vi.fn().mockImplementation(() => mockEventBus),
  defaultP2PConfig: mockDefaultP2PConfig,
}));

// Helper functions for tests
export const createMockPeerInfo = (
  overrides?: Partial<PeerInfo>
): PeerInfo => ({
  id: 'mock-peer-id',
  status: 'online',
  name: 'Mock Peer',
  ...overrides,
});

export const createMockMessage = (overrides?: Partial<Message>): Message => ({
  id: 'mock-message-id',
  senderId: 'mock-sender-id',
  content: 'Mock message content',
  timestamp: new Date(),
  type: 'text',
  status: 'sent',
  ...overrides,
});

export const createMockConnectionState = (
  overrides?: Partial<ConnectionState>
): ConnectionState => ({
  peer: createMockPeerInfo(),
  status: 'connected',
  connection: undefined,
  dataChannel: undefined,
  lastActivity: new Date(),
  ...overrides,
});

// Reset all mocks
export const resetP2PMocks = () => {
  // Reset event handlers
  mockEventBus._handlers.clear();
  mockP2PConnectionManager._handlers.clear();
  mockSignalingClient._handlers.clear();
  mockMessageHandler._handlers.clear();
  mockFileTransferManager._handlers.clear();

  // Reset mock functions
  Object.values(mockP2PConnectionManager).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockSignalingClient).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockMessageHandler).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockFileTransferManager).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockEventBus).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });
};
