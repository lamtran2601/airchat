import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { SignalingService } from '../services/SignalingService.js';

describe('API Endpoints', () => {
  let app: express.Application;
  let server: any;
  let io: Server;

  beforeEach(() => {
    // Reset SignalingService static state
    (SignalingService as any).rooms = new Map();
    (SignalingService as any).peers = new Map();
    (SignalingService as any).stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalRooms: 0,
      messagesRelayed: 0,
    };

    // Create Express app with same configuration as main app
    app = express();
    server = createServer(app);

    // Configure CORS for Socket.IO
    io = new Server(server, {
      cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Middleware
    app.use(
      helmet({
        contentSecurityPolicy: false,
      })
    );
    app.use(compression());
    app.use(
      cors({
        origin: 'http://localhost:3000',
        credentials: true,
      })
    );
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // API routes
    app.get('/api/stats', (_req, res) => {
      const stats = SignalingService.getStats();
      res.json(stats);
    });

    // Initialize signaling service
    new SignalingService(io);
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status with correct structure', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      
      // Validate timestamp format (ISO string)
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
      
      // Validate uptime is a number
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      
      // Validate version
      expect(typeof response.body.version).toBe('string');
    });

    it('should return correct content-type header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => request(app).get('/health'));
      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  describe('GET /api/stats', () => {
    it('should return initial stats with correct structure', async () => {
      const response = await request(app).get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalConnections', 0);
      expect(response.body).toHaveProperty('activeConnections', 0);
      expect(response.body).toHaveProperty('totalRooms', 0);
      expect(response.body).toHaveProperty('messagesRelayed', 0);
      expect(response.body).toHaveProperty('rooms');
      expect(response.body).toHaveProperty('timestamp');
      
      expect(Array.isArray(response.body.rooms)).toBe(true);
      expect(response.body.rooms).toHaveLength(0);
      
      // Validate timestamp format
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should return correct content-type header', async () => {
      const response = await request(app).get('/api/stats');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should reflect updated stats after SignalingService changes', async () => {
      // Manually update stats to simulate activity
      (SignalingService as any).stats.totalConnections = 5;
      (SignalingService as any).stats.activeConnections = 3;
      (SignalingService as any).stats.totalRooms = 2;
      (SignalingService as any).stats.messagesRelayed = 10;

      // Add some mock rooms
      const rooms = new Map();
      rooms.set('room1', new Set(['peer1', 'peer2']));
      rooms.set('room2', new Set(['peer3']));
      (SignalingService as any).rooms = rooms;

      const response = await request(app).get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalConnections).toBe(5);
      expect(response.body.activeConnections).toBe(3);
      expect(response.body.totalRooms).toBe(2);
      expect(response.body.messagesRelayed).toBe(10);
      expect(response.body.rooms).toHaveLength(2);
      
      // Check room details
      const room1 = response.body.rooms.find((r: any) => r.id === 'room1');
      const room2 = response.body.rooms.find((r: any) => r.id === 'room2');
      
      expect(room1).toBeDefined();
      expect(room1.peerCount).toBe(2);
      expect(room1.peers).toEqual(['peer1', 'peer2']);
      
      expect(room2).toBeDefined();
      expect(room2.peerCount).toBe(1);
      expect(room2.peers).toEqual(['peer3']);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => request(app).get('/api/stats'));
      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalConnections');
        expect(response.body).toHaveProperty('rooms');
      });
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app).get('/non-existent');

      expect(response.status).toBe(404);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/health')
        .send('invalid-json');

      expect(response.status).toBe(404); // POST not allowed on /health
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/stats')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });
});
