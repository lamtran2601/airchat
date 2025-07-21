// P2P Type Definitions for the chat application

// Core P2P Types
export interface PeerInfo {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'offline' | 'connecting' | 'connected' | 'disconnected';
  lastSeen?: Date;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'system';
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  replyTo?: string;
  metadata?: Record<string, any>;
}

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
  chunks: FileChunk[];
  timestamp: Date;
  error?: string;
  metadata?: {
    mimeType?: string;
    chunks?: number;
    chunkSize?: number;
  };
}

export interface FileChunk {
  id: string;
  transferId: string;
  index: number;
  data: ArrayBuffer;
  size: number;
  checksum?: string;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  peer: PeerInfo;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  lastActivity: Date;
  reconnectAttempts: number;
  error?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
}

export interface P2PConfig {
  iceServers: RTCIceServer[];
  signalingUrl: string;
  signalingServer: string; // Alias for frontend compatibility
  maxReconnectAttempts: number;
  reconnectDelay: number;
  chunkSize: number;
  maxFileSize: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  maxRetries: number;
  enableLogging?: boolean;
  autoReconnect?: boolean;
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

export type EventHandler<T = any> = (event: T) => void;

// Type aliases for compatibility
export type MessageStatus = Message['status'];
export type MessageType = Message['type'];
export type FileTransferStatus = FileTransfer['status'];
export type NotificationType = Notification['type'];

// Event types for P2P communication (frontend-specific extensions)
export interface P2PEvents {
  // Connection events
  'peer-connected': { peer: PeerInfo };
  'peer-disconnected': { peer: PeerInfo };
  'connection-state-changed': { peerId: string; state: ConnectionState };

  // Signaling events
  'offer-received': { senderId: string; offer: RTCSessionDescriptionInit };
  'answer-received': { senderId: string; answer: RTCSessionDescriptionInit };
  'ice-candidate-received': {
    senderId: string;
    candidate: RTCIceCandidateInit;
  };

  // Message events
  'message-received': { message: Message };
  'message-sent': { peerId: string; message: Message };

  // File transfer events
  'file-transfer-request': { transfer: FileTransfer };
  'file-transfer-accepted': { transferId: string };
  'file-transfer-rejected': { transferId: string };
  'file-transfer-progress': { transferId: string; progress: number };
  'file-transfer-completed': { transferId: string };
  'file-transfer-failed': { transferId: string; error: string };

  // Data channel events
  'data-received': { peerId: string; data: any };
  'data-sent': { peerId: string; data: any };
}

// Utility types
export type P2PEventHandler<T extends keyof P2PEvents> = (
  data: P2PEvents[T]
) => void;

export interface P2PEventEmitter {
  on<T extends keyof P2PEvents>(event: T, handler: P2PEventHandler<T>): void;
  off<T extends keyof P2PEvents>(event: T, handler: P2PEventHandler<T>): void;
  emit<T extends keyof P2PEvents>(event: T, data: P2PEvents[T]): void;
  removeAllListeners(): void;
}

// Store state interface
export interface P2PStoreState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  currentRoomId: string | null;
  peers: Map<string, PeerInfo>;
  connectionStates: Map<string, ConnectionState>;

  // Messages
  messages: Message[];

  // File transfers
  fileTransfers: FileTransfer[];

  // UI state
  selectedPeerId: string | null;
  showFileTransfer: boolean;
  notifications: Notification[];

  // User info
  currentUserId: string | null;
  currentUserName: string | null;
}

// Store actions interface
export interface P2PStoreActions {
  // Connection actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setCurrentRoomId: (roomId: string | null) => void;
  setCurrentUser: (userId: string, userName: string) => void;
  addPeer: (peer: PeerInfo) => void;
  removePeer: (peerId: string) => void;
  updateConnectionState: (peerId: string, state: ConnectionState) => void;

  // Message actions
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // File transfer actions
  addFileTransfer: (transfer: FileTransfer) => void;
  updateFileTransfer: (
    transferId: string,
    updates: Partial<FileTransfer>
  ) => void;
  removeFileTransfer: (transferId: string) => void;

  // UI actions
  setSelectedPeer: (peerId: string | null) => void;
  setShowFileTransfer: (show: boolean) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;

  // Utility actions
  reset: () => void;
}

// Combined store interface
export type P2PStore = P2PStoreState & P2PStoreActions;

// Selector types
export type P2PSelector<T> = (state: P2PStore) => T;

// Common selectors
export const selectConnectedPeers: P2PSelector<PeerInfo[]> = state =>
  Array.from(state.peers.values()).filter(
    peer => state.connectionStates.get(peer.id)?.status === 'connected'
  );

export const selectPeerById: (
  peerId: string
) => P2PSelector<PeerInfo | undefined> = peerId => state =>
  state.peers.get(peerId);

export const selectMessagesByPeer: (peerId: string) => P2PSelector<Message[]> =
  peerId => state =>
    state.messages.filter(
      msg =>
        msg.senderId === peerId ||
        (msg.senderId === state.currentUserId &&
          state.selectedPeerId === peerId)
    );

export const selectActiveFileTransfers: P2PSelector<FileTransfer[]> = state =>
  state.fileTransfers.filter(
    transfer => !['completed', 'failed', 'rejected'].includes(transfer.status)
  );

export const selectUnreadNotifications: P2PSelector<Notification[]> = state =>
  state.notifications.filter(notification => notification.autoClose !== false);
