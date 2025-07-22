import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { P2PConnectionManager } from '../lib/P2PConnectionManager.js';

describe('P2PConnectionManager', () => {
  let manager;
  let mockPeerConnection;
  let mockDataChannel;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock data channel
    mockDataChannel = {
      label: 'main',
      readyState: 'connecting',
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null
    };

    // Create mock peer connection
    mockPeerConnection = {
      connectionState: 'new',
      iceConnectionState: 'new',
      localDescription: null,
      remoteDescription: null,
      createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer' }),
      createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer' }),
      setLocalDescription: vi.fn().mockResolvedValue(),
      setRemoteDescription: vi.fn().mockResolvedValue(),
      addIceCandidate: vi.fn().mockResolvedValue(),
      createDataChannel: vi.fn().mockReturnValue(mockDataChannel),
      close: vi.fn(),
      onconnectionstatechange: null,
      oniceconnectionstatechange: null,
      onicecandidate: null,
      ondatachannel: null
    };

    // Mock RTCPeerConnection constructor
    global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPeerConnection);

    manager = new P2PConnectionManager();
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(manager.config).toEqual({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun.services.mozilla.com:3478" },
        ],
        iceCandidatePoolSize: 3,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      expect(manager.connections).toBeInstanceOf(Map);
      expect(manager.dataChannels).toBeInstanceOf(Map);
      expect(manager.eventEmitter).toBeInstanceOf(EventTarget);
    });

    it('should merge custom config', () => {
      const customConfig = {
        iceServers: [{ urls: 'stun:custom.server.com:3478' }],
        customOption: 'test'
      };
      
      const customManager = new P2PConnectionManager(customConfig);
      
      expect(customManager.config.iceServers).toEqual(customConfig.iceServers);
      expect(customManager.config.customOption).toBe('test');
      expect(customManager.config.bundlePolicy).toBe('max-bundle'); // Should keep defaults
    });
  });

  describe('createConnection', () => {
    it('should create connection as initiator', async () => {
      const peerId = 'test-peer';
      
      const result = await manager.createConnection(peerId, true);
      
      expect(global.RTCPeerConnection).toHaveBeenCalledWith(manager.config);
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith('main', {
        ordered: true,
        maxRetransmits: 3,
      });
      expect(manager.connections.get(peerId)).toBe(mockPeerConnection);
      expect(manager.dataChannels.get(peerId)).toBe(mockDataChannel);
      expect(result).toBe(mockPeerConnection);
    });

    it('should create connection as non-initiator', async () => {
      const peerId = 'test-peer';
      
      const result = await manager.createConnection(peerId, false);
      
      expect(global.RTCPeerConnection).toHaveBeenCalledWith(manager.config);
      expect(mockPeerConnection.createDataChannel).not.toHaveBeenCalled();
      expect(mockPeerConnection.ondatachannel).toBeInstanceOf(Function);
      expect(manager.connections.get(peerId)).toBe(mockPeerConnection);
      expect(result).toBe(mockPeerConnection);
    });

    it('should setup connection event handlers', async () => {
      const peerId = 'test-peer';
      
      await manager.createConnection(peerId, true);
      
      expect(mockPeerConnection.onconnectionstatechange).toBeInstanceOf(Function);
      expect(mockPeerConnection.oniceconnectionstatechange).toBeInstanceOf(Function);
      expect(mockPeerConnection.onicecandidate).toBeInstanceOf(Function);
    });

    it('should handle connection state changes', async () => {
      const peerId = 'test-peer';
      const eventSpy = vi.fn();
      manager.on('peer-connected', eventSpy);
      
      await manager.createConnection(peerId, true);
      
      // Simulate connection state change to 'connected'
      mockPeerConnection.connectionState = 'connected';
      mockPeerConnection.onconnectionstatechange();
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });

    it('should handle connection failure', async () => {
      const peerId = 'test-peer';
      const eventSpy = vi.fn();
      manager.on('peer-failed', eventSpy);
      
      await manager.createConnection(peerId, true);
      
      // Simulate connection state change to 'failed'
      mockPeerConnection.connectionState = 'failed';
      mockPeerConnection.onconnectionstatechange();
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });
  });

  describe('data channel management', () => {
    beforeEach(async () => {
      await manager.createConnection('test-peer', true);
    });

    it('should setup data channel handlers', () => {
      expect(mockDataChannel.onopen).toBeInstanceOf(Function);
      expect(mockDataChannel.onclose).toBeInstanceOf(Function);
      expect(mockDataChannel.onmessage).toBeInstanceOf(Function);
      expect(mockDataChannel.onerror).toBeInstanceOf(Function);
    });

    it('should handle data channel open', () => {
      const eventSpy = vi.fn();
      manager.on('data-channel-open', eventSpy);
      
      mockDataChannel.readyState = 'open';
      mockDataChannel.onopen();
      
      expect(eventSpy).toHaveBeenCalledWith({ peerId: 'test-peer' });
    });

    it('should handle incoming messages', () => {
      const eventSpy = vi.fn();
      manager.on('message-received', eventSpy);
      
      const messageData = { type: 'test', content: 'hello' };
      const mockEvent = { data: JSON.stringify(messageData) };
      
      mockDataChannel.onmessage(mockEvent);
      
      expect(eventSpy).toHaveBeenCalledWith({
        peerId: 'test-peer',
        data: messageData
      });
    });

    it('should handle malformed messages gracefully', () => {
      const eventSpy = vi.fn();
      manager.on('message-received', eventSpy);
      
      const mockEvent = { data: 'invalid-json' };
      
      expect(() => mockDataChannel.onmessage(mockEvent)).not.toThrow();
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await manager.createConnection('test-peer', true);
      mockDataChannel.readyState = 'open';
    });

    it('should send message when channel is open', async () => {
      const message = { type: 'test', content: 'hello' };
      
      const result = await manager.sendMessage('test-peer', message);
      
      expect(mockDataChannel.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(result).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });

    it('should reject when peer not found', async () => {
      const message = { type: 'test', content: 'hello' };
      
      await expect(manager.sendMessage('unknown-peer', message))
        .rejects.toThrow('No connection found for peer: unknown-peer');
    });

    it('should reject when channel not ready', async () => {
      mockDataChannel.readyState = 'connecting';
      const message = { type: 'test', content: 'hello' };
      
      await expect(manager.sendMessage('test-peer', message))
        .rejects.toThrow('Data channel not ready for peer: test-peer');
    });

    it('should handle send errors', async () => {
      mockDataChannel.send.mockImplementation(() => {
        throw new Error('Send failed');
      });
      const message = { type: 'test', content: 'hello' };
      
      await expect(manager.sendMessage('test-peer', message))
        .rejects.toThrow('Failed to send message to test-peer: Send failed');
    });
  });

  describe('getConnectedPeers', () => {
    it('should return empty array when no connections', () => {
      expect(manager.getConnectedPeers()).toEqual([]);
    });

    it('should return connected peers only', async () => {
      // Create connections
      await manager.createConnection('peer1', true);
      await manager.createConnection('peer2', true);
      
      // Set up data channels
      const channel1 = { readyState: 'open' };
      const channel2 = { readyState: 'connecting' };
      manager.dataChannels.set('peer1', channel1);
      manager.dataChannels.set('peer2', channel2);
      
      const connectedPeers = manager.getConnectedPeers();
      
      expect(connectedPeers).toEqual(['peer1']);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await manager.createConnection('test-peer', true);
    });

    it('should cleanup specific peer', () => {
      manager.cleanup('test-peer');
      
      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(manager.connections.has('test-peer')).toBe(false);
      expect(manager.dataChannels.has('test-peer')).toBe(false);
    });

    it('should cleanup all connections when no peer specified', () => {
      manager.cleanup();
      
      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(manager.connections.size).toBe(0);
      expect(manager.dataChannels.size).toBe(0);
    });

    it('should handle cleanup of non-existent peer', () => {
      expect(() => manager.cleanup('unknown-peer')).not.toThrow();
    });
  });

  describe('event system', () => {
    it('should emit and handle events', () => {
      const eventSpy = vi.fn();
      manager.on('test-event', eventSpy);
      
      manager.emit('test-event', { data: 'test' });
      
      expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners', () => {
      const eventSpy = vi.fn();
      manager.on('test-event', eventSpy);
      manager.off('test-event', eventSpy);
      
      manager.emit('test-event', { data: 'test' });
      
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
