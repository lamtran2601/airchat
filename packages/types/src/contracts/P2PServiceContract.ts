// P2P Service Interface Contract
// This defines the expected API that the frontend requires

import type {
  Message,
  FileTransfer,
  P2PConfig,
  PeerInfo,
  ConnectionState,
} from '../index.js';

// Browser-specific types for compatibility
interface FileType {
  name: string;
  size: number;
  type: string;
}

interface RTCPeerConnectionType {
  // Minimal interface for type compatibility
}

/**
 * Main P2P Service Interface
 * This contract ensures frontend and P2P core stay in sync
 */
export interface IP2PService {
  // Initialization
  initialize(userId: string, userName: string): Promise<void>;

  // Room Management
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(): Promise<void>;

  // Messaging
  sendMessage(peerId: string, content: string, replyTo?: string): Message;
  broadcastMessage(content: string): Message[];

  // File Transfer
  initiateFileTransfer(
    file: FileType,
    receiverId: string
  ): Promise<FileTransfer>;
  acceptFileTransfer(transferId: string): Promise<void>;
  rejectFileTransfer(transferId: string): Promise<void>;

  // Connection Management
  getConnectionStatus(): boolean;
  disconnect(): Promise<void>;

  // Event Handling
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

/**
 * P2P Connection Manager Interface
 * Defines the expected connection management API
 */
export interface IP2PConnectionManager {
  createConnection(
    peerId: string,
    peerInfo?: PeerInfo
  ): Promise<RTCPeerConnectionType>;
  closeConnection(peerId: string): void;
  sendData(peerId: string, data: string): boolean;
  getConnectionState(peerId: string): ConnectionState | undefined;

  // Event emitter functionality
  emit(event: string, data: any): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

/**
 * Message Handler Interface
 * Defines the expected messaging API
 */
export interface IMessageHandler {
  sendMessage(
    peerId: string,
    content: string,
    replyTo?: string,
    sendFunction?: (peerId: string, data: string) => boolean
  ): Message;
  handleMessage(senderId: string, messageData: any): void;
}

/**
 * File Transfer Manager Interface
 * Defines the expected file transfer API
 */
export interface IFileTransferManager {
  // Frontend expects these method names
  sendFile(
    file: FileType,
    receiverId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): Promise<FileTransfer>;
  acceptFileTransfer(
    transferId: string,
    sendFunction?: (peerId: string, data: string) => boolean
  ): Promise<void>;
  rejectFileTransfer(
    transferId: string,
    sendFunction?: (peerId: string, data: string) => boolean
  ): Promise<void>;

  // Core implementation uses these method names
  initiateTransfer(
    file: FileType,
    receiverId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): FileTransfer;
  acceptTransfer(
    transferId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): void;
  rejectTransfer(
    transferId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): void;
}

/**
 * Signaling Client Interface
 * Defines the expected signaling API
 */
export interface ISignalingClient {
  connect(signalingUrl?: string): Promise<void>;
  disconnect(): Promise<void>;
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(): Promise<void>;

  // Event handling
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

/**
 * Configuration Interface
 * Ensures config compatibility between packages
 */
export interface IP2PConfig extends P2PConfig {
  signalingServer?: string; // Optional for backward compatibility
  signalingUrl: string; // Required field
}

/**
 * Event Types for P2P Service
 * Standardizes event names across the application
 */
export type P2PServiceEvents = {
  'peer-connected': { peer: PeerInfo };
  'peer-disconnected': { peer: PeerInfo };
  'message-received': { message: Message };
  'message-sent': { peerId: string; message: Message };
  'file-transfer-request': { transfer: FileTransfer };
  'file-transfer-progress': { transferId: string; progress: number };
  'file-transfer-complete': { transferId: string };
  'file-transfer-error': { transferId: string; error: string };
  'connection-state-changed': { peerId: string; state: ConnectionState };
  'data-channel-open': { peerId: string };
  'data-received': { peerId: string; data: string };
};

/**
 * Type Guards for Runtime Validation
 */
export function isValidP2PConfig(config: any): config is IP2PConfig {
  return (
    config &&
    typeof config === 'object' &&
    (typeof config.signalingUrl === 'string' ||
      typeof config.signalingServer === 'string')
  );
}

export function isValidMessage(message: any): message is Message {
  return (
    message &&
    typeof message.id === 'string' &&
    typeof message.senderId === 'string' &&
    typeof message.content === 'string' &&
    message.timestamp instanceof Date
  );
}
