import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MinimalSignaling } from '../lib/MinimalSignaling.js';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    id: 'mock-socket-id'
  }))
}));

describe('MinimalSignaling', () => {
  let signaling;
  let mockSocket;
  const serverUrl = 'http://localhost:4000';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock socket
    mockSocket = {
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
      id: 'mock-socket-id'
    };

    // Mock io to return our mock socket
    const { io } = await import('socket.io-client');
    io.mockReturnValue(mockSocket);

    signaling = new MinimalSignaling(serverUrl);
  });

  afterEach(() => {
    if (signaling) {
      signaling.disconnect();
    }
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(signaling.serverUrl).toBe(serverUrl);
      expect(signaling.socket).toBeNull();
      expect(signaling.room).toBeNull();
      expect(signaling.peerId).toBeNull();
      expect(signaling.eventEmitter).toBeInstanceOf(EventTarget);
    });
  });

  describe('connect', () => {
    it('should establish connection and resolve with peer ID', async () => {
      const connectPromise = signaling.connect();
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();

      const peerId = await connectPromise;
      expect(peerId).toBe('mock-socket-id');
      expect(signaling.peerId).toBe('mock-socket-id');
    });

    it('should reject on connection error', async () => {
      const connectPromise = signaling.connect();
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];
      const error = new Error('Connection failed');
      errorHandler(error);

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    it('should setup signaling handlers', async () => {
      signaling.connect();
      
      // Verify all expected event handlers are registered
      const expectedEvents = [
        'connect', 'connect_error', 'offer', 'answer', 'ice-candidate',
        'peer-joined', 'peer-left', 'room-participants', 'disconnect'
      ];
      
      expectedEvents.forEach(event => {
        expect(mockSocket.on).toHaveBeenCalledWith(event, expect.any(Function));
      });
    });
  });

  describe('joinRoom', () => {
    beforeEach(async () => {
      // Setup connected state
      const connectPromise = signaling.connect();
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
    });

    it('should join room when connected', async () => {
      const roomId = 'test-room';
      
      await signaling.joinRoom(roomId);
      
      expect(signaling.room).toBe(roomId);
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', roomId);
    });

    it('should throw error when not connected', async () => {
      mockSocket.connected = false;
      signaling.socket = null;
      
      await expect(signaling.joinRoom('test-room')).rejects.toThrow('Not connected to signaling server');
    });
  });

  describe('message sending', () => {
    beforeEach(async () => {
      // Setup connected state and room
      const connectPromise = signaling.connect();
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      await signaling.joinRoom('test-room');
    });

    it('should send offer', () => {
      const offer = { type: 'offer', sdp: 'test-sdp' };
      
      signaling.sendOffer(offer);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('offer', { room: 'test-room', offer });
    });

    it('should send answer', () => {
      const answer = { type: 'answer', sdp: 'test-sdp' };
      
      signaling.sendAnswer(answer);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('answer', { room: 'test-room', answer });
    });

    it('should send ICE candidate', () => {
      const candidate = { candidate: 'test-candidate' };
      
      signaling.sendIceCandidate(candidate);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ice-candidate', { room: 'test-room', candidate });
    });

    it('should throw error when not in room', () => {
      signaling.room = null;
      
      expect(() => signaling.sendOffer({})).toThrow('Not in a room');
      expect(() => signaling.sendAnswer({})).toThrow('Not in a room');
      expect(() => signaling.sendIceCandidate({})).toThrow('Not in a room');
    });
  });

  describe('event handling', () => {
    it('should emit events when received from socket', async () => {
      const eventSpy = vi.fn();
      signaling.on('peer-joined', eventSpy);
      
      signaling.connect();
      
      // Find and call the peer-joined handler
      const peerJoinedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'peer-joined')[1];
      const testData = { peerId: 'test-peer' };
      peerJoinedHandler(testData);
      
      expect(eventSpy).toHaveBeenCalledWith(testData);
    });

    it('should handle disconnect event', async () => {
      const disconnectSpy = vi.fn();
      signaling.on('disconnected', disconnectSpy);
      
      signaling.connect();
      
      // Find and call the disconnect handler
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should return connection status', () => {
      expect(signaling.isConnected()).toBe(false);
      
      signaling.socket = { connected: true };
      expect(signaling.isConnected()).toBe(true);
    });

    it('should return current room', () => {
      expect(signaling.getCurrentRoom()).toBeNull();
      
      signaling.room = 'test-room';
      expect(signaling.getCurrentRoom()).toBe('test-room');
    });

    it('should return peer ID', () => {
      expect(signaling.getPeerId()).toBeNull();
      
      signaling.peerId = 'test-peer-id';
      expect(signaling.getPeerId()).toBe('test-peer-id');
    });
  });

  describe('disconnect', () => {
    it('should clean up connection', () => {
      signaling.socket = mockSocket;
      signaling.room = 'test-room';
      signaling.peerId = 'test-peer';
      
      signaling.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(signaling.socket).toBeNull();
      expect(signaling.room).toBeNull();
      expect(signaling.peerId).toBeNull();
    });

    it('should handle disconnect when no socket', () => {
      signaling.socket = null;
      
      expect(() => signaling.disconnect()).not.toThrow();
    });
  });
});
