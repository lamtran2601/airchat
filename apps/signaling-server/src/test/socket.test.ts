import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { SignalingService } from '../services/SignalingService.js';

describe('Socket.IO Integration', () => {
  let server: any;
  let io: Server;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let port: number;

  beforeEach(async () => {
    // Reset SignalingService static state
    (SignalingService as any).rooms = new Map();
    (SignalingService as any).peers = new Map();
    (SignalingService as any).stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalRooms: 0,
      messagesRelayed: 0,
    };

    // Create server
    server = createServer();
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Initialize signaling service
    new SignalingService(io);

    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(() => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (clientSocket1?.connected) {
      clientSocket1.disconnect();
    }
    if (clientSocket2?.connected) {
      clientSocket2.disconnect();
    }
    
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should handle client connection and update stats', async () => {
      clientSocket1 = Client(`http://localhost:${port}`);

      await new Promise<void>((resolve) => {
        clientSocket1.on('connect', () => {
          resolve();
        });
      });

      expect(clientSocket1.connected).toBe(true);
      
      const stats = SignalingService.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });

    it('should handle client disconnection and update stats', async () => {
      clientSocket1 = Client(`http://localhost:${port}`);

      await new Promise<void>((resolve) => {
        clientSocket1.on('connect', () => resolve());
      });

      clientSocket1.disconnect();

      // Wait for disconnect to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = SignalingService.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(0);
    });

    it('should handle multiple concurrent connections', async () => {
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket2 = Client(`http://localhost:${port}`);

      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('connect', () => resolve());
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('connect', () => resolve());
        }),
      ]);

      const stats = SignalingService.getStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(2);
    });
  });

  describe('Room Management', () => {
    beforeEach(async () => {
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket2 = Client(`http://localhost:${port}`);

      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('connect', () => resolve());
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('connect', () => resolve());
        }),
      ]);
    });

    it('should handle room joining and notify existing peers', async () => {
      const roomJoinedPromise = new Promise<any>((resolve) => {
        clientSocket1.on('room-joined', resolve);
      });

      clientSocket1.emit('join-room', 'test-room');

      const roomJoinedData = await roomJoinedPromise;
      expect(roomJoinedData.roomId).toBe('test-room');
      expect(roomJoinedData.peers).toEqual([]);

      const stats = SignalingService.getStats();
      expect(stats.totalRooms).toBe(1);
      expect(stats.rooms[0].id).toBe('test-room');
      expect(stats.rooms[0].peerCount).toBe(1);
    });

    it('should notify existing peers when new peer joins', async () => {
      // First peer joins
      const roomJoinedPromise1 = new Promise<any>((resolve) => {
        clientSocket1.on('room-joined', resolve);
      });

      clientSocket1.emit('join-room', 'test-room');
      await roomJoinedPromise1;

      // Second peer joins and should be notified about first peer
      const roomJoinedPromise2 = new Promise<any>((resolve) => {
        clientSocket2.on('room-joined', resolve);
      });

      const peerJoinedPromise = new Promise<any>((resolve) => {
        clientSocket1.on('peer-joined', resolve);
      });

      clientSocket2.emit('join-room', 'test-room');

      const [roomJoinedData2, peerJoinedData] = await Promise.all([
        roomJoinedPromise2,
        peerJoinedPromise,
      ]);

      expect(roomJoinedData2.roomId).toBe('test-room');
      expect(roomJoinedData2.peers).toContain(clientSocket1.id);
      expect(peerJoinedData.peerId).toBe(clientSocket2.id);

      const stats = SignalingService.getStats();
      expect(stats.rooms[0].peerCount).toBe(2);
    });

    it('should handle room leaving and notify remaining peers', async () => {
      // Both peers join room
      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('room-joined', () => resolve());
          clientSocket1.emit('join-room', 'test-room');
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('room-joined', () => resolve());
          clientSocket2.emit('join-room', 'test-room');
        }),
      ]);

      // First peer leaves
      const peerLeftPromise = new Promise<any>((resolve) => {
        clientSocket2.on('peer-left', resolve);
      });

      clientSocket1.emit('leave-room');

      const peerLeftData = await peerLeftPromise;
      expect(peerLeftData.peerId).toBe(clientSocket1.id);

      const stats = SignalingService.getStats();
      expect(stats.rooms[0].peerCount).toBe(1);
    });

    it('should clean up empty rooms', async () => {
      // Peer joins and then leaves
      await new Promise<void>((resolve) => {
        clientSocket1.on('room-joined', () => resolve());
        clientSocket1.emit('join-room', 'test-room');
      });

      clientSocket1.emit('leave-room');

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = SignalingService.getStats();
      expect(stats.rooms).toHaveLength(0);
    });
  });

  describe('WebRTC Signaling', () => {
    beforeEach(async () => {
      clientSocket1 = Client(`http://localhost:${port}`);
      clientSocket2 = Client(`http://localhost:${port}`);

      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('connect', () => resolve());
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('connect', () => resolve());
        }),
      ]);

      // Both join the same room
      await Promise.all([
        new Promise<void>((resolve) => {
          clientSocket1.on('room-joined', () => resolve());
          clientSocket1.emit('join-room', 'test-room');
        }),
        new Promise<void>((resolve) => {
          clientSocket2.on('room-joined', () => resolve());
          clientSocket2.emit('join-room', 'test-room');
        }),
      ]);
    });

    it('should relay offer messages between peers', async () => {
      const offerData = {
        target: clientSocket2.id,
        offer: { type: 'offer' as const, sdp: 'test-offer-sdp' },
      };

      const offerReceivedPromise = new Promise<any>((resolve) => {
        clientSocket2.on('offer', resolve);
      });

      clientSocket1.emit('offer', offerData);

      const receivedOffer = await offerReceivedPromise;
      expect(receivedOffer.offer.type).toBe('offer');
      expect(receivedOffer.offer.sdp).toBe('test-offer-sdp');
      expect(receivedOffer.sender).toBe(clientSocket1.id);

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });

    it('should relay answer messages between peers', async () => {
      const answerData = {
        target: clientSocket1.id,
        answer: { type: 'answer' as const, sdp: 'test-answer-sdp' },
      };

      const answerReceivedPromise = new Promise<any>((resolve) => {
        clientSocket1.on('answer', resolve);
      });

      clientSocket2.emit('answer', answerData);

      const receivedAnswer = await answerReceivedPromise;
      expect(receivedAnswer.answer.type).toBe('answer');
      expect(receivedAnswer.answer.sdp).toBe('test-answer-sdp');
      expect(receivedAnswer.sender).toBe(clientSocket2.id);

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });

    it('should relay ICE candidate messages between peers', async () => {
      const candidateData = {
        target: clientSocket2.id,
        candidate: {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
          sdpMLineIndex: 0,
          sdpMid: '0',
        },
      };

      const candidateReceivedPromise = new Promise<any>((resolve) => {
        clientSocket2.on('ice-candidate', resolve);
      });

      clientSocket1.emit('ice-candidate', candidateData);

      const receivedCandidate = await candidateReceivedPromise;
      expect(receivedCandidate.candidate.candidate).toBe(candidateData.candidate.candidate);
      expect(receivedCandidate.candidate.sdpMLineIndex).toBe(0);
      expect(receivedCandidate.sender).toBe(clientSocket1.id);

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });

    it('should handle multiple message types in sequence', async () => {
      const messages: any[] = [];

      clientSocket2.on('offer', (data) => messages.push({ type: 'offer', data }));
      clientSocket2.on('answer', (data) => messages.push({ type: 'answer', data }));
      clientSocket2.on('ice-candidate', (data) => messages.push({ type: 'ice-candidate', data }));

      // Send multiple messages
      clientSocket1.emit('offer', {
        target: clientSocket2.id,
        offer: { type: 'offer' as const, sdp: 'offer-sdp' },
      });

      clientSocket1.emit('ice-candidate', {
        target: clientSocket2.id,
        candidate: { candidate: 'test-candidate', sdpMLineIndex: 0 },
      });

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('offer');
      expect(messages[1].type).toBe('ice-candidate');

      const stats = SignalingService.getStats();
      expect(stats.messagesRelayed).toBe(2);
    });
  });
});
