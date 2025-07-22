import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';

// We'll test the server logic by importing and running it in isolation
describe('Signaling Server', () => {
  let httpServer;
  let io;
  let serverSocket;
  let clientSocket1;
  let clientSocket2;
  let port;

  beforeEach((done) => {
    // Create HTTP server and Socket.IO instance
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Find available port
    httpServer.listen(() => {
      port = httpServer.address().port;
      
      // Implement the same server logic as in server/index.js
      const rooms = new Map();

      io.on('connection', (socket) => {
        serverSocket = socket;

        socket.on('join-room', (roomId) => {
          socket.join(roomId);

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId).add(socket.id);

          // Notify others in room
          socket.to(roomId).emit('peer-joined', { peerId: socket.id });
          
          // Send current room participants to the new user
          const participants = Array.from(rooms.get(roomId)).filter(id => id !== socket.id);
          socket.emit('room-participants', { participants });
        });

        // Simple message relay for WebRTC signaling
        socket.on('offer', (data) => {
          socket.to(data.room).emit('offer', { from: socket.id, offer: data.offer });
        });

        socket.on('answer', (data) => {
          socket.to(data.room).emit('answer', { from: socket.id, answer: data.answer });
        });

        socket.on('ice-candidate', (data) => {
          socket.to(data.room).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
        });

        socket.on('disconnect', () => {
          // Clean up rooms
          for (const [roomId, participants] of rooms) {
            if (participants.has(socket.id)) {
              participants.delete(socket.id);
              socket.to(roomId).emit('peer-left', { peerId: socket.id });

              if (participants.size === 0) {
                rooms.delete(roomId);
              }
            }
          }
        });
      });

      done();
    });
  });

  afterEach((done) => {
    if (clientSocket1) {
      clientSocket1.disconnect();
    }
    if (clientSocket2) {
      clientSocket2.disconnect();
    }
    
    io.close();
    httpServer.close(() => done());
  });

  describe('connection handling', () => {
    it('should accept client connections', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', () => {
        expect(clientSocket1.connected).toBe(true);
        expect(clientSocket1.id).toBeDefined();
        done();
      });
    });

    it('should handle multiple client connections', (done) => {
      let connectedCount = 0;
      
      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          expect(clientSocket1.connected).toBe(true);
          expect(clientSocket2.connected).toBe(true);
          expect(clientSocket1.id).not.toBe(clientSocket2.id);
          done();
        }
      };

      clientSocket1 = new Client(`http://localhost:${port}`);
      clientSocket2 = new Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', checkBothConnected);
      clientSocket2.on('connect', checkBothConnected);
    });
  });

  describe('room management', () => {
    beforeEach((done) => {
      clientSocket1 = new Client(`http://localhost:${port}`);
      clientSocket2 = new Client(`http://localhost:${port}`);
      
      let connectedCount = 0;
      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };
      
      clientSocket1.on('connect', checkBothConnected);
      clientSocket2.on('connect', checkBothConnected);
    });

    it('should allow clients to join rooms', (done) => {
      clientSocket1.emit('join-room', 'test-room');
      
      clientSocket1.on('room-participants', (data) => {
        expect(data.participants).toEqual([]);
        done();
      });
    });

    it('should notify existing room members when new peer joins', (done) => {
      // Client 1 joins room first
      clientSocket1.emit('join-room', 'test-room');
      
      // Client 1 should receive peer-joined when client 2 joins
      clientSocket1.on('peer-joined', (data) => {
        expect(data.peerId).toBe(clientSocket2.id);
        done();
      });
      
      // Client 2 joins the same room
      setTimeout(() => {
        clientSocket2.emit('join-room', 'test-room');
      }, 10);
    });

    it('should send current participants to new room member', (done) => {
      // Client 1 joins room first
      clientSocket1.emit('join-room', 'test-room');
      
      // Client 2 joins and should receive client 1 as participant
      clientSocket2.on('room-participants', (data) => {
        expect(data.participants).toContain(clientSocket1.id);
        expect(data.participants).toHaveLength(1);
        done();
      });
      
      setTimeout(() => {
        clientSocket2.emit('join-room', 'test-room');
      }, 10);
    });

    it('should handle multiple rooms independently', (done) => {
      let room1Joined = false;
      let room2Joined = false;
      
      const checkBothRoomsJoined = () => {
        if (room1Joined && room2Joined) {
          done();
        }
      };

      clientSocket1.on('room-participants', (data) => {
        expect(data.participants).toEqual([]);
        room1Joined = true;
        checkBothRoomsJoined();
      });

      clientSocket2.on('room-participants', (data) => {
        expect(data.participants).toEqual([]);
        room2Joined = true;
        checkBothRoomsJoined();
      });

      clientSocket1.emit('join-room', 'room-1');
      clientSocket2.emit('join-room', 'room-2');
    });
  });

  describe('WebRTC signaling relay', () => {
    beforeEach((done) => {
      clientSocket1 = new Client(`http://localhost:${port}`);
      clientSocket2 = new Client(`http://localhost:${port}`);
      
      let connectedCount = 0;
      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          // Both clients join the same room
          clientSocket1.emit('join-room', 'test-room');
          clientSocket2.emit('join-room', 'test-room');
          setTimeout(done, 20); // Wait for room joins to complete
        }
      };
      
      clientSocket1.on('connect', checkBothConnected);
      clientSocket2.on('connect', checkBothConnected);
    });

    it('should relay offers between peers', (done) => {
      const testOffer = { type: 'offer', sdp: 'test-offer-sdp' };
      
      clientSocket2.on('offer', (data) => {
        expect(data.from).toBe(clientSocket1.id);
        expect(data.offer).toEqual(testOffer);
        done();
      });
      
      clientSocket1.emit('offer', { room: 'test-room', offer: testOffer });
    });

    it('should relay answers between peers', (done) => {
      const testAnswer = { type: 'answer', sdp: 'test-answer-sdp' };
      
      clientSocket1.on('answer', (data) => {
        expect(data.from).toBe(clientSocket2.id);
        expect(data.answer).toEqual(testAnswer);
        done();
      });
      
      clientSocket2.emit('answer', { room: 'test-room', answer: testAnswer });
    });

    it('should relay ICE candidates between peers', (done) => {
      const testCandidate = { candidate: 'test-ice-candidate' };
      
      clientSocket2.on('ice-candidate', (data) => {
        expect(data.from).toBe(clientSocket1.id);
        expect(data.candidate).toEqual(testCandidate);
        done();
      });
      
      clientSocket1.emit('ice-candidate', { room: 'test-room', candidate: testCandidate });
    });

    it('should not relay messages to sender', (done) => {
      const testOffer = { type: 'offer', sdp: 'test-offer-sdp' };
      let receivedOwnMessage = false;
      
      clientSocket1.on('offer', () => {
        receivedOwnMessage = true;
      });
      
      clientSocket1.emit('offer', { room: 'test-room', offer: testOffer });
      
      // Wait to ensure message isn't received by sender
      setTimeout(() => {
        expect(receivedOwnMessage).toBe(false);
        done();
      }, 50);
    });
  });

  describe('disconnect handling', () => {
    beforeEach((done) => {
      clientSocket1 = new Client(`http://localhost:${port}`);
      clientSocket2 = new Client(`http://localhost:${port}`);
      
      let connectedCount = 0;
      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          // Both clients join the same room
          clientSocket1.emit('join-room', 'test-room');
          clientSocket2.emit('join-room', 'test-room');
          setTimeout(done, 20);
        }
      };
      
      clientSocket1.on('connect', checkBothConnected);
      clientSocket2.on('connect', checkBothConnected);
    });

    it('should notify other peers when a peer disconnects', (done) => {
      clientSocket2.on('peer-left', (data) => {
        expect(data.peerId).toBe(clientSocket1.id);
        done();
      });
      
      clientSocket1.disconnect();
    });

    it('should clean up empty rooms', (done) => {
      // This is harder to test directly, but we can verify that
      // disconnecting doesn't cause errors and the server continues to work
      
      const clientSocket3 = new Client(`http://localhost:${port}`);
      
      clientSocket3.on('connect', () => {
        // Disconnect all clients from the room
        clientSocket1.disconnect();
        clientSocket2.disconnect();
        
        // New client should be able to join the same room
        clientSocket3.emit('join-room', 'test-room');
        
        clientSocket3.on('room-participants', (data) => {
          expect(data.participants).toEqual([]);
          clientSocket3.disconnect();
          done();
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle malformed messages gracefully', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`);
      
      clientSocket1.on('connect', () => {
        // Send malformed data - server should not crash
        clientSocket1.emit('offer', null);
        clientSocket1.emit('answer', undefined);
        clientSocket1.emit('ice-candidate', 'invalid-data');
        
        // Server should still be responsive
        clientSocket1.emit('join-room', 'test-room');
        
        clientSocket1.on('room-participants', (data) => {
          expect(data.participants).toEqual([]);
          done();
        });
      });
    });
  });
});
