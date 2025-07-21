// WebRTC Types (for environments without DOM)
export interface RTCSessionDescriptionInit {
  type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RTCPeerConnection {
  createOffer(): Promise<RTCSessionDescriptionInit>;
  createAnswer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  createDataChannel(label: string, options?: any): RTCDataChannel;
  close(): void;
  connectionState: string;
  iceGatheringState: string;
  addEventListener(type: string, listener: any): void;
  removeEventListener(type: string, listener: any): void;
  onicecandidate: ((event: any) => void) | null;
  onconnectionstatechange: ((event?: any) => void) | null;
  ondatachannel: ((event: any) => void) | null;
  onicegatheringstatechange: ((event?: any) => void) | null;
}

export interface RTCDataChannel {
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(): void;
  readyState: string;
  addEventListener(type: string, listener: any): void;
  removeEventListener(type: string, listener: any): void;
  onopen: ((event?: any) => void) | null;
  onclose: ((event?: any) => void) | null;
  onerror: ((error: any) => void) | null;
  onmessage: ((event: any) => void) | null;
}

// Core P2P Types
export interface PeerInfo {
  id: string;
  name?: string;
  avatar?: string;
  status: 'online' | 'offline' | 'connecting' | 'connected' | 'disconnected';
  lastSeen?: Date;
}

export interface Room {
  id: string;
  name?: string;
  peers: PeerInfo[];
  createdAt: Date;
  isPrivate: boolean;
}

// Message Types
export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'system';
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  replyTo?: string;
}

export interface FileMessage extends Message {
  type: 'file';
  file: {
    name: string;
    size: number;
    type: string;
    url?: string;
    transferId: string;
  };
}

// Connection Types
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  peer: PeerInfo;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  lastConnected?: Date;
  reconnectAttempts: number;
}

// Signaling Types
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room';
  payload: any;
  target?: string;
  sender: string;
  timestamp: Date;
}

export interface OfferMessage extends SignalingMessage {
  type: 'offer';
  payload: {
    offer: RTCSessionDescriptionInit;
  };
}

export interface AnswerMessage extends SignalingMessage {
  type: 'answer';
  payload: {
    answer: RTCSessionDescriptionInit;
  };
}

export interface IceCandidateMessage extends SignalingMessage {
  type: 'ice-candidate';
  payload: {
    candidate: RTCIceCandidateInit;
  };
}

// File Transfer Types
export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  senderId: string;
  receiverId: string;
  status:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'transferring'
    | 'in-progress'
    | 'completed'
    | 'failed'
    | 'cancelled';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  timestamp: Date; // Add timestamp for frontend compatibility
  chunks: FileChunk[];
}

export interface FileChunk {
  id: string;
  transferId: string;
  index: number;
  data: ArrayBuffer;
  size: number;
  checksum?: string;
}

// UI State Types
export interface UIState {
  currentRoom?: string;
  selectedPeer?: string;
  isConnecting: boolean;
  showFileTransfer: boolean;
  notifications: Notification[];
  theme: 'light' | 'dark';
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

// Event Types
export type P2PEvent =
  | { type: 'peer-connected'; peer: PeerInfo }
  | { type: 'peer-disconnected'; peer: PeerInfo }
  | { type: 'message-received'; message: Message }
  | { type: 'data-received'; peerId: string; data: string }
  | { type: 'file-transfer-request'; transfer: FileTransfer }
  | { type: 'file-transfer-progress'; transferId: string; progress: number }
  | { type: 'connection-state-changed'; state: ConnectionState };

// Configuration Types
export interface P2PConfig {
  iceServers: RTCIceServer[];
  signalingUrl: string;
  signalingServer?: string; // Backward compatibility with frontend
  maxReconnectAttempts: number;
  reconnectDelay: number;
  chunkSize: number;
  maxFileSize: number;
}

// Error Types
export interface P2PError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export type P2PErrorCode =
  | 'CONNECTION_FAILED'
  | 'SIGNALING_ERROR'
  | 'FILE_TRANSFER_ERROR'
  | 'PEER_NOT_FOUND'
  | 'ROOM_FULL'
  | 'INVALID_MESSAGE'
  | 'NETWORK_ERROR';

// Utility Types
export type EventHandler<T = any> = (event: T) => void;
export type AsyncEventHandler<T = any> = (event: T) => Promise<void>;

// Re-export common types (only in browser environment)
export type Socket = any;

// Export interface contracts
export * from './contracts/P2PServiceContract.js';
