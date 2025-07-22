import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { P2PApp } from '../lib/P2PApp.js';

// Mock the dependencies
vi.mock('../lib/MinimalSignaling.js', () => ({
  MinimalSignaling: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue('mock-peer-id'),
    joinRoom: vi.fn().mockResolvedValue(),
    sendOffer: vi.fn(),
    sendAnswer: vi.fn(),
    sendIceCandidate: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getCurrentRoom: vi.fn().mockReturnValue('test-room'),
    getPeerId: vi.fn().mockReturnValue('mock-peer-id'),
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    peerId: 'mock-peer-id'
  }))
}));

vi.mock('../lib/P2PConnectionManager.js', () => ({
  P2PConnectionManager: vi.fn().mockImplementation(() => ({
    createConnection: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue('msg-id'),
    getConnectedPeers: vi.fn().mockReturnValue(['peer1', 'peer2']),
    cleanup: vi.fn(),
    connections: new Map(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }))
}));

describe('P2PApp', () => {
  let app;
  let mockSignaling;
  let mockConnectionManager;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create app instance
    app = new P2PApp({
      signalingServer: 'http://localhost:4000',
      webrtc: { customOption: 'test' }
    });

    // Get references to mocked instances
    const { MinimalSignaling } = await import('../lib/MinimalSignaling.js');
    const { P2PConnectionManager } = await import('../lib/P2PConnectionManager.js');
    
    mockSignaling = MinimalSignaling.mock.results[0].value;
    mockConnectionManager = P2PConnectionManager.mock.results[0].value;
  });

  afterEach(() => {
    if (app) {
      app.disconnect();
    }
  });

  describe('constructor', () => {
    it('should initialize with correct dependencies', () => {
      const { MinimalSignaling } = require('../lib/MinimalSignaling.js');
      const { P2PConnectionManager } = require('../lib/P2PConnectionManager.js');
      
      expect(MinimalSignaling).toHaveBeenCalledWith('http://localhost:4000');
      expect(P2PConnectionManager).toHaveBeenCalledWith({ customOption: 'test' });
      expect(app.eventBus).toBeInstanceOf(EventTarget);
      expect(app.currentRoom).toBeNull();
      expect(app.isInitiator).toBe(false);
      expect(app.pendingConnections).toBeInstanceOf(Set);
    });

    it('should use default signaling server', () => {
      const defaultApp = new P2PApp();
      const { MinimalSignaling } = require('../lib/MinimalSignaling.js');
      
      expect(MinimalSignaling).toHaveBeenCalledWith('http://localhost:4000');
    });

    it('should setup event handlers', () => {
      expect(mockSignaling.on).toHaveBeenCalledWith('peer-joined', expect.any(Function));
      expect(mockSignaling.on).toHaveBeenCalledWith('offer', expect.any(Function));
      expect(mockSignaling.on).toHaveBeenCalledWith('answer', expect.any(Function));
      expect(mockSignaling.on).toHaveBeenCalledWith('ice-candidate', expect.any(Function));
      expect(mockSignaling.on).toHaveBeenCalledWith('peer-left', expect.any(Function));
      
      expect(mockConnectionManager.on).toHaveBeenCalledWith('peer-connected', expect.any(Function));
      expect(mockConnectionManager.on).toHaveBeenCalledWith('message-received', expect.any(Function));
      expect(mockConnectionManager.on).toHaveBeenCalledWith('peer-disconnected', expect.any(Function));
      expect(mockConnectionManager.on).toHaveBeenCalledWith('connection-error', expect.any(Function));
      expect(mockConnectionManager.on).toHaveBeenCalledWith('ice-candidate', expect.any(Function));
    });
  });

  describe('connect', () => {
    it('should connect to signaling server', async () => {
      const eventSpy = vi.fn();
      app.on('connected', eventSpy);
      
      const peerId = await app.connect();
      
      expect(mockSignaling.connect).toHaveBeenCalled();
      expect(peerId).toBe('mock-peer-id');
      expect(eventSpy).toHaveBeenCalledWith({ peerId: 'mock-peer-id' });
    });

    it('should handle connection failure', async () => {
      const error = new Error('Connection failed');
      mockSignaling.connect.mockRejectedValue(error);
      
      const eventSpy = vi.fn();
      app.on('connection-failed', eventSpy);
      
      await expect(app.connect()).rejects.toThrow('Connection failed');
      expect(eventSpy).toHaveBeenCalledWith({ error });
    });
  });

  describe('joinRoom', () => {
    beforeEach(async () => {
      await app.connect();
    });

    it('should join room when connected', async () => {
      const eventSpy = vi.fn();
      app.on('room-joined', eventSpy);
      
      const peerId = await app.joinRoom('test-room');
      
      expect(mockSignaling.joinRoom).toHaveBeenCalledWith('test-room');
      expect(app.currentRoom).toBe('test-room');
      expect(peerId).toBe('mock-peer-id');
      expect(eventSpy).toHaveBeenCalledWith({ roomId: 'test-room' });
    });

    it('should throw error when not connected', async () => {
      mockSignaling.isConnected.mockReturnValue(false);
      
      await expect(app.joinRoom('test-room')).rejects.toThrow('Not connected to signaling server');
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await app.connect();
      await app.joinRoom('test-room');
    });

    it('should send message to connected peers', async () => {
      const message = 'Hello, world!';
      mockConnectionManager.sendMessage.mockResolvedValue('msg-123');
      
      const results = await app.sendMessage(message);
      
      expect(mockConnectionManager.sendMessage).toHaveBeenCalledWith('peer1', {
        type: 'message',
        content: message,
        timestamp: expect.any(Number),
        id: expect.any(String)
      });
      expect(mockConnectionManager.sendMessage).toHaveBeenCalledWith('peer2', {
        type: 'message',
        content: message,
        timestamp: expect.any(Number),
        id: expect.any(String)
      });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        peerId: 'peer1',
        messageId: 'msg-123',
        success: true
      });
    });

    it('should return empty array when no connected peers', async () => {
      mockConnectionManager.getConnectedPeers.mockReturnValue([]);
      
      const results = await app.sendMessage('Hello');
      
      expect(results).toEqual([]);
    });

    it('should handle send failures', async () => {
      const error = new Error('Send failed');
      mockConnectionManager.sendMessage.mockRejectedValue(error);
      
      const results = await app.sendMessage('Hello');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        peerId: 'peer1',
        error,
        success: false
      });
    });
  });

  describe('peer connection handling', () => {
    beforeEach(async () => {
      await app.connect();
      await app.joinRoom('test-room');
    });

    it('should handle peer joined event', () => {
      const eventSpy = vi.fn();
      app.on('peer-joined', eventSpy);
      
      // Find and call the peer-joined handler
      const peerJoinedHandler = mockSignaling.on.mock.calls
        .find(call => call[0] === 'peer-joined')[1];
      
      peerJoinedHandler({ peerId: 'new-peer' });
      
      expect(mockConnectionManager.createConnection).toHaveBeenCalledWith('new-peer', false);
      expect(app.pendingConnections.has('new-peer')).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith({ peerId: 'new-peer' });
    });

    it('should handle offer received', async () => {
      // Find and call the offer handler
      const offerHandler = mockSignaling.on.mock.calls
        .find(call => call[0] === 'offer')[1];
      
      const mockOffer = { type: 'offer', sdp: 'test-sdp' };
      mockConnectionManager.createConnection.mockResolvedValue({
        setRemoteDescription: vi.fn().mockResolvedValue(),
        createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue()
      });
      
      await offerHandler({ from: 'peer1', offer: mockOffer });
      
      expect(mockConnectionManager.createConnection).toHaveBeenCalledWith('peer1', false);
      expect(mockSignaling.sendAnswer).toHaveBeenCalled();
    });

    it('should handle answer received', async () => {
      // Setup existing connection
      const mockConnection = {
        setRemoteDescription: vi.fn().mockResolvedValue()
      };
      mockConnectionManager.connections.set('peer1', mockConnection);
      
      // Find and call the answer handler
      const answerHandler = mockSignaling.on.mock.calls
        .find(call => call[0] === 'answer')[1];
      
      const mockAnswer = { type: 'answer', sdp: 'test-sdp' };
      await answerHandler({ from: 'peer1', answer: mockAnswer });
      
      expect(mockConnection.setRemoteDescription).toHaveBeenCalledWith(mockAnswer);
    });

    it('should handle ICE candidate received', async () => {
      // Setup existing connection
      const mockConnection = {
        addIceCandidate: vi.fn().mockResolvedValue()
      };
      mockConnectionManager.connections.set('peer1', mockConnection);
      
      // Find and call the ice-candidate handler
      const iceCandidateHandler = mockSignaling.on.mock.calls
        .find(call => call[0] === 'ice-candidate')[1];
      
      const mockCandidate = { candidate: 'test-candidate' };
      await iceCandidateHandler({ from: 'peer1', candidate: mockCandidate });
      
      expect(mockConnection.addIceCandidate).toHaveBeenCalledWith(mockCandidate);
    });

    it('should handle peer left', () => {
      const eventSpy = vi.fn();
      app.on('peer-left', eventSpy);
      app.pendingConnections.add('peer1');
      
      // Find and call the peer-left handler
      const peerLeftHandler = mockSignaling.on.mock.calls
        .find(call => call[0] === 'peer-left')[1];
      
      peerLeftHandler({ peerId: 'peer1' });
      
      expect(mockConnectionManager.cleanup).toHaveBeenCalledWith('peer1');
      expect(app.pendingConnections.has('peer1')).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({ peerId: 'peer1' });
    });
  });

  describe('connection manager events', () => {
    it('should handle peer connected', () => {
      const eventSpy = vi.fn();
      app.on('peer-ready', eventSpy);
      app.pendingConnections.add('peer1');
      
      // Find and call the peer-connected handler
      const peerConnectedHandler = mockConnectionManager.on.mock.calls
        .find(call => call[0] === 'peer-connected')[1];
      
      peerConnectedHandler({ peerId: 'peer1' });
      
      expect(app.pendingConnections.has('peer1')).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({ peerId: 'peer1' });
    });

    it('should handle message received', () => {
      const eventSpy = vi.fn();
      app.on('message', eventSpy);
      
      // Find and call the message-received handler
      const messageHandler = mockConnectionManager.on.mock.calls
        .find(call => call[0] === 'message-received')[1];
      
      const messageData = { peerId: 'peer1', data: { content: 'Hello' } };
      messageHandler(messageData);
      
      expect(eventSpy).toHaveBeenCalledWith(messageData);
    });

    it('should handle connection error', () => {
      const eventSpy = vi.fn();
      app.on('connection-error', eventSpy);
      app.pendingConnections.add('peer1');
      
      // Find and call the connection-error handler
      const errorHandler = mockConnectionManager.on.mock.calls
        .find(call => call[0] === 'connection-error')[1];
      
      const errorData = { peerId: 'peer1', error: new Error('Connection failed') };
      errorHandler(errorData);
      
      expect(app.pendingConnections.has('peer1')).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith(errorData);
    });
  });

  describe('disconnect', () => {
    it('should cleanup all connections', () => {
      app.disconnect();
      
      expect(mockSignaling.disconnect).toHaveBeenCalled();
      expect(mockConnectionManager.cleanup).toHaveBeenCalled();
    });
  });

  describe('event system', () => {
    it('should emit and handle events', () => {
      const eventSpy = vi.fn();
      app.on('test-event', eventSpy);
      
      app.emit('test-event', { data: 'test' });
      
      expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners', () => {
      const eventSpy = vi.fn();
      app.on('test-event', eventSpy);
      app.off('test-event', eventSpy);
      
      app.emit('test-event', { data: 'test' });
      
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
