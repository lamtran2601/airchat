import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MinimalSignaling } from '../lib/MinimalSignaling.js';
import { P2PConnectionManager } from '../lib/P2PConnectionManager.js';
import { P2PApp } from '../lib/P2PApp.js';

// Mock dependencies for edge case testing
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}));

describe('Edge Cases and Error Handling', () => {
  describe('MinimalSignaling Edge Cases', () => {
    let signaling;
    let mockSocket;

    beforeEach(() => {
      mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
        connected: false,
        id: 'mock-socket-id'
      };

      const { io } = require('socket.io-client');
      io.mockReturnValue(mockSocket);

      signaling = new MinimalSignaling('http://localhost:4000');
    });

    it('should handle connection timeout', async () => {
      const connectPromise = signaling.connect();
      
      // Don't trigger connect event - simulate timeout
      setTimeout(() => {
        const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];
        errorHandler(new Error('Connection timeout'));
      }, 10);

      await expect(connectPromise).rejects.toThrow('Connection timeout');
    });

    it('should handle invalid server URL', () => {
      expect(() => new MinimalSignaling('')).not.toThrow();
      expect(() => new MinimalSignaling(null)).not.toThrow();
      expect(() => new MinimalSignaling(undefined)).not.toThrow();
    });

    it('should handle socket disconnection during operation', async () => {
      const connectPromise = signaling.connect();
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;

      // Simulate unexpected disconnection
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      mockSocket.connected = false;
      
      expect(() => disconnectHandler()).not.toThrow();
      expect(signaling.isConnected()).toBe(false);
    });

    it('should handle malformed signaling messages', async () => {
      const connectPromise = signaling.connect();
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;

      // Find message handlers and send malformed data
      const offerHandler = mockSocket.on.mock.calls.find(call => call[0] === 'offer')[1];
      
      expect(() => offerHandler(null)).not.toThrow();
      expect(() => offerHandler(undefined)).not.toThrow();
      expect(() => offerHandler({ malformed: 'data' })).not.toThrow();
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const connectPromise = signaling.connect();
        const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
        mockSocket.connected = true;
        connectHandler();
        await connectPromise;
        
        signaling.disconnect();
        mockSocket.connected = false;
      }
      
      expect(signaling.isConnected()).toBe(false);
    });
  });

  describe('P2PConnectionManager Edge Cases', () => {
    let manager;
    let mockPeerConnection;

    beforeEach(() => {
      mockPeerConnection = {
        connectionState: 'new',
        createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock' }),
        createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock' }),
        setLocalDescription: vi.fn().mockResolvedValue(),
        setRemoteDescription: vi.fn().mockResolvedValue(),
        addIceCandidate: vi.fn().mockResolvedValue(),
        createDataChannel: vi.fn().mockReturnValue({
          readyState: 'connecting',
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onclose: null,
          onmessage: null,
          onerror: null
        }),
        close: vi.fn(),
        onconnectionstatechange: null,
        oniceconnectionstatechange: null,
        onicecandidate: null,
        ondatachannel: null
      };

      global.RTCPeerConnection = vi.fn().mockImplementation(() => mockPeerConnection);
      manager = new P2PConnectionManager();
    });

    it('should handle WebRTC API failures', async () => {
      mockPeerConnection.createOffer.mockRejectedValue(new Error('WebRTC not supported'));
      
      await expect(manager.createConnection('peer1', true)).rejects.toThrow('WebRTC not supported');
    });

    it('should handle data channel creation failures', async () => {
      mockPeerConnection.createDataChannel.mockImplementation(() => {
        throw new Error('Data channel creation failed');
      });
      
      await expect(manager.createConnection('peer1', true)).rejects.toThrow('Data channel creation failed');
    });

    it('should handle ICE candidate failures', async () => {
      await manager.createConnection('peer1', true);
      
      mockPeerConnection.addIceCandidate.mockRejectedValue(new Error('Invalid ICE candidate'));
      
      // Should not throw when handling ICE candidate errors
      expect(() => {
        const iceHandler = mockPeerConnection.onicecandidate;
        iceHandler({ candidate: null });
      }).not.toThrow();
    });

    it('should handle rapid connection state changes', async () => {
      await manager.createConnection('peer1', true);
      
      const stateHandler = mockPeerConnection.onconnectionstatechange;
      
      // Rapidly change states
      mockPeerConnection.connectionState = 'connecting';
      stateHandler();
      
      mockPeerConnection.connectionState = 'connected';
      stateHandler();
      
      mockPeerConnection.connectionState = 'disconnected';
      stateHandler();
      
      mockPeerConnection.connectionState = 'failed';
      stateHandler();
      
      expect(manager.connections.size).toBe(0); // Should be cleaned up
    });

    it('should handle sending messages to closed channels', async () => {
      await manager.createConnection('peer1', true);
      const channel = manager.dataChannels.get('peer1');
      channel.readyState = 'closed';
      
      await expect(manager.sendMessage('peer1', { test: 'message' }))
        .rejects.toThrow('Data channel not ready');
    });

    it('should handle large message payloads', async () => {
      await manager.createConnection('peer1', true);
      const channel = manager.dataChannels.get('peer1');
      channel.readyState = 'open';
      
      // Create a large message (1MB)
      const largeMessage = { data: 'x'.repeat(1024 * 1024) };
      
      channel.send.mockImplementation(() => {
        throw new Error('Message too large');
      });
      
      await expect(manager.sendMessage('peer1', largeMessage))
        .rejects.toThrow('Failed to send message to peer1: Message too large');
    });
  });

  describe('P2PApp Integration Edge Cases', () => {
    let app;
    let mockSignaling;
    let mockConnectionManager;

    beforeEach(() => {
      // Mock dependencies
      vi.doMock('../lib/MinimalSignaling.js', () => ({
        MinimalSignaling: vi.fn().mockImplementation(() => ({
          connect: vi.fn(),
          joinRoom: vi.fn(),
          isConnected: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          disconnect: vi.fn()
        }))
      }));

      vi.doMock('../lib/P2PConnectionManager.js', () => ({
        P2PConnectionManager: vi.fn().mockImplementation(() => ({
          createConnection: vi.fn(),
          sendMessage: vi.fn(),
          getConnectedPeers: vi.fn().mockReturnValue([]),
          cleanup: vi.fn(),
          connections: new Map(),
          on: vi.fn(),
          off: vi.fn()
        }))
      }));

      app = new P2PApp();
      const { MinimalSignaling } = require('../lib/MinimalSignaling.js');
      const { P2PConnectionManager } = require('../lib/P2PConnectionManager.js');
      
      mockSignaling = MinimalSignaling.mock.results[0].value;
      mockConnectionManager = P2PConnectionManager.mock.results[0].value;
    });

    it('should handle signaling connection failures during room join', async () => {
      mockSignaling.connect.mockResolvedValue('peer-id');
      mockSignaling.isConnected.mockReturnValue(false);
      
      await app.connect();
      
      await expect(app.joinRoom('test-room')).rejects.toThrow('Not connected to signaling server');
    });

    it('should handle peer connection failures gracefully', async () => {
      mockSignaling.connect.mockResolvedValue('peer-id');
      mockSignaling.isConnected.mockReturnValue(true);
      mockConnectionManager.createConnection.mockRejectedValue(new Error('Connection failed'));
      
      await app.connect();
      await app.joinRoom('test-room');
      
      // Simulate peer joined event
      const peerJoinedHandler = mockSignaling.on.mock.calls.find(call => call[0] === 'peer-joined')[1];
      
      expect(() => peerJoinedHandler({ peerId: 'peer1' })).not.toThrow();
    });

    it('should handle message sending when no peers connected', async () => {
      mockSignaling.connect.mockResolvedValue('peer-id');
      mockSignaling.isConnected.mockReturnValue(true);
      mockConnectionManager.getConnectedPeers.mockReturnValue([]);
      
      await app.connect();
      await app.joinRoom('test-room');
      
      const results = await app.sendMessage('Hello');
      expect(results).toEqual([]);
    });

    it('should handle partial message send failures', async () => {
      mockSignaling.connect.mockResolvedValue('peer-id');
      mockSignaling.isConnected.mockReturnValue(true);
      mockConnectionManager.getConnectedPeers.mockReturnValue(['peer1', 'peer2']);
      
      // First peer succeeds, second fails
      mockConnectionManager.sendMessage
        .mockResolvedValueOnce('msg-1')
        .mockRejectedValueOnce(new Error('Send failed'));
      
      await app.connect();
      await app.joinRoom('test-room');
      
      const results = await app.sendMessage('Hello');
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error.message).toBe('Send failed');
    });

    it('should handle rapid peer join/leave events', async () => {
      mockSignaling.connect.mockResolvedValue('peer-id');
      mockSignaling.isConnected.mockReturnValue(true);
      
      await app.connect();
      await app.joinRoom('test-room');
      
      const peerJoinedHandler = mockSignaling.on.mock.calls.find(call => call[0] === 'peer-joined')[1];
      const peerLeftHandler = mockSignaling.on.mock.calls.find(call => call[0] === 'peer-left')[1];
      
      // Rapid join/leave cycles
      for (let i = 0; i < 10; i++) {
        peerJoinedHandler({ peerId: `peer${i}` });
        peerLeftHandler({ peerId: `peer${i}` });
      }
      
      expect(app.pendingConnections.size).toBe(0);
    });
  });

  describe('Network and Browser Compatibility', () => {
    it('should handle missing WebRTC support', () => {
      const originalRTC = global.RTCPeerConnection;
      delete global.RTCPeerConnection;
      
      expect(() => new P2PConnectionManager()).toThrow();
      
      global.RTCPeerConnection = originalRTC;
    });

    it('should handle missing EventTarget support', () => {
      const originalEventTarget = global.EventTarget;
      delete global.EventTarget;
      
      // Should fallback gracefully or throw meaningful error
      expect(() => new MinimalSignaling('http://localhost:4000')).toThrow();
      
      global.EventTarget = originalEventTarget;
    });

    it('should handle JSON parsing errors in messages', () => {
      const manager = new P2PConnectionManager();
      const mockChannel = {
        readyState: 'open',
        onmessage: null,
        onopen: null,
        onclose: null,
        onerror: null
      };
      
      // Setup data channel handler
      manager.setupDataChannelHandlers(mockChannel, 'peer1');
      
      // Send malformed JSON
      const messageEvent = { data: 'invalid-json{' };
      
      expect(() => mockChannel.onmessage(messageEvent)).not.toThrow();
    });

    it('should handle extremely long room IDs', async () => {
      const signaling = new MinimalSignaling('http://localhost:4000');
      const mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        connected: true
      };
      
      signaling.socket = mockSocket;
      
      const longRoomId = 'x'.repeat(10000);
      
      await expect(signaling.joinRoom(longRoomId)).resolves.not.toThrow();
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', longRoomId);
    });

    it('should handle special characters in room IDs', async () => {
      const signaling = new MinimalSignaling('http://localhost:4000');
      const mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        connected: true
      };
      
      signaling.socket = mockSocket;
      
      const specialRoomId = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      await expect(signaling.joinRoom(specialRoomId)).resolves.not.toThrow();
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', specialRoomId);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should clean up event listeners on disconnect', () => {
      const signaling = new MinimalSignaling('http://localhost:4000');
      const mockSocket = {
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
        connected: true
      };
      
      signaling.socket = mockSocket;
      signaling.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(signaling.socket).toBeNull();
    });

    it('should handle cleanup of many connections', () => {
      const manager = new P2PConnectionManager();
      
      // Create many mock connections
      for (let i = 0; i < 100; i++) {
        const mockConnection = { close: vi.fn() };
        manager.connections.set(`peer${i}`, mockConnection);
      }
      
      manager.cleanup();
      
      expect(manager.connections.size).toBe(0);
    });
  });
});
