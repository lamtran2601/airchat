// Core P2P exports
export { P2PConnectionManager } from './connection/P2PConnectionManager.js';
export { SignalingClient } from './signaling/SignalingClient.js';
export { MessageHandler } from './messaging/MessageHandler.js';
export { FileTransferManager } from './file-transfer/FileTransferManager.js';
export { EventBus } from './utils/EventBus.js';

// Configuration
export { defaultP2PConfig } from './config/defaultConfig.js';

// Utilities
export * from './utils/index.js';

// Re-export types
export type * from '@p2p/types';
