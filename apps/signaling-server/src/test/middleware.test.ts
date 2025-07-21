import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { SignalingService } from '../services/SignalingService.js';

describe('Middleware Configuration', () => {
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
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Middleware configuration exactly as in main app
    app.use(
      helmet({
        contentSecurityPolicy: false, // Disable for development
      })
    );
    app.use(compression());
    app.use(
      cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      })
    );
    app.use(express.json());

    // Test endpoints
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    app.get('/api/stats', (_req, res) => {
      const stats = SignalingService.getStats();
      res.json(stats);
    });

    // Test endpoint for large response (compression testing)
    app.get('/test/large', (_req, res) => {
      const largeData = {
        data: 'x'.repeat(10000), // 10KB of data
        timestamp: new Date().toISOString(),
      };
      res.json(largeData);
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

  describe('CORS Middleware', () => {
    it('should set correct CORS headers for allowed origin', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/stats')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
      expect(response.headers['access-control-allow-methods']).toMatch(/GET/);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should only allow configured origin', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-site.com');

      // CORS middleware should only allow the configured origin (localhost:3000)
      // The response should not include the malicious origin in the allow-origin header
      expect(response.headers['access-control-allow-origin']).not.toBe(
        'http://malicious-site.com'
      );

      // It should either be undefined or the configured origin
      const allowOrigin = response.headers['access-control-allow-origin'];
      if (allowOrigin) {
        expect(allowOrigin).toBe('http://localhost:3000');
      }
    });

    it('should allow requests without Origin header (same-origin)', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Helmet Security Middleware', () => {
    it('should set security headers', async () => {
      const response = await request(app).get('/health');

      // Helmet should set various security headers
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should not set Content-Security-Policy header (disabled for development)', async () => {
      const response = await request(app).get('/health');

      // CSP should be disabled as configured
      expect(response.headers['content-security-policy']).toBeUndefined();
    });

    it('should set Referrer-Policy header', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });

    it('should remove X-Powered-By header', async () => {
      const response = await request(app).get('/health');

      // Helmet should remove the default Express X-Powered-By header
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Compression Middleware', () => {
    it('should compress large responses when client accepts gzip', async () => {
      const response = await request(app)
        .get('/test/large')
        .set('Accept-Encoding', 'gzip, deflate');

      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.body.data).toBe('x'.repeat(10000));
    });

    it('should not compress small responses', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept-Encoding', 'gzip, deflate');

      // Small responses typically aren't compressed
      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.body.status).toBe('ok');
    });

    it('should not compress when client does not accept compression', async () => {
      const response = await request(app)
        .get('/test/large')
        .set('Accept-Encoding', 'identity');

      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.body.data).toBe('x'.repeat(10000));
    });

    it('should set Vary header for compressed responses', async () => {
      const response = await request(app)
        .get('/test/large')
        .set('Accept-Encoding', 'gzip, deflate');

      expect(response.headers['vary']).toMatch(/Accept-Encoding/);
    });
  });

  describe('JSON Body Parser Middleware', () => {
    beforeEach(() => {
      // Add a POST endpoint for testing JSON parsing
      app.post('/test/json', (req, res) => {
        res.json({ received: req.body });
      });
    });

    it('should parse JSON request bodies', async () => {
      const testData = { message: 'test', number: 42 };

      const response = await request(app)
        .post('/test/json')
        .send(testData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual(testData);
    });

    it('should handle empty JSON bodies', async () => {
      const response = await request(app)
        .post('/test/json')
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received).toEqual({});
    });

    it('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/test/json')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should handle large JSON payloads within limits', async () => {
      const largeData = {
        data: 'x'.repeat(1000), // 1KB of data
        array: Array(100).fill('test'),
      };

      const response = await request(app)
        .post('/test/json')
        .send(largeData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.received.data).toBe('x'.repeat(1000));
      expect(response.body.received.array).toHaveLength(100);
    });
  });

  describe('Middleware Integration', () => {
    it('should apply all middleware in correct order', async () => {
      const response = await request(app)
        .get('/test/large')
        .set('Origin', 'http://localhost:3000')
        .set('Accept-Encoding', 'gzip, deflate');

      // Should have security headers (helmet)
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');

      // Should have CORS headers
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );

      // Should be compressed
      expect(response.headers['content-encoding']).toBe('gzip');

      // Should have correct content type (express.json)
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle errors gracefully with all middleware', async () => {
      // Add an endpoint that throws an error
      app.get('/test/error', (_req, _res) => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/test/error')
        .set('Origin', 'http://localhost:3000');

      // Should still have security headers even on error
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');

      // Should still have CORS headers
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
    });
  });
});
