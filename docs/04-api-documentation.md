# 04 - API Documentation

## 📚 Complete API Reference

### **Overview**

This document provides comprehensive API documentation for all classes, methods, events, and interfaces in the P2P Messenger system.

### **🎯 Core Classes**

## **P2PApp Class**

The main application orchestrator that provides the high-level API for P2P communication.

### **Constructor**

```javascript
new P2PApp(config);
```

**Parameters:**

- `config` (Object, optional): Configuration object
  - `signalingServer` (string): Signaling server URL (default: "http://localhost:4000")
  - `webrtc` (Object): WebRTC configuration options
  - `capabilities` (Object): Initial peer capabilities

**Example:**

```javascript
const app = new P2PApp({
  signalingServer: "http://localhost:4000",
  webrtc: {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  },
});
```

### **Methods**

#### **Connection Management**

**`async connect()`**

- **Description**: Connect to the signaling server
- **Returns**: `Promise<string>` - Peer ID
- **Throws**: Connection error if failed

```javascript
try {
  const peerId = await app.connect();
  console.log(`Connected as ${peerId}`);
} catch (error) {
  console.error("Connection failed:", error);
}
```

**`async joinRoom(roomId)`**

- **Description**: Join a room for peer discovery
- **Parameters**: `roomId` (string) - Room identifier
- **Returns**: `Promise<string>` - Peer ID
- **Throws**: Error if not connected

```javascript
await app.joinRoom("room123");
```

**`isConnected()`**

- **Description**: Check if connected to signaling server
- **Returns**: `boolean`

**`getPeerId()`**

- **Description**: Get current peer ID
- **Returns**: `string | null`

**`disconnect()`**

- **Description**: Disconnect from signaling server and clean up all connections
- **Returns**: `void`

```javascript
app.disconnect(); // Clean shutdown
```

**`getCurrentRoom()`**

- **Description**: Get current room ID
- **Returns**: `string | null`

```javascript
const roomId = app.getCurrentRoom();
```

#### **Messaging**

**`async sendMessage(message)`**

- **Description**: Send message to all connected peers
- **Parameters**: `message` (string) - Message content
- **Returns**: `Promise<Array>` - Send results for each peer

```javascript
const results = await app.sendMessage("Hello, peers!");
console.log("Message sent to", results.length, "peers");
```

#### **File Transfer**

**`async shareFile(file)`**

- **Description**: Share file with all connected peers
- **Parameters**: `file` (File) - File object from input
- **Returns**: `Promise<void>`

```javascript
const fileInput = document.getElementById("file-input");
const file = fileInput.files[0];
await app.shareFile(file);
```

#### **Capability Management**

**`getLocalCapabilities()`**

- **Description**: Get local peer capabilities
- **Returns**: `Object | null` - Capabilities object or null if not initialized

**`getAllRemotePeerCapabilities()`**

- **Description**: Get all remote peer capabilities
- **Returns**: `Map<string, Object>` - Map of peerId to capabilities

**`getRemotePeerCapabilities(peerId)`**

- **Description**: Get specific remote peer capabilities
- **Parameters**: `peerId` (string) - Peer ID
- **Returns**: `Object | null` - Capabilities object or null if not found

**`findPeersWithService(serviceType)`**

- **Description**: Find peers that provide a specific service
- **Parameters**: `serviceType` (string) - Service type to search for
- **Returns**: `Array<string>` - Array of peer IDs

**`providesService(serviceType)`**

- **Description**: Check if local peer provides a specific service
- **Parameters**: `serviceType` (string) - Service type to check
- **Returns**: `boolean`

**`updateCapabilities(updates)`**

- **Description**: Update local capabilities
- **Parameters**: `updates` (Object) - Capability updates

**`getAllConnectionQualities()`**

- **Description**: Get connection quality metrics for all peers
- **Returns**: `Map<string, Object>` - Map of peerId to quality metrics

```javascript
app.updateCapabilities({
  role: "RELAY",
  services: ["messaging", "file_transfer", "relay"],
});

// Find peers with relay service
const relayPeers = app.findPeersWithService("relay");

// Check if local peer provides file transfer
const canTransferFiles = app.providesService("file_transfer");

// Get all connection qualities
const qualities = app.getAllConnectionQualities();
```

### **Events**

#### **Connection Events**

**`connected`**

- **Payload**: `{ peerId: string }`
- **Description**: Fired when connected to signaling server

**`connection-failed`**

- **Payload**: `{ error: Error }`
- **Description**: Fired when connection fails

**`room-joined`**

- **Payload**: `{ roomId: string }`
- **Description**: Fired when successfully joined a room

**`peer-ready`**

- **Payload**: `{ peerId: string }`
- **Description**: Fired when a peer connection is established

**`peer-left`**

- **Payload**: `{ peerId: string }`
- **Description**: Fired when a peer disconnects

**`connection-initiated`**

- **Payload**: `{ peerId: string }`
- **Description**: Fired when a connection attempt is initiated to a peer

**`peer-unreachable`**

- **Payload**: `{ peerId: string }`
- **Description**: Fired when a peer cannot be reached after maximum reconnection attempts

**`disconnected`**

- **Payload**: `{}`
- **Description**: Fired when the local peer disconnects from the system

#### **Message Events**

**`message`**

- **Payload**: `{ peerId: string, message: Object }`
- **Description**: Fired when a message is received

```javascript
app.on("message", (data) => {
  if (data.message.data.type === "message") {
    console.log(`Message from ${data.peerId}: ${data.message.data.content}`);
  }
});
```

#### **File Transfer Events**

**`file-offer`**

- **Payload**: `{ peerId: string, fileId: string, filename: string, size: number }`
- **Description**: Fired when a file is offered

**`file-progress`**

- **Payload**: `{ fileId: string, progress: number }`
- **Description**: Fired during file send progress

**`file-receive-progress`**

- **Payload**: `{ fileId: string, progress: number }`
- **Description**: Fired during file receive progress

**`file-received`**

- **Payload**: `{ fileId: string, filename: string, size: number, downloadUrl: string }`
- **Description**: Fired when file is completely received

**`file-error`**

- **Payload**: `{ fileId: string, error: string }`
- **Description**: Fired when file transfer fails

#### **Capability Events**

**`capabilities-updated`**

- **Payload**: `{ peerId: string, newCapabilities: Object }`
- **Description**: Fired when local capabilities change

**`remote-capabilities-updated`**

- **Payload**: `{ peerId: string, newCapabilities: Object }`
- **Description**: Fired when remote peer capabilities change

**`connection-quality-updated`**

- **Payload**: `{ peerId: string, quality: Object }`
- **Description**: Fired when connection quality metrics update

---

## **P2PConnectionManager Class**

Manages WebRTC connections and data channels.

### **Constructor**

```javascript
new P2PConnectionManager(config);
```

**Parameters:**

- `config` (Object, optional): WebRTC configuration

### **Methods**

**`async createConnection(peerId, isInitiator)`**

- **Description**: Create WebRTC connection to peer
- **Parameters**:
  - `peerId` (string): Target peer ID
  - `isInitiator` (boolean): Whether this peer initiates the connection
- **Returns**: `Promise<RTCPeerConnection>`

**`async sendReliable(peerId, data, options)`**

- **Description**: Send data reliably to peer
- **Parameters**:
  - `peerId` (string): Target peer ID
  - `data` (any): Data to send
  - `options` (Object): Send options
- **Returns**: `Promise<void>`

**`getConnectedPeers()`**

- **Description**: Get list of connected peer IDs
- **Returns**: `Array<string>`

**`getConnectionQuality(peerId)`**

- **Description**: Get connection quality metrics
- **Parameters**: `peerId` (string): Peer ID
- **Returns**: `Object | null` - Quality metrics

**`cleanup(peerId)`**

- **Description**: Clean up connection to peer
- **Parameters**: `peerId` (string): Peer ID

**`getConnectionStatus(peerId)`**

- **Description**: Get detailed connection status for a peer
- **Parameters**: `peerId` (string): Peer ID
- **Returns**: `Object` - Connection status with connectionState, iceConnectionState, dataChannelState

**`hasConnection(peerId)`**

- **Description**: Check if peer has a working connection (both WebRTC and data channel ready)
- **Parameters**: `peerId` (string): Peer ID
- **Returns**: `boolean`

**`isDataChannelOpen(peerId)`**

- **Description**: Check if data channel is open for a peer
- **Parameters**: `peerId` (string): Peer ID
- **Returns**: `boolean`

#### **Service-Aware Connection Management**

**`createServiceConnection(peerId, serviceType, isInitiator)`**

- **Description**: Create connection for specific service
- **Parameters**:
  - `peerId` (string): Target peer ID
  - `serviceType` (string): Service type
  - `isInitiator` (boolean): Whether this peer initiates
- **Returns**: `Promise<RTCPeerConnection>`

**`getServiceConnections(serviceType)`**

- **Description**: Get all active connections for a service
- **Parameters**: `serviceType` (string): Service type
- **Returns**: `Array<{peerId: string, connection: RTCPeerConnection}>`

**`getPeerServices(peerId)`**

- **Description**: Get all services for a specific peer
- **Parameters**: `peerId` (string): Peer ID
- **Returns**: `Array<string>` - Array of service types

**`peerProvidesService(peerId, serviceType)`**

- **Description**: Check if peer provides a specific service
- **Parameters**:
  - `peerId` (string): Peer ID
  - `serviceType` (string): Service type
- **Returns**: `boolean`

---

## **MinimalSignaling Class**

Handles signaling server communication.

### **Constructor**

```javascript
new MinimalSignaling(serverUrl);
```

**Parameters:**

- `serverUrl` (string): Signaling server URL

### **Methods**

**`async connect()`**

- **Description**: Connect to signaling server
- **Returns**: `Promise<string>` - Peer ID

**`async joinRoom(roomId)`**

- **Description**: Join room for peer discovery
- **Parameters**: `roomId` (string): Room ID

**`sendOffer(offer)`**

- **Description**: Send WebRTC offer
- **Parameters**: `offer` (RTCSessionDescription): WebRTC offer

**`sendAnswer(answer)`**

- **Description**: Send WebRTC answer
- **Parameters**: `answer` (RTCSessionDescription): WebRTC answer

**`sendIceCandidate(candidate)`**

- **Description**: Send ICE candidate
- **Parameters**: `candidate` (RTCIceCandidate): ICE candidate

**`isConnected()`**

- **Description**: Check connection status
- **Returns**: `boolean`

**`disconnect()`**

- **Description**: Disconnect from server

---

## **PeerCapabilityManager Class**

Manages peer capabilities and service discovery.

### **Constructor**

```javascript
new PeerCapabilityManager(peerId, config);
```

**Parameters:**

- `peerId` (string): Local peer ID
- `config` (Object): Initial capabilities configuration

### **Methods**

**`getLocalCapabilities()`**

- **Description**: Get local capabilities
- **Returns**: `Object` - Capabilities object

**`updateLocalCapabilities(updates)`**

- **Description**: Update local capabilities
- **Parameters**: `updates` (Object): Capability updates

**`getRemotePeerCapabilities(peerId)`**

- **Description**: Get remote peer capabilities
- **Parameters**: `peerId` (string): Peer ID
- **Returns**: `Object | null`

**`findPeersWithService(serviceType)`**

- **Description**: Find peers providing a service
- **Parameters**: `serviceType` (string): Service type
- **Returns**: `Array<string>` - Peer IDs

**`providesService(serviceType)`**

- **Description**: Check if local peer provides service
- **Parameters**: `serviceType` (string): Service type
- **Returns**: `boolean`

---

## **📋 Data Structures**

### **Capability Object**

```javascript
{
  peerId: "peer-123",
  role: "BASIC" | "RELAY" | "SUPER_PEER",
  services: Set<string>, // ["messaging", "file_transfer", "relay"]
  resources: {
    maxConnections: number,
    maxBandwidth: string,
    availableStorage: number, // MB
    uptime: number,          // 0-1
    reliability: number      // 0-1
  },
  location: {
    region: string,
    timezone: string
  },
  lastUpdated: number,
  version: string
}
```

### **Connection Quality Object**

```javascript
{
  overallScore: number,        // 0-1
  latency: number,            // milliseconds
  packetLossRate: number,     // 0-1
  availableOutgoingBitrate: number, // bits per second
  timestamp: number
}
```

### **Message Object**

```javascript
{
  id: string,
  data: {
    type: "message" | "file-offer" | "file-chunk" | "file-complete",
    content?: string,
    timestamp: number,
    from: string
  }
}
```

### **File Transfer Objects**

**File Offer:**

```javascript
{
  type: "file-offer",
  fileId: string,
  name: string,           // Note: uses 'name', not 'filename'
  size: number,
  type: string,           // MIME type
  timestamp: number,
  from: string            // Sender peer ID
}
```

**File Chunk:**

```javascript
{
  type: "file-chunk",
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
  data: Array<number>     // Uint8Array converted to array for JSON serialization
}
```

**File Complete:**

```javascript
{
  type: "file-complete",
  fileId: string
}
```

---

## **🔧 Usage Examples**

### **Basic Setup**

```javascript
import { P2PApp } from "./lib/P2PApp.js";

const app = new P2PApp({
  signalingServer: "http://localhost:4000",
});

// Connect and join room
await app.connect();
await app.joinRoom("my-room");

// Set up event listeners
app.on("peer-ready", ({ peerId }) => {
  console.log(`Peer connected: ${peerId}`);
});

app.on("message", ({ peerId, message }) => {
  console.log(`Message from ${peerId}: ${message.data.content}`);
});

// Send message
await app.sendMessage("Hello, world!");
```

### **File Transfer**

```javascript
// Send file
const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (file) {
    await app.shareFile(file);
  }
});

// Handle received files
app.on("file-received", ({ filename, downloadUrl }) => {
  console.log(`File received: ${filename}`);
  // Create download link
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  link.click();
});
```

### **Capability Management**

```javascript
// Update capabilities
app.updateCapabilities({
  role: "RELAY",
  services: ["messaging", "file_transfer", "relay"],
  resources: {
    maxConnections: 20,
    maxBandwidth: "100mbps",
  },
});

// Find peers with specific service
const relayPeers = app.capabilityManager.findPeersWithService("relay");
console.log("Relay peers:", relayPeers);
```

---

## **⚠️ Error Handling**

### **Common Error Types**

- **ConnectionError**: Signaling server connection issues
- **WebRTCError**: Peer connection establishment failures
- **FileTransferError**: File transfer failures
- **CapabilityError**: Capability management errors

### **Error Handling Pattern**

```javascript
try {
  await app.connect();
  await app.joinRoom("room123");
} catch (error) {
  if (error.name === "ConnectionError") {
    console.error("Failed to connect to signaling server");
  } else if (error.name === "WebRTCError") {
    console.error("WebRTC connection failed");
  }
  // Handle error appropriately
}
```
