import { MinimalSignaling } from "./MinimalSignaling.js";
import { P2PConnectionManager } from "./P2PConnectionManager.js";
import { PeerCapabilityManager } from "./PeerCapabilityManager.js";

// Complete P2P Application Foundation with Hybrid P2P Capabilities
export class P2PApp {
  constructor(config = {}) {
    this.signaling = new MinimalSignaling(
      config.signalingServer || "http://localhost:4000"
    );
    this.connectionManager = new P2PConnectionManager(config.webrtc);
    this.eventBus = new EventTarget();

    // Initialize capability manager after signaling connects
    this.capabilityManager = null;

    this.currentRoom = null;
    this.isInitiator = false;
    this.pendingConnections = new Set();
    this.roomPeers = new Set(); // Track all peers in the current room
    this.connectionLocks = new Set(); // Prevent simultaneous connection attempts

    // File transfer state management
    this.incomingFiles = new Map(); // fileId -> { metadata, chunks, receivedChunks }

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Signaling events
    this.signaling.on("peer-joined", async (data) => {
      await this.handlePeerJoined(data.peerId);
    });

    this.signaling.on("room-participants", async (data) => {
      // Connect to existing participants when joining a room
      for (const peerId of data.participants) {
        await this.handlePeerJoined(peerId);
      }
    });

    this.signaling.on("offer", async (data) => {
      await this.handleOffer(data.from, data.offer);
    });

    this.signaling.on("answer", async (data) => {
      await this.handleAnswer(data.from, data.answer);
    });

    this.signaling.on("ice-candidate", async (data) => {
      await this.handleIceCandidate(data.from, data.candidate);
    });

    this.signaling.on("peer-left", (data) => {
      this.handlePeerLeft(data.peerId);
    });

    // Connection events
    this.connectionManager.on("peer-connected", (data) => {
      this.pendingConnections.delete(data.peerId);
      this.emit("peer-ready", data);
    });

    this.connectionManager.on("message-received", (data) => {
      const messageData = data.message.data;

      // Handle capability advertisements
      if (messageData.type === "capability_advertisement") {
        if (this.capabilityManager) {
          this.capabilityManager.updateRemotePeerCapabilities(
            data.peerId,
            messageData.capabilities
          );
        }
        return; // Don't emit as regular message
      }

      // Handle file transfer messages
      if (messageData.type === "file-offer") {
        this.handleFileOffer(data.peerId, messageData);
        return;
      }

      if (messageData.type === "file-chunk") {
        this.handleFileChunk(data.peerId, messageData);
        return;
      }

      if (messageData.type === "file-complete") {
        this.handleFileComplete(data.peerId, messageData);
        return;
      }

      // Handle regular messages
      this.emit("message", data);
    });

    this.connectionManager.on("peer-disconnected", (data) => {
      this.emit("peer-disconnected", data);
    });

    this.connectionManager.on("connection-error", (data) => {
      this.pendingConnections.delete(data.peerId);
      this.emit("connection-error", data);
    });

    // Handle ICE candidates from connection manager
    this.connectionManager.on("ice-candidate", (data) => {
      this.signaling.sendIceCandidate(data.candidate);
    });

    // Handle connection quality updates
    this.connectionManager.on("connection-quality-updated", (data) => {
      if (this.capabilityManager) {
        this.capabilityManager.updatePeerPerformance(data.peerId, {
          latency: data.quality.latency,
          success: true,
        });
      }
      this.emit("connection-quality-updated", data);
    });
  }

  // Set up capability management event handlers
  setupCapabilityEventHandlers() {
    if (!this.capabilityManager) return;

    // Handle capability advertisements
    this.capabilityManager.on(
      "advertise-capabilities",
      async (advertisement) => {
        // Send capability advertisement to connected peers
        const connectedPeers = this.connectionManager.getConnectedPeers();
        for (const peerId of connectedPeers) {
          try {
            await this.connectionManager.sendReliable(peerId, advertisement);
          } catch (error) {
            console.error(
              `Failed to advertise capabilities to ${peerId}:`,
              error
            );
          }
        }
      }
    );

    // Handle capability updates
    this.capabilityManager.on("capabilities-updated", (data) => {
      this.emit("capabilities-updated", data);
    });

    // Handle role changes
    this.capabilityManager.on("role-changed", (data) => {
      console.log(`Peer role changed from ${data.oldRole} to ${data.newRole}`);
      this.emit("role-changed", data);
    });

    // Handle service additions/removals
    this.capabilityManager.on("service-added", (data) => {
      this.emit("service-added", data);
    });

    this.capabilityManager.on("service-removed", (data) => {
      this.emit("service-removed", data);
    });

    // Handle remote capability updates
    this.capabilityManager.on("remote-capabilities-updated", (data) => {
      this.emit("remote-capabilities-updated", data);
    });
  }

  async handlePeerJoined(peerId) {
    console.log(`🔔 Peer joined event received: ${peerId}`);
    console.log(`🆔 My peer ID: ${this.signaling.getPeerId()}`);

    if (peerId === this.signaling.getPeerId()) {
      console.log(`⚠️ Ignoring self-connection to ${peerId}`);
      return; // Don't connect to ourselves
    }

    // Track this peer in our room
    this.roomPeers.add(peerId);
    console.log(
      `📊 Room now has ${this.roomPeers.size + 1} peers (including self)`
    );
    console.log(`👥 Room peers: [${Array.from(this.roomPeers).join(", ")}]`);

    // Check if we already have a successful connection
    if (this.connectionManager.hasConnection(peerId)) {
      console.log(`✅ Already connected to ${peerId}`);
      return;
    }

    // Check if we're already in the process of connecting
    if (this.pendingConnections.has(peerId)) {
      console.log(`⏳ Already attempting connection to ${peerId}`);
      return;
    }

    // Try to acquire connection lock to prevent race conditions
    if (!this.acquireConnectionLock(peerId)) {
      console.log(
        `🔒 Connection lock held for ${peerId}, skipping duplicate attempt`
      );
      return;
    }

    // Use a more robust initiator selection strategy
    const myPeerId = this.signaling.getPeerId();
    const shouldInitiate = this.shouldInitiateConnection(myPeerId, peerId);

    console.log(
      `🤔 Should I initiate to ${peerId}? ${shouldInitiate} (my ID: ${myPeerId})`
    );

    if (shouldInitiate) {
      await this.initiateConnectionToPeer(peerId);
    } else {
      console.log(`⏳ Waiting for ${peerId} to initiate connection`);
      // Set a timeout to initiate if the other peer doesn't
      this.setConnectionTimeout(peerId);
      // Release lock since we're not initiating now
      this.releaseConnectionLock(peerId);
    }
  }

  // Connection lock management to prevent race conditions
  acquireConnectionLock(peerId) {
    if (this.connectionLocks.has(peerId)) {
      return false; // Lock already held
    }
    this.connectionLocks.add(peerId);
    console.log(`🔒 Acquired connection lock for ${peerId}`);
    return true;
  }

  releaseConnectionLock(peerId) {
    if (this.connectionLocks.has(peerId)) {
      this.connectionLocks.delete(peerId);
      console.log(`🔓 Released connection lock for ${peerId}`);
    }
  }

  // Simple initiator selection with robust fallback
  shouldInitiateConnection(myPeerId, targetPeerId) {
    // Accept that deterministic selection may create super-initiators
    // The key is to have robust timeout and mesh validation to handle failures

    // Use simple lexicographic comparison for deterministic behavior
    // The timeout mechanism will ensure all connections are eventually established
    return myPeerId < targetPeerId;
  }

  // Improved hash function using DJB2 algorithm
  hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  // Keep the old hash function for backward compatibility
  hashPeerId(peerId) {
    return this.hashString(peerId);
  }

  // Set timeout to initiate connection if other peer doesn't
  setConnectionTimeout(peerId) {
    // Use shorter timeout for non-initiators to ensure mesh completion
    // This compensates for super-initiator scenarios
    const timeoutDelay = 2500; // 2.5 seconds - balance between WebRTC time and responsiveness

    const timeoutId = setTimeout(async () => {
      console.log(
        `⏰ Timeout waiting for ${peerId} to initiate, taking over...`
      );

      // Enhanced check to prevent duplicate connection attempts
      const hasConnection = this.connectionManager.hasConnection(peerId);
      const isPending = this.pendingConnections.has(peerId);
      const existingConnection = this.connectionManager.connections.get(peerId);

      // Check if connection is already established or in progress
      if (hasConnection) {
        console.log(
          `✅ Connection to ${peerId} already established, skipping timeout takeover`
        );
        return;
      }

      if (isPending) {
        console.log(
          `⏳ Connection to ${peerId} already in progress, skipping timeout takeover`
        );
        return;
      }

      // Check if there's an existing connection that's actually working
      if (existingConnection) {
        const isWorking =
          existingConnection.signalingState === "stable" &&
          existingConnection.connectionState === "connected";

        if (isWorking) {
          console.log(
            `✅ Connection to ${peerId} is working, skipping timeout takeover`
          );
          return;
        } else {
          console.log(
            `🔄 Connection to ${peerId} appears stuck (signaling: ${existingConnection.signalingState}, connection: ${existingConnection.connectionState}), taking over anyway`
          );
          // Clean up the stuck connection
          this.connectionManager.cleanup(peerId);
        }
      }

      // Try to acquire lock before taking over
      if (this.acquireConnectionLock(peerId)) {
        console.log(`🚀 Taking over connection initiation to ${peerId}`);
        await this.initiateConnectionToPeer(peerId);
      } else {
        console.log(
          `🔒 Cannot acquire lock for ${peerId} during timeout takeover`
        );
      }
    }, timeoutDelay);

    // Store timeout ID for cleanup
    if (!this.connectionTimeouts) {
      this.connectionTimeouts = new Map();
    }
    this.connectionTimeouts.set(peerId, timeoutId);
  }

  // Initiate connection to a peer
  async initiateConnectionToPeer(peerId) {
    console.log(`🚀 Initiating connection to peer: ${peerId}`);

    // Ensure we have the connection lock
    if (!this.connectionLocks.has(peerId)) {
      if (!this.acquireConnectionLock(peerId)) {
        console.log(
          `🔒 Cannot acquire lock for ${peerId}, aborting initiation`
        );
        return;
      }
    }

    this.pendingConnections.add(peerId);

    // Clear any existing timeout
    if (this.connectionTimeouts && this.connectionTimeouts.has(peerId)) {
      clearTimeout(this.connectionTimeouts.get(peerId));
      this.connectionTimeouts.delete(peerId);
    }

    try {
      // Create connection as initiator
      console.log(`📞 Creating WebRTC connection to ${peerId} as initiator`);
      const pc = await this.connectionManager.createConnection(peerId, true);

      // Create and send offer
      console.log(`📝 Creating offer for ${peerId}`);
      const offer = await pc.createOffer();
      console.log(
        `📤 Setting local description and sending offer to ${peerId}`
      );
      await pc.setLocalDescription(offer);

      this.signaling.sendOffer(offer);
      console.log(`✅ Offer sent to ${peerId}`);
      this.emit("connection-initiated", { peerId });
    } catch (error) {
      console.error(`❌ Failed to initiate connection to ${peerId}:`, error);
      this.pendingConnections.delete(peerId);
      this.releaseConnectionLock(peerId);
      this.emit("connection-error", { peerId, error });
    }
  }

  async handleOffer(peerId, offer) {
    console.log(`📨 Received offer from ${peerId}`);

    // Check if we already have a successful connection
    if (this.connectionManager.hasConnection(peerId)) {
      console.log(`✅ Already connected to ${peerId}, ignoring offer`);
      return;
    }

    // Clear any connection timeout since the other peer is initiating
    if (this.connectionTimeouts && this.connectionTimeouts.has(peerId)) {
      console.log(
        `⏰ Clearing connection timeout for ${peerId} (they initiated)`
      );
      clearTimeout(this.connectionTimeouts.get(peerId));
      this.connectionTimeouts.delete(peerId);
    }

    // Handle simultaneous connection attempts
    if (this.pendingConnections.has(peerId)) {
      console.log(`🔄 Simultaneous connection attempt detected with ${peerId}`);

      // Use the same logic to determine who should back off
      const myPeerId = this.signaling.getPeerId();
      const shouldIBackOff = !this.shouldInitiateConnection(myPeerId, peerId);

      if (shouldIBackOff) {
        console.log(
          `🔙 Backing off my connection attempt to ${peerId}, accepting their offer`
        );
        this.pendingConnections.delete(peerId);
        // Clean up any existing connection attempt
        if (this.connectionManager.connections.has(peerId)) {
          this.connectionManager.cleanup(peerId);
        }
      } else {
        console.log(
          `🚫 Rejecting offer from ${peerId}, continuing with my connection attempt`
        );
        return;
      }
    }

    console.log(`🤝 Processing offer from ${peerId}`);
    this.pendingConnections.add(peerId);

    try {
      // Create connection as responder
      console.log(`📞 Creating WebRTC connection to ${peerId} as responder`);
      const pc = await this.connectionManager.createConnection(peerId, false);

      // Verify we're in the correct state to receive an offer
      if (pc.signalingState !== "stable") {
        console.warn(
          `⚠️ Connection to ${peerId} not in stable state: ${pc.signalingState}, proceeding anyway`
        );
      }

      console.log(
        `📝 Setting remote description (offer) from ${peerId}, current state: ${pc.signalingState}`
      );
      await pc.setRemoteDescription(offer);
      console.log(
        `📝 Creating answer for ${peerId}, new state: ${pc.signalingState}`
      );
      const answer = await pc.createAnswer();
      console.log(
        `📤 Setting local description and sending answer to ${peerId}`
      );
      await pc.setLocalDescription(answer);

      this.signaling.sendAnswer(answer);
      console.log(
        `✅ Answer sent to ${peerId}, final state: ${pc.signalingState}`
      );
      this.emit("connection-responding", { peerId });
    } catch (error) {
      console.error(`❌ Failed to handle offer from ${peerId}:`, error);
      this.pendingConnections.delete(peerId);
      this.emit("connection-error", { peerId, error });
    }
  }

  async handleAnswer(peerId, answer) {
    const pc = this.connectionManager.connections.get(peerId);
    if (!pc) {
      console.warn(`No connection found for answer from ${peerId}`);
      return;
    }

    // Enhanced state checking with better error handling
    console.log(
      `📨 Received answer from ${peerId}, connection state: ${pc.signalingState}`
    );

    // Check if we're in the correct state to receive an answer
    if (pc.signalingState !== "have-local-offer") {
      console.warn(
        `⚠️ Ignoring answer from ${peerId} - wrong signaling state: ${pc.signalingState} (expected: have-local-offer)`
      );

      // If we're in stable state, the connection might already be established
      if (pc.signalingState === "stable") {
        console.log(
          `✅ Connection to ${peerId} already established (stable state)`
        );
        this.pendingConnections.delete(peerId);

        // Clear any timeout since connection is established
        if (this.connectionTimeouts && this.connectionTimeouts.has(peerId)) {
          clearTimeout(this.connectionTimeouts.get(peerId));
          this.connectionTimeouts.delete(peerId);
        }
      }
      return;
    }

    try {
      console.log(
        `📝 Setting remote description (answer) from ${peerId}, current state: ${pc.signalingState}`
      );
      await pc.setRemoteDescription(answer);
      console.log(
        `✅ Answer processed from ${peerId}, new state: ${pc.signalingState}`
      );

      // Clear timeout and pending state on successful answer
      this.pendingConnections.delete(peerId);
      this.releaseConnectionLock(peerId);
      if (this.connectionTimeouts && this.connectionTimeouts.has(peerId)) {
        clearTimeout(this.connectionTimeouts.get(peerId));
        this.connectionTimeouts.delete(peerId);
      }
    } catch (error) {
      console.error(`❌ Failed to handle answer from ${peerId}:`, error);
      console.error(
        `Connection state: ${pc.signalingState}, Connection state: ${pc.connectionState}`
      );

      // Clean up failed connection attempt
      this.pendingConnections.delete(peerId);
      this.releaseConnectionLock(peerId);
      if (this.connectionTimeouts && this.connectionTimeouts.has(peerId)) {
        clearTimeout(this.connectionTimeouts.get(peerId));
        this.connectionTimeouts.delete(peerId);
      }

      this.emit("connection-error", { peerId, error });
    }
  }

  async handleIceCandidate(peerId, candidate) {
    const pc = this.connectionManager.connections.get(peerId);
    if (!pc) {
      console.warn(`No connection found for ICE candidate from ${peerId}`);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error(`Failed to add ICE candidate from ${peerId}:`, error);
    }
  }

  handlePeerLeft(peerId) {
    console.log(`👋 Peer left: ${peerId}`);

    // Remove from room tracking
    this.roomPeers.delete(peerId);
    console.log(
      `📊 Room now has ${this.roomPeers.size + 1} peers (including self)`
    );

    // Clean up connections and timeouts
    this.connectionManager.cleanup(peerId);
    this.pendingConnections.delete(peerId);

    // Clear any connection timeout and locks
    if (this.connectionTimeouts && this.connectionTimeouts.has(peerId)) {
      clearTimeout(this.connectionTimeouts.get(peerId));
      this.connectionTimeouts.delete(peerId);
    }
    this.releaseConnectionLock(peerId);

    this.emit("peer-left", { peerId });
  }

  // Simple API for applications
  async connect() {
    try {
      const peerId = await this.signaling.connect();

      // Initialize capability manager with peer ID
      this.capabilityManager = new PeerCapabilityManager(peerId, {
        role: "BASIC", // Start with basic role
        services: ["messaging"], // Start with basic messaging
        maxConnections: 10,
        maxBandwidth: "10mbps",
      });

      // Set up capability management event handlers
      this.setupCapabilityEventHandlers();

      this.emit("connected", { peerId });
      return peerId;
    } catch (error) {
      this.emit("connection-failed", { error });
      throw error;
    }
  }

  async joinRoom(roomId) {
    if (!this.signaling.isConnected()) {
      throw new Error("Not connected to signaling server");
    }

    this.currentRoom = roomId;
    this.roomPeers.clear(); // Reset room peer tracking
    await this.signaling.joinRoom(roomId);

    // Start aggressive mesh validation for multi-peer scenarios
    this.startMeshValidation();

    this.emit("room-joined", { roomId });
    return this.signaling.peerId;
  }

  async sendMessage(message) {
    console.log("🔄 Attempting to send message:", message);
    const peers = this.connectionManager.getConnectedPeers();
    console.log("👥 Connected peers:", peers);

    if (peers.length === 0) {
      console.warn("⚠️ No connected peers to send message to");
      return [];
    }

    const results = [];

    for (const peerId of peers) {
      try {
        console.log(`📤 Sending message to peer ${peerId}`);
        const messageData = {
          type: "message",
          content: message,
          timestamp: Date.now(),
          from: this.signaling.getPeerId(),
        };
        console.log("📦 Message data:", messageData);

        const messageId = await this.connectionManager.sendReliable(
          peerId,
          messageData
        );
        console.log(
          `✅ Message sent successfully to ${peerId}, ID: ${messageId}`
        );
        results.push({ peerId, messageId, success: true });
      } catch (error) {
        console.error(`❌ Failed to send message to ${peerId}:`, error);
        results.push({ peerId, error, success: false });
      }
    }

    console.log("📊 Send results:", results);
    return results;
  }

  // File sharing capability
  async shareFile(file) {
    console.log("📁 Starting file share:", file.name, file.size, "bytes");
    const peers = this.connectionManager.getConnectedPeers();

    if (peers.length === 0) {
      console.warn("⚠️ No connected peers to share file with");
      return [];
    }

    const results = [];
    for (const peerId of peers) {
      try {
        await this.sendFileToUser(peerId, file);
        results.push({ peerId, success: true });
      } catch (error) {
        console.error(`❌ Failed to send file to ${peerId}:`, error);
        results.push({ peerId, error, success: false });
      }
    }

    return results;
  }

  async sendFileToUser(peerId, file) {
    const connection = this.connectionManager.connections.get(peerId);
    const channel = this.connectionManager.dataChannels.get(peerId);

    if (!connection || !channel || channel.readyState !== "open") {
      throw new Error(`No connection to peer ${peerId}`);
    }

    console.log(`📤 Sending file ${file.name} to ${peerId}`);

    // Generate unique file ID for this transfer
    const fileId = `file_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    // Send file metadata
    await this.connectionManager.sendReliable(peerId, {
      type: "file-offer",
      fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      timestamp: Date.now(),
      from: this.signaling.getPeerId(),
    });

    // Send file in chunks
    const chunkSize = 16384; // 16KB chunks (safe for WebRTC)
    const totalChunks = Math.ceil(file.size / chunkSize);

    console.log(`📦 Sending ${totalChunks} chunks of ${chunkSize} bytes each`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const arrayBuffer = await chunk.arrayBuffer();

      // Send chunk with metadata
      const chunkData = {
        type: "file-chunk",
        fileId,
        chunkIndex: i,
        totalChunks,
        data: Array.from(new Uint8Array(arrayBuffer)), // Convert to array for JSON
      };

      await this.connectionManager.sendReliable(peerId, chunkData);

      // Emit progress event
      const progress = (i + 1) / totalChunks;
      this.emit("file-progress", {
        peerId,
        fileId,
        filename: file.name,
        progress,
        sent: i + 1,
        total: totalChunks,
      });

      console.log(
        `📊 File progress: ${Math.round(progress * 100)}% (${
          i + 1
        }/${totalChunks})`
      );
    }

    // Send completion signal
    await this.connectionManager.sendReliable(peerId, {
      type: "file-complete",
      fileId,
      name: file.name,
      timestamp: Date.now(),
    });

    console.log(`✅ File ${file.name} sent successfully to ${peerId}`);
  }

  // File receiving handlers
  handleFileOffer(peerId, messageData) {
    console.log(
      `📥 Received file offer from ${peerId}:`,
      messageData.name,
      messageData.size,
      "bytes"
    );

    const fileTransfer = {
      fileId: messageData.fileId,
      peerId,
      name: messageData.name,
      size: messageData.size,
      type: messageData.type,
      chunks: new Map(), // chunkIndex -> data
      receivedChunks: 0,
      totalChunks: 0,
      startTime: Date.now(),
    };

    this.incomingFiles.set(messageData.fileId, fileTransfer);

    // Emit file offer event for UI to handle
    this.emit("file-offer", {
      peerId,
      fileId: messageData.fileId,
      filename: messageData.name,
      size: messageData.size,
      type: messageData.type,
    });
  }

  handleFileChunk(peerId, messageData) {
    const fileTransfer = this.incomingFiles.get(messageData.fileId);
    if (!fileTransfer) {
      console.warn(`⚠️ Received chunk for unknown file: ${messageData.fileId}`);
      return;
    }

    // Store chunk data
    fileTransfer.chunks.set(messageData.chunkIndex, messageData.data);
    fileTransfer.receivedChunks++;
    fileTransfer.totalChunks = messageData.totalChunks;

    const progress = fileTransfer.receivedChunks / fileTransfer.totalChunks;

    console.log(
      `📦 Received chunk ${messageData.chunkIndex + 1}/${
        messageData.totalChunks
      } for ${fileTransfer.name} (${Math.round(progress * 100)}%)`
    );

    // Emit progress event
    this.emit("file-receive-progress", {
      peerId,
      fileId: messageData.fileId,
      filename: fileTransfer.name,
      progress,
      received: fileTransfer.receivedChunks,
      total: fileTransfer.totalChunks,
    });
  }

  handleFileComplete(peerId, messageData) {
    const fileTransfer = this.incomingFiles.get(messageData.fileId);
    if (!fileTransfer) {
      console.warn(
        `⚠️ Received completion for unknown file: ${messageData.fileId}`
      );
      return;
    }

    console.log(`✅ File transfer complete: ${fileTransfer.name}`);

    // Reconstruct file from chunks
    const chunks = [];
    for (let i = 0; i < fileTransfer.totalChunks; i++) {
      const chunkData = fileTransfer.chunks.get(i);
      if (!chunkData) {
        console.error(`❌ Missing chunk ${i} for file ${fileTransfer.name}`);
        this.emit("file-error", {
          peerId,
          fileId: messageData.fileId,
          filename: fileTransfer.name,
          error: `Missing chunk ${i}`,
        });
        return;
      }
      chunks.push(new Uint8Array(chunkData));
    }

    // Create blob from chunks
    const blob = new Blob(chunks, { type: fileTransfer.type });

    // Clean up transfer state
    this.incomingFiles.delete(messageData.fileId);

    // Emit file received event
    this.emit("file-received", {
      peerId,
      fileId: messageData.fileId,
      filename: fileTransfer.name,
      size: fileTransfer.size,
      type: fileTransfer.type,
      blob,
      downloadUrl: URL.createObjectURL(blob),
    });
  }

  // Event system
  emit(eventType, data) {
    this.eventBus.dispatchEvent(new CustomEvent(eventType, { detail: data }));
  }

  on(eventType, handler) {
    this.eventBus.addEventListener(eventType, (event) => handler(event.detail));
  }

  off(eventType, handler) {
    this.eventBus.removeEventListener(eventType, handler);
  }

  // Utility methods
  getConnectedPeers() {
    return this.connectionManager.getConnectedPeers();
  }

  getCurrentRoom() {
    return this.currentRoom;
  }

  getPeerId() {
    return this.signaling.getPeerId();
  }

  isConnected() {
    return this.signaling.isConnected();
  }

  // === CAPABILITY MANAGEMENT API ===

  // Get local peer capabilities
  getLocalCapabilities() {
    return this.capabilityManager
      ? this.capabilityManager.getLocalCapabilities()
      : null;
  }

  // Get all remote peer capabilities
  getAllRemotePeerCapabilities() {
    return this.capabilityManager
      ? this.capabilityManager.getAllRemotePeerCapabilities()
      : new Map();
  }

  // Get capabilities for a specific peer
  getPeerCapabilities(peerId) {
    if (!this.capabilityManager) return null;
    const allCapabilities =
      this.capabilityManager.getAllRemotePeerCapabilities();
    return allCapabilities.get(peerId);
  }

  // Find peers that provide a specific service
  findServiceProviders(serviceType, options = {}) {
    return this.capabilityManager
      ? this.capabilityManager.findServiceProviders(serviceType, options)
      : [];
  }

  // Add a service to local capabilities
  addService(serviceType) {
    if (this.capabilityManager) {
      this.capabilityManager.addService(serviceType);
    }
  }

  // Remove a service from local capabilities
  removeService(serviceType) {
    if (this.capabilityManager) {
      this.capabilityManager.removeService(serviceType);
    }
  }

  // Check if local peer provides a service
  providesService(serviceType) {
    return this.capabilityManager
      ? this.capabilityManager.providesService(serviceType)
      : false;
  }

  // Update local capabilities
  updateCapabilities(updates) {
    if (this.capabilityManager) {
      this.capabilityManager.updateLocalCapabilities(updates);
    }
  }

  // Get connection quality for a peer
  getConnectionQuality(peerId) {
    return this.connectionManager.getConnectionQuality(peerId);
  }

  // Get performance metrics for a peer
  getPerformanceMetrics(peerId) {
    return this.connectionManager.getPerformanceMetrics(peerId);
  }

  // Get all connection qualities
  getAllConnectionQualities() {
    return this.connectionManager.getAllConnectionQualities();
  }

  disconnect() {
    // Clean up capability manager
    if (this.capabilityManager) {
      this.capabilityManager.stop();
      this.capabilityManager = null;
    }

    // Clean up connection timeouts and locks
    if (this.connectionTimeouts) {
      for (const timeoutId of this.connectionTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.connectionTimeouts.clear();
    }
    this.connectionLocks.clear();

    // Clean up all connections
    for (const peerId of this.connectionManager.connections.keys()) {
      this.connectionManager.cleanup(peerId);
    }

    // Stop mesh validation
    this.stopMeshValidation();

    this.signaling.disconnect();
    this.currentRoom = null;
    this.roomPeers.clear();
    this.pendingConnections.clear();
    this.emit("disconnected");
  }

  // Mesh connectivity validation and repair
  validateMeshConnectivity() {
    if (!this.currentRoom) {
      return; // Not in a room
    }

    console.log(`🔍 Validating mesh connectivity...`);

    // Get connection state (without heavy logging)
    const stats = this.getConnectionStats();

    // Always log basic stats for debugging
    console.log(
      `📊 Room: ${stats.roomSize} peers, Connected: ${stats.actualConnections}/${stats.expectedConnections}, Pending: ${stats.pendingConnections}, Missing: ${stats.missingConnections.length}`
    );

    // Log detailed connection states for debugging
    if (stats.missingConnections.length > 0) {
      console.log(
        `❌ Missing connections to: [${stats.missingConnections.join(", ")}]`
      );
    }
    if (stats.pendingConnections > 0) {
      console.log(
        `⏳ Pending connections to: [${stats.pendingPeers.join(", ")}]`
      );
    }
    if (stats.connectedPeers.length > 0) {
      console.log(`✅ Connected to: [${stats.connectedPeers.join(", ")}]`);
    }

    // Find missing connections
    if (stats.missingConnections.length > 0) {
      console.log(
        `🔧 Found ${stats.missingConnections.length} missing connections:`,
        stats.missingConnections
      );

      // Be more aggressive about repairing connections
      // Allow repair even with some pending connections if we have stuck connections
      const hasStuckConnections = stats.missingConnections.some((peerId) => {
        const existingConnection =
          this.connectionManager.connections.get(peerId);
        return (
          existingConnection &&
          existingConnection.connectionState === "connecting"
        );
      });

      if (stats.pendingConnections === 0 || hasStuckConnections) {
        if (hasStuckConnections) {
          console.log(
            `🔄 Attempting to repair stuck connections (aggressive mode)`
          );
        } else {
          console.log(
            `🔄 Attempting to repair missing connections (no pending conflicts)`
          );
        }

        // Attempt to repair missing connections one at a time
        for (const peerId of stats.missingConnections) {
          // Check connection state more intelligently
          const existingConnection =
            this.connectionManager.connections.get(peerId);
          const shouldRepair = this.shouldRepairConnection(
            peerId,
            existingConnection
          );

          if (shouldRepair.repair) {
            console.log(
              `🔄 Repairing connection to ${peerId} (${shouldRepair.reason})`
            );

            // Clean up any stale connection first
            if (existingConnection && shouldRepair.cleanup) {
              console.log(`🧹 Cleaning up stale connection to ${peerId}`);
              this.connectionManager.cleanup(peerId);
            }

            this.handlePeerJoined(peerId);
          } else {
            console.log(
              `⏳ Skipping repair for ${peerId} - ${shouldRepair.reason}`
            );
          }
        }
      } else {
        console.log(
          `⏳ Delaying mesh repair - ${stats.pendingConnections} connections still pending`
        );
      }
    } else if (stats.pendingConnections === 0) {
      console.log(`✅ Mesh connectivity is complete`);
    } else {
      console.log(
        `⏳ Waiting for ${stats.pendingConnections} pending connections to complete`
      );
    }
  }

  // Get all peers we should be connected to
  getAllExpectedPeers() {
    return Array.from(this.roomPeers);
  }

  // Start periodic mesh validation
  startMeshValidation() {
    if (this.meshValidationInterval) {
      clearInterval(this.meshValidationInterval);
    }

    this.meshValidationInterval = setInterval(() => {
      this.validateMeshConnectivity();
    }, 5000); // Check every 5 seconds - more aggressive repair for stuck connections
  }

  // Stop mesh validation
  stopMeshValidation() {
    if (this.meshValidationInterval) {
      clearInterval(this.meshValidationInterval);
      this.meshValidationInterval = null;
    }
  }

  // Get connection statistics for debugging
  getConnectionStats() {
    const expectedPeers = this.getAllExpectedPeers();
    const connectedPeers = this.connectionManager.getConnectedPeers();
    const pendingPeers = Array.from(this.pendingConnections);

    return {
      roomSize: this.roomPeers.size + 1, // +1 for self
      expectedConnections: expectedPeers.length,
      actualConnections: connectedPeers.length,
      pendingConnections: pendingPeers.length,
      expectedPeers,
      connectedPeers,
      pendingPeers,
      missingConnections: expectedPeers.filter(
        (peerId) =>
          !connectedPeers.includes(peerId) && !pendingPeers.includes(peerId)
      ),
    };
  }

  // Intelligent connection repair decision
  shouldRepairConnection(peerId, existingConnection) {
    // No existing connection - definitely repair
    if (!existingConnection) {
      return { repair: true, reason: "no existing connection", cleanup: false };
    }

    const signalingState = existingConnection.signalingState;
    const connectionState = existingConnection.connectionState;

    console.log(
      `🔍 Checking connection to ${peerId}: signaling=${signalingState}, connection=${connectionState}`
    );

    // Only consider truly connected state as working
    // "connecting" state can be stuck and should be repaired
    if (signalingState === "stable" && connectionState === "connected") {
      return { repair: false, reason: "connection working" };
    }

    // Connection failed - repair with cleanup
    if (connectionState === "failed" || connectionState === "closed") {
      return {
        repair: true,
        reason: "connection failed/closed",
        cleanup: true,
      };
    }

    // Connection stuck in connecting state - this is the main issue!
    if (connectionState === "connecting") {
      return {
        repair: true,
        reason: "stuck in connecting state",
        cleanup: true,
      };
    }

    // Connection in new state - also needs repair
    if (connectionState === "new") {
      return {
        repair: true,
        reason: "connection in new state",
        cleanup: true,
      };
    }

    // Signaling stuck in non-stable state - repair with cleanup
    if (signalingState !== "stable") {
      return { repair: true, reason: "signaling stuck", cleanup: true };
    }

    // Default: don't repair
    return { repair: false, reason: "connection state unclear" };
  }

  // Debug method to log current connection state
  logConnectionState() {
    const stats = this.getConnectionStats();
    console.log(`\n🔍 === CONNECTION STATE DEBUG ===`);
    console.log(`📊 Room size: ${stats.roomSize} peers`);
    console.log(`🎯 Expected connections: ${stats.expectedConnections}`);
    console.log(`✅ Actual connections: ${stats.actualConnections}`);
    console.log(`⏳ Pending connections: ${stats.pendingConnections}`);
    console.log(`👥 Expected peers: [${stats.expectedPeers.join(", ")}]`);
    console.log(`🔗 Connected peers: [${stats.connectedPeers.join(", ")}]`);
    console.log(`⏳ Pending peers: [${stats.pendingPeers.join(", ")}]`);
    console.log(
      `❌ Missing connections: [${stats.missingConnections.join(", ")}]`
    );

    if (
      stats.missingConnections.length === 0 &&
      stats.pendingConnections === 0
    ) {
      console.log(`🎉 FULL MESH ACHIEVED!`);
    } else {
      console.log(
        `⚠️ Mesh incomplete - ${stats.missingConnections.length} missing, ${stats.pendingConnections} pending`
      );
    }
    console.log(`=== END CONNECTION STATE ===\n`);

    return stats;
  }
}
