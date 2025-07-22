# 📡 P2P Messenger API Documentation

## Overview

The P2P Messenger uses a hybrid communication model:
1. **Signaling Server API**: WebSocket-based communication for connection establishment
2. **WebRTC Data Channels**: Direct peer-to-peer communication for messages
3. **Client-side API**: JavaScript classes for P2P functionality

## Signaling Server API

### Connection Endpoint
- **URL**: `ws://localhost:4000` (WebSocket)
- **Protocol**: Socket.IO
- **Transport**: WebSocket (preferred) or HTTP polling

### Authentication
Currently no authentication required. Clients are identified by their Socket.IO session ID.

## WebSocket Events

### Client → Server Events

#### `join-room`
Join a specific room for P2P communication.

**Payload:**
```javascript
{
  roomId: string  // Room identifier (e.g., "room123")
}
```

**Example:**
```javascript
socket.emit('join-room', 'my-chat-room');
```

#### `offer`
Send WebRTC offer to peers in the room.

**Payload:**
```javascript
{
  room: string,           // Room ID
  offer: RTCSessionDescription  // WebRTC offer object
}
```

**Example:**
```javascript
socket.emit('offer', {
  room: 'my-chat-room',
  offer: {
    type: 'offer',
    sdp: '...'  // SDP string
  }
});
```

#### `answer`
Send WebRTC answer to a specific peer.

**Payload:**
```javascript
{
  room: string,            // Room ID
  answer: RTCSessionDescription  // WebRTC answer object
}
```

**Example:**
```javascript
socket.emit('answer', {
  room: 'my-chat-room',
  answer: {
    type: 'answer',
    sdp: '...'  // SDP string
  }
});
```

#### `ice-candidate`
Send ICE candidate for connection establishment.

**Payload:**
```javascript
{
  room: string,              // Room ID
  candidate: RTCIceCandidate // ICE candidate object
}
```

**Example:**
```javascript
socket.emit('ice-candidate', {
  room: 'my-chat-room',
  candidate: {
    candidate: 'candidate:...',
    sdpMLineIndex: 0,
    sdpMid: '0'
  }
});
```

### Server → Client Events

#### `peer-joined`
Notification when a new peer joins the room.

**Payload:**
```javascript
{
  peerId: string  // Socket ID of the joining peer
}
```

#### `room-participants`
List of existing participants when joining a room.

**Payload:**
```javascript
{
  participants: string[]  // Array of peer Socket IDs
}
```

#### `peer-left`
Notification when a peer leaves the room.

**Payload:**
```javascript
{
  peerId: string  // Socket ID of the leaving peer
}
```

#### `offer`
Relayed WebRTC offer from another peer.

**Payload:**
```javascript
{
  from: string,           // Sender's Socket ID
  offer: RTCSessionDescription  // WebRTC offer
}
```

#### `answer`
Relayed WebRTC answer from another peer.

**Payload:**
```javascript
{
  from: string,            // Sender's Socket ID
  answer: RTCSessionDescription  // WebRTC answer
}
```

#### `ice-candidate`
Relayed ICE candidate from another peer.

**Payload:**
```javascript
{
  from: string,              // Sender's Socket ID
  candidate: RTCIceCandidate // ICE candidate
}
```

## WebRTC Data Channel Protocol

### Message Format
All P2P messages use a standardized JSON format:

```javascript
{
  type: string,      // Message type ('message', 'file', 'system')
  id: string,        // Unique message identifier
  timestamp: number, // Unix timestamp
  from: string,      // Sender's peer ID
  data: object       // Message-specific data
}
```

### Message Types

#### Text Message
```javascript
{
  type: 'message',
  id: 'msg_1234567890',
  timestamp: 1640995200000,
  from: 'peer_abc123',
  data: {
    content: 'Hello, world!',
    timestamp: 1640995200000
  }
}
```

#### System Message
```javascript
{
  type: 'system',
  id: 'sys_1234567890',
  timestamp: 1640995200000,
  from: 'system',
  data: {
    content: 'User joined the room',
    level: 'info'  // 'info', 'warning', 'error'
  }
}
```

## Client-side API

### P2PApp Class

#### Constructor
```javascript
const p2pApp = new P2PApp({
  signalingServer: 'http://localhost:4000',  // Signaling server URL
  webrtc: {                                  // WebRTC configuration
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
});
```

#### Methods

##### `connect()`
Connect to the signaling server.
```javascript
await p2pApp.connect();
```

##### `joinRoom(roomId)`
Join a specific room.
```javascript
await p2pApp.joinRoom('my-room');
```

##### `sendMessage(content)`
Send a message to all connected peers.
```javascript
const results = await p2pApp.sendMessage('Hello everyone!');
```

##### `isConnected()`
Check if connected to signaling server.
```javascript
const connected = p2pApp.isConnected();
```

##### `getPeerId()`
Get the current peer's ID.
```javascript
const peerId = p2pApp.getPeerId();
```

#### Events

##### `connected`
Fired when connected to signaling server.
```javascript
p2pApp.on('connected', (data) => {
  console.log('Connected as:', data.peerId);
});
```

##### `connection-failed`
Fired when connection to signaling server fails.
```javascript
p2pApp.on('connection-failed', (data) => {
  console.error('Connection failed:', data.error);
});
```

##### `room-joined`
Fired when successfully joined a room.
```javascript
p2pApp.on('room-joined', (data) => {
  console.log('Joined room:', data.roomId);
});
```

##### `peer-ready`
Fired when a P2P connection with a peer is established.
```javascript
p2pApp.on('peer-ready', (data) => {
  console.log('Peer connected:', data.peerId);
});
```

##### `peer-left`
Fired when a peer disconnects.
```javascript
p2pApp.on('peer-left', (data) => {
  console.log('Peer disconnected:', data.peerId);
});
```

##### `message`
Fired when receiving a message from a peer.
```javascript
p2pApp.on('message', (data) => {
  console.log('Message from', data.peerId, ':', data.message);
});
```

##### `connection-error`
Fired when there's an error with a peer connection.
```javascript
p2pApp.on('connection-error', (data) => {
  console.error('Connection error with', data.peerId, ':', data.error);
});
```

## Error Handling

### HTTP Status Codes
The signaling server uses standard HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `500`: Internal Server Error

### WebSocket Error Events
Socket.IO provides built-in error handling:
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### WebRTC Error Handling
```javascript
peerConnection.addEventListener('connectionstatechange', () => {
  if (peerConnection.connectionState === 'failed') {
    console.error('WebRTC connection failed');
  }
});
```

## Rate Limiting

Currently no rate limiting is implemented. Recommended limits:
- **Room joins**: 10 per minute per IP
- **Messages**: 100 per minute per peer
- **Signaling events**: 1000 per minute per connection

## Security Considerations

### Current Security
- CORS enabled for `http://localhost:3000`
- Basic input validation on room IDs
- Automatic cleanup of disconnected peers

### Security Limitations
- No authentication or authorization
- No message encryption
- No protection against spam or abuse
- No rate limiting

### Recommended Security Enhancements
- Implement JWT-based authentication
- Add end-to-end encryption for messages
- Implement rate limiting
- Add input sanitization
- Use HTTPS/WSS in production

## Usage Examples

### Complete Connection Flow
```javascript
// Initialize P2P app
const p2pApp = new P2PApp({
  signalingServer: 'http://localhost:4000'
});

// Set up event listeners
p2pApp.on('connected', () => console.log('Connected!'));
p2pApp.on('peer-ready', (data) => console.log('Peer ready:', data.peerId));
p2pApp.on('message', (data) => console.log('Message:', data.message));

// Connect and join room
await p2pApp.connect();
await p2pApp.joinRoom('test-room');

// Send message
await p2pApp.sendMessage('Hello, world!');
```

### Error Handling Example
```javascript
try {
  await p2pApp.connect();
  await p2pApp.joinRoom('my-room');
} catch (error) {
  if (error.code === 'CONNECTION_FAILED') {
    console.error('Failed to connect to signaling server');
  } else if (error.code === 'ROOM_JOIN_FAILED') {
    console.error('Failed to join room');
  }
}
```
