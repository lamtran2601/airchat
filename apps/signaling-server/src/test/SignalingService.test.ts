import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { SignalingService } from '../services/SignalingService.js';

// Mock Socket.IO types
interface MockSocket {
  id: string;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
}

describe('SignalingService', () => {
  let mockIo: any;
  let mockSocket: MockSocket;
  let signalingService: SignalingService;

  beforeEach(() => {
    // Reset static properties
    (SignalingService as any).rooms = new Map();
    (SignalingService as any).peers = new Map();
    (SignalingService as any).stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalRooms: 0,
      messagesRelayed: 0,
    };

    // Create mock socket
    mockSocket = {
      id: 'test-socket-id',
      on: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      join: vi.fn(),
      leave: vi.fn(),
    };

    // Create mock Socket.IO server
    mockIo = {
      on: vi.fn(),
    };

    signalingService = new SignalingService(mockIo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with Socket.IO server and setup handlers', () => {
      expect(mockIo.on).toHaveBeenCalledWith(
        'connection',
        expect.any(Function)
      );
    });
  });

  describe('setupSocketHandlers', () => {
    it('should register all required socket event handlers', () => {
      // Trigger connection event
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      // Verify all event handlers are registered
      expect(mockSocket.on).toHaveBeenCalledWith(
        'join-room',
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith('offer', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(
        'answer',
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        'ice-candidate',
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        'disconnect',
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        'leave-room',
        expect.any(Function)
      );
    });

    it('should increment connection stats on new connection', () => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      const stats = SignalingService.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });
  });

  describe('handleJoinRoom', () => {
    beforeEach(() => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);
    });

    it('should create new room if it does not exist', () => {
      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];

      joinRoomHandler('test-room');

      expect(mockSocket.join).toHaveBeenCalledWith('test-room');
      expect(mockSocket.emit).toHaveBeenCalledWith('room-joined', {
        roomId: 'test-room',
        peers: [],
      });

      const stats = SignalingService.getStats();
      expect(stats.totalRooms).toBe(1);
      expect(stats.rooms).toHaveLength(1);
      expect(stats.rooms[0].id).toBe('test-room');
      expect(stats.rooms[0].peerCount).toBe(1);
    });

    it('should add peer to existing room', () => {
      // First peer joins
      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];
      joinRoomHandler('test-room');

      // Second peer joins
      const mockSocket2: MockSocket = {
        id: 'test-socket-id-2',
        on: vi.fn(),
        emit: vi.fn(),
        to: vi.fn().mockReturnThis(),
        join: vi.fn(),
        leave: vi.fn(),
      };

      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket2);

      const joinRoomHandler2 = mockSocket2.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];
      joinRoomHandler2('test-room');

      expect(mockSocket2.emit).toHaveBeenCalledWith('room-joined', {
        roomId: 'test-room',
        peers: ['test-socket-id'],
      });
      expect(mockSocket2.to).toHaveBeenCalledWith('test-room');
    });

    it('should notify existing peers when new peer joins', () => {
      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];

      joinRoomHandler('test-room');

      expect(mockSocket.to).toHaveBeenCalledWith('test-room');
    });
  });

  describe('handleLeaveRoom', () => {
    beforeEach(() => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      // Join a room first
      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];
      joinRoomHandler('test-room');
    });

    it('should remove peer from room and notify others', () => {
      const leaveRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'leave-room'
      )[1];

      leaveRoomHandler();

      expect(mockSocket.leave).toHaveBeenCalledWith('test-room');
      expect(mockSocket.to).toHaveBeenCalledWith('test-room');
    });

    it('should delete empty room after last peer leaves', () => {
      const leaveRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'leave-room'
      )[1];

      leaveRoomHandler();

      const stats = SignalingService.getStats();
      expect(stats.rooms).toHaveLength(0);
    });

    it('should handle leaving room when peer is not in any room', () => {
      // Remove peer from internal tracking
      (SignalingService as any).peers.delete(mockSocket.id);

      const leaveRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'leave-room'
      )[1];

      expect(() => leaveRoomHandler()).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    beforeEach(() => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);
    });

    it('should decrement active connections on disconnect', () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      disconnectHandler();

      const stats = SignalingService.getStats();
      expect(stats.activeConnections).toBe(0);
    });

    it('should call handleLeaveRoom on disconnect', () => {
      // Join a room first
      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];
      joinRoomHandler('test-room');

      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      disconnectHandler();

      // Verify room is cleaned up
      const stats = SignalingService.getStats();
      expect(stats.rooms).toHaveLength(0);
    });
  });

  describe('relayMessage', () => {
    beforeEach(() => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);
    });

    it('should relay offer message with sender information', () => {
      const offerHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'offer'
      )[1];

      const offerData = {
        target: 'target-peer-id',
        offer: { type: 'offer' as const, sdp: 'test-sdp' },
      };

      offerHandler(offerData);

      expect(mockSocket.to).toHaveBeenCalledWith('target-peer-id');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('offer', {
        offer: { type: 'offer', sdp: 'test-sdp' },
        sender: 'test-socket-id',
      });

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });

    it('should relay answer message with sender information', () => {
      const answerHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'answer'
      )[1];

      const answerData = {
        target: 'target-peer-id',
        answer: { type: 'answer' as const, sdp: 'test-sdp' },
      };

      answerHandler(answerData);

      expect(mockSocket.to).toHaveBeenCalledWith('target-peer-id');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('answer', {
        answer: { type: 'answer', sdp: 'test-sdp' },
        sender: 'test-socket-id',
      });

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });

    it('should relay ice-candidate message with sender information', () => {
      const iceCandidateHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'ice-candidate'
      )[1];

      const candidateData = {
        target: 'target-peer-id',
        candidate: { candidate: 'test-candidate', sdpMLineIndex: 0 },
      };

      iceCandidateHandler(candidateData);

      expect(mockSocket.to).toHaveBeenCalledWith('target-peer-id');
      expect(mockSocket.to().emit).toHaveBeenCalledWith('ice-candidate', {
        candidate: { candidate: 'test-candidate', sdpMLineIndex: 0 },
        sender: 'test-socket-id',
      });

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      const stats = SignalingService.getStats();

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('totalRooms');
      expect(stats).toHaveProperty('messagesRelayed');
      expect(stats).toHaveProperty('rooms');
      expect(stats).toHaveProperty('timestamp');
      expect(Array.isArray(stats.rooms)).toBe(true);
    });

    it('should include room details in stats', () => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];
      joinRoomHandler('test-room');

      const stats = SignalingService.getStats();
      expect(stats.rooms).toHaveLength(1);
      expect(stats.rooms[0]).toEqual({
        id: 'test-room',
        peerCount: 1,
        peers: ['test-socket-id'],
      });
    });
  });

  describe('getRoomStats', () => {
    it('should return room statistics', () => {
      const connectionHandler = mockIo.on.mock.calls[0][1];
      connectionHandler(mockSocket);

      const joinRoomHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'join-room'
      )[1];
      joinRoomHandler('test-room');

      const roomStats = SignalingService.getRoomStats();
      expect(roomStats).toHaveLength(1);
      expect(roomStats[0]).toEqual({
        id: 'test-room',
        peerCount: 1,
        createdAt: expect.any(Date),
      });
    });

    it('should return empty array when no rooms exist', () => {
      const roomStats = SignalingService.getRoomStats();
      expect(roomStats).toHaveLength(0);
    });
  });
});
