# 📡 API Specification

## Overview

This document defines the communication protocols for the P2P Chat & File Transfer application, including signaling server APIs and P2P data channel protocols.

---

## Signaling Server API

### Connection & Room Management

#### Join Room
**Event**: `join-room`  
**Direction**: Client → Server  
**Purpose**: Join a chat room for peer discovery

```typescript
// Request
interface JoinRoomRequest {
  roomId: string;        // 6-character alphanumeric room code
  userInfo?: {
    displayName?: string;
    avatar?: string;
  };
}

// Response Events
interface PeerJoinedEvent {
  peerId: string;        // Socket ID of the peer
  userInfo?: UserInfo;
}

interface RoomStateEvent {
  roomId: string;
  peers: Array<{
    peerId: string;
    userInfo?: UserInfo;
  }>;
}
```

#### Leave Room
**Event**: `leave-room`  
**Direction**: Client → Server  
**Purpose**: Leave current room

```typescript
// Request
interface LeaveRoomRequest {
  roomId: string;
}

// Response Event
interface PeerLeftEvent {
  peerId: string;
}
```

### WebRTC Signaling

#### Offer Exchange
**Event**: `offer`  
**Direction**: Client → Server → Client  
**Purpose**: Exchange WebRTC offers for connection establishment

```typescript
interface OfferMessage {
  room: string;
  to: string;           // Target peer ID
  offer: RTCSessionDescriptionInit;
  metadata?: {
    timestamp: number;
    connectionId: string;
  };
}
```

#### Answer Exchange
**Event**: `answer`  
**Direction**: Client → Server → Client  
**Purpose**: Exchange WebRTC answers

```typescript
interface AnswerMessage {
  room: string;
  to: string;
  answer: RTCSessionDescriptionInit;
  metadata?: {
    timestamp: number;
    connectionId: string;
  };
}
```

#### ICE Candidate Exchange
**Event**: `ice-candidate`  
**Direction**: Client → Server → Client  
**Purpose**: Exchange ICE candidates for NAT traversal

```typescript
interface IceCandidateMessage {
  room: string;
  to: string;
  candidate: RTCIceCandidateInit;
  metadata?: {
    timestamp: number;
    connectionId: string;
  };
}
```

---

## P2P Data Channel Protocol

### Message Types

#### Text Message
**Type**: `message`  
**Channel**: Main data channel  
**Purpose**: Send text messages between peers

```typescript
interface TextMessage {
  type: "message";
  id: string;           // Unique message ID
  content: string;      // Message text
  timestamp: number;    // Unix timestamp
  sender: {
    peerId: string;
    displayName?: string;
  };
  metadata?: {
    replyTo?: string;   // ID of message being replied to
    edited?: boolean;   // Whether message was edited
  };
}
```

#### Typing Indicator
**Type**: `typing`  
**Channel**: Main data channel  
**Purpose**: Show typing status

```typescript
interface TypingMessage {
  type: "typing";
  isTyping: boolean;
  timestamp: number;
  sender: {
    peerId: string;
    displayName?: string;
  };
}
```

#### Message Delivery Confirmation
**Type**: `delivery-confirmation`  
**Channel**: Main data channel  
**Purpose**: Confirm message receipt

```typescript
interface DeliveryConfirmation {
  type: "delivery-confirmation";
  messageId: string;    // ID of confirmed message
  status: "delivered" | "read";
  timestamp: number;
  sender: {
    peerId: string;
  };
}
```

### File Transfer Protocol

#### File Offer
**Type**: `file-offer`  
**Channel**: Main data channel  
**Purpose**: Initiate file transfer

```typescript
interface FileOffer {
  type: "file-offer";
  transferId: string;   // Unique transfer ID
  file: {
    name: string;
    size: number;       // Bytes
    type: string;       // MIME type
    lastModified?: number;
  };
  metadata?: {
    preview?: string;   // Base64 image preview for images
    description?: string;
  };
  timestamp: number;
  sender: {
    peerId: string;
    displayName?: string;
  };
}
```

#### File Response
**Type**: `file-response`  
**Channel**: Main data channel  
**Purpose**: Accept or decline file transfer

```typescript
interface FileResponse {
  type: "file-response";
  transferId: string;
  action: "accept" | "decline";
  timestamp: number;
  sender: {
    peerId: string;
  };
}
```

#### File Chunk
**Type**: Binary data  
**Channel**: File transfer data channel  
**Purpose**: Transfer file data in chunks

```typescript
// Chunk metadata (sent before binary data)
interface ChunkMetadata {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  checksum?: string;    // MD5 hash of chunk
}

// Binary chunk follows immediately after metadata
```

#### File Progress
**Type**: `file-progress`  
**Channel**: Main data channel  
**Purpose**: Track transfer progress

```typescript
interface FileProgress {
  type: "file-progress";
  transferId: string;
  bytesTransferred: number;
  totalBytes: number;
  speed?: number;       // Bytes per second
  estimatedTimeRemaining?: number; // Seconds
  timestamp: number;
  sender: {
    peerId: string;
  };
}
```

#### File Complete
**Type**: `file-complete`  
**Channel**: Main data channel  
**Purpose**: Signal transfer completion

```typescript
interface FileComplete {
  type: "file-complete";
  transferId: string;
  status: "success" | "error" | "cancelled";
  error?: string;       // Error message if status is "error"
  fileHash?: string;    // Final file hash for verification
  timestamp: number;
  sender: {
    peerId: string;
  };
}
```

---

## Connection Management Protocol

### Connection State Events
**Type**: `connection-state`  
**Channel**: Main data channel  
**Purpose**: Communicate connection status changes

```typescript
interface ConnectionState {
  type: "connection-state";
  state: "connecting" | "connected" | "disconnected" | "reconnecting" | "failed";
  timestamp: number;
  metadata?: {
    reason?: string;    // Reason for state change
    attempt?: number;   // Reconnection attempt number
  };
}
```

### Heartbeat
**Type**: `heartbeat`  
**Channel**: Main data channel  
**Purpose**: Keep connection alive and detect disconnections

```typescript
interface Heartbeat {
  type: "heartbeat";
  timestamp: number;
  sequence: number;     // Incrementing sequence number
}

interface HeartbeatResponse {
  type: "heartbeat-response";
  originalTimestamp: number;
  responseTimestamp: number;
  sequence: number;
}
```

---

## Error Handling Protocol

### Error Message
**Type**: `error`  
**Channel**: Main data channel  
**Purpose**: Communicate errors between peers

```typescript
interface ErrorMessage {
  type: "error";
  errorCode: string;
  message: string;
  details?: any;
  timestamp: number;
  relatedMessageId?: string; // ID of message that caused error
}

// Common error codes
enum ErrorCodes {
  CONNECTION_FAILED = "CONNECTION_FAILED",
  MESSAGE_TOO_LARGE = "MESSAGE_TOO_LARGE",
  FILE_TRANSFER_FAILED = "FILE_TRANSFER_FAILED",
  UNSUPPORTED_MESSAGE_TYPE = "UNSUPPORTED_MESSAGE_TYPE",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
}
```

---

## Data Validation

### Message Size Limits
```typescript
const MESSAGE_LIMITS = {
  TEXT_MESSAGE: 10000,      // 10KB max text message
  FILE_NAME: 255,           // 255 characters max filename
  FILE_SIZE: 1073741824,    // 1GB max file size
  CHUNK_SIZE: 16384,        // 16KB chunks
  DISPLAY_NAME: 50          // 50 characters max display name
};
```

### Rate Limiting
```typescript
const RATE_LIMITS = {
  MESSAGES_PER_SECOND: 10,
  FILES_PER_MINUTE: 5,
  HEARTBEAT_INTERVAL: 30000,  // 30 seconds
  TYPING_THROTTLE: 1000       // 1 second
};
```

---

## Protocol Versioning

### Version Header
All P2P messages include a protocol version for compatibility:

```typescript
interface MessageHeader {
  version: "1.0";
  type: string;
  id: string;
  timestamp: number;
}
```

### Compatibility Matrix
| Client Version | Server Version | Compatible |
|---------------|----------------|------------|
| 1.0.x         | 1.0.x         | ✅ Full    |
| 1.1.x         | 1.0.x         | ✅ Limited |
| 2.0.x         | 1.x.x         | ❌ No      |

---

## Security Considerations

### Message Authentication
- All P2P messages are automatically encrypted via WebRTC DTLS
- Message IDs prevent replay attacks
- Timestamps prevent old message injection

### Input Validation
- All incoming messages validated against schemas
- File types restricted to safe MIME types
- Message content sanitized for XSS prevention

### Rate Limiting
- Per-peer message rate limiting
- File transfer throttling
- Connection attempt limiting

This API specification ensures reliable, secure, and efficient communication between peers while maintaining the simplicity of the P2P architecture.
