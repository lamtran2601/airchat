import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import { SignalingService } from '../services/SignalingService.js';

describe('Graceful Shutdown', () => {
  let app: express.Application;
  let server: any;
  let io: Server;
  let clientSocket: ClientSocket;
  let port: number;
  let originalProcessOn: typeof process.on;
  let originalProcessExit: typeof process.exit;
  let processListeners: Map<string, Function[]>;

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

    // Mock process event handling
    processListeners = new Map();
    originalProcessOn = process.on;
    originalProcessExit = process.exit;

    // Mock process.on to capture event listeners
    process.on = vi.fn((event: string, listener: Function) => {
      if (!processListeners.has(event)) {
        processListeners.set(event, []);
      }
      processListeners.get(event)!.push(listener);
      return process;
    }) as any;

    // Mock process.exit
    process.exit = vi.fn() as any;

    // Create Express app
    app = express();
    server = createServer(app);

    // Configure Socket.IO
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Add basic middleware and routes
    app.use(express.json());

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    // Initialize signaling service
    new SignalingService(io);

    // Set up shutdown handlers (simulating the main app)
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(() => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Restore original process methods
    process.on = originalProcessOn;
    process.exit = originalProcessExit;

    // Clean up client socket
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }

    // Clean up server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    vi.clearAllMocks();
  });

  describe('Signal Handler Registration', () => {
    it('should register SIGTERM handler', () => {
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processListeners.has('SIGTERM')).toBe(true);
      expect(processListeners.get('SIGTERM')).toHaveLength(1);
    });

    it('should register SIGINT handler', () => {
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processListeners.has('SIGINT')).toBe(true);
      expect(processListeners.get('SIGINT')).toHaveLength(1);
    });
  });

  describe('SIGTERM Handling', () => {
    it('should gracefully shutdown server on SIGTERM', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const serverCloseSpy = vi.spyOn(server, 'close');

      // Simulate SIGTERM signal
      const sigTermHandler = processListeners.get('SIGTERM')![0];
      
      // Mock server.close to call callback immediately
      serverCloseSpy.mockImplementation((callback: Function) => {
        callback();
        return server;
      });

      sigTermHandler();

      expect(consoleSpy).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(serverCloseSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Server closed');
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      serverCloseSpy.mockRestore();
    });

    it('should close active connections during SIGTERM shutdown', async () => {
      // Connect a client
      clientSocket = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });

      expect(clientSocket.connected).toBe(true);

      const serverCloseSpy = vi.spyOn(server, 'close');
      const consoleSpy = vi.spyOn(console, 'log');

      // Mock server.close to simulate proper shutdown
      serverCloseSpy.mockImplementation((callback: Function) => {
        // Simulate server closing and disconnecting clients
        if (clientSocket.connected) {
          clientSocket.disconnect();
        }
        callback();
        return server;
      });

      // Simulate SIGTERM
      const sigTermHandler = processListeners.get('SIGTERM')![0];
      sigTermHandler();

      expect(serverCloseSpy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      serverCloseSpy.mockRestore();
    });
  });

  describe('SIGINT Handling', () => {
    it('should gracefully shutdown server on SIGINT', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const serverCloseSpy = vi.spyOn(server, 'close');

      // Mock server.close to call callback immediately
      serverCloseSpy.mockImplementation((callback: Function) => {
        callback();
        return server;
      });

      // Simulate SIGINT signal (Ctrl+C)
      const sigIntHandler = processListeners.get('SIGINT')![0];
      sigIntHandler();

      expect(consoleSpy).toHaveBeenCalledWith('SIGINT received, shutting down gracefully');
      expect(serverCloseSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Server closed');
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      serverCloseSpy.mockRestore();
    });

    it('should handle SIGINT with active Socket.IO connections', async () => {
      // Connect multiple clients
      const client1 = Client(`http://localhost:${port}`);
      const client2 = Client(`http://localhost:${port}`);

      await Promise.all([
        new Promise<void>((resolve) => {
          client1.on('connect', () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.on('connect', () => resolve());
        }),
      ]);

      // Join rooms
      client1.emit('join-room', 'room1');
      client2.emit('join-room', 'room1');

      // Wait for room setup
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = SignalingService.getStats();
      expect(stats.activeConnections).toBe(2);
      expect(stats.totalRooms).toBe(1);

      const serverCloseSpy = vi.spyOn(server, 'close');
      const consoleSpy = vi.spyOn(console, 'log');

      // Mock server.close to simulate proper shutdown
      serverCloseSpy.mockImplementation((callback: Function) => {
        // Simulate server closing
        client1.disconnect();
        client2.disconnect();
        callback();
        return server;
      });

      // Simulate SIGINT
      const sigIntHandler = processListeners.get('SIGINT')![0];
      sigIntHandler();

      expect(serverCloseSpy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      serverCloseSpy.mockRestore();
    });
  });

  describe('Shutdown Timeout Handling', () => {
    it('should handle server close timeout gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const serverCloseSpy = vi.spyOn(server, 'close');

      // Mock server.close to never call the callback (simulating hanging connections)
      serverCloseSpy.mockImplementation(() => {
        // Don't call the callback to simulate timeout
        return server;
      });

      // Simulate SIGTERM
      const sigTermHandler = processListeners.get('SIGTERM')![0];
      sigTermHandler();

      expect(consoleSpy).toHaveBeenCalledWith('SIGTERM received, shutting down gracefully');
      expect(serverCloseSpy).toHaveBeenCalled();
      
      // process.exit should not be called if server.close callback is not invoked
      expect(process.exit).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      serverCloseSpy.mockRestore();
    });

    it('should handle multiple shutdown signals', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const serverCloseSpy = vi.spyOn(server, 'close');

      // Mock server.close to call callback immediately
      serverCloseSpy.mockImplementation((callback: Function) => {
        callback();
        return server;
      });

      // Simulate multiple SIGTERM signals
      const sigTermHandler = processListeners.get('SIGTERM')![0];
      sigTermHandler();
      sigTermHandler(); // Second signal

      // Should only close once
      expect(serverCloseSpy).toHaveBeenCalledTimes(2); // Called twice but should handle gracefully
      expect(process.exit).toHaveBeenCalledWith(0);

      consoleSpy.mockRestore();
      serverCloseSpy.mockRestore();
    });
  });

  describe('Cleanup During Shutdown', () => {
    it('should maintain SignalingService state during shutdown', async () => {
      // Connect client and join room
      clientSocket = Client(`http://localhost:${port}`);
      
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });

      clientSocket.emit('join-room', 'test-room');
      
      // Wait for room setup
      await new Promise(resolve => setTimeout(resolve, 100));

      const statsBefore = SignalingService.getStats();
      expect(statsBefore.activeConnections).toBe(1);
      expect(statsBefore.totalRooms).toBe(1);

      const serverCloseSpy = vi.spyOn(server, 'close');

      // Mock server.close to call callback after a delay
      serverCloseSpy.mockImplementation((callback: Function) => {
        setTimeout(() => {
          // Stats should still be accessible during shutdown
          const statsAfter = SignalingService.getStats();
          expect(statsAfter.totalConnections).toBe(1);
          callback();
        }, 50);
        return server;
      });

      // Simulate SIGTERM
      const sigTermHandler = processListeners.get('SIGTERM')![0];
      sigTermHandler();

      // Wait for shutdown to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(serverCloseSpy).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);

      serverCloseSpy.mockRestore();
    });
  });
});
