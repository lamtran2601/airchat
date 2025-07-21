import type { P2PConfig } from '@p2p/types';

export const defaultP2PConfig: P2PConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  signalingUrl: 'http://localhost:4000',
  signalingServer: 'http://localhost:4000', // Add for frontend compatibility
  maxReconnectAttempts: 3,
  reconnectDelay: 1000, // 1 second
  chunkSize: 16384, // 16KB chunks for file transfer
  maxFileSize: 100 * 1024 * 1024, // 100MB max file size
};
