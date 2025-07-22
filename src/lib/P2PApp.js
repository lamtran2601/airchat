import { MinimalSignaling } from "./MinimalSignaling.js";
import { P2PConnectionManager } from "./P2PConnectionManager.js";

// Complete P2P Application Foundation
export class P2PApp {
  constructor(config = {}) {
    this.signaling = new MinimalSignaling(
      config.signalingServer || "http://localhost:4000"
    );
    this.connectionManager = new P2PConnectionManager(config.webrtc);
    this.eventBus = new EventTarget();

    this.currentRoom = null;
    this.isInitiator = false;
    this.pendingConnections = new Set();

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
  }

  async handlePeerJoined(peerId) {
    console.log(`🔔 Peer joined event received: ${peerId}`);
    console.log(`🆔 My peer ID: ${this.signaling.getPeerId()}`);

    if (peerId === this.signaling.getPeerId()) {
      console.log(`⚠️ Ignoring self-connection to ${peerId}`);
      return; // Don't connect to ourselves
    }

    if (
      this.pendingConnections.has(peerId) ||
      this.connectionManager.connections.has(peerId)
    ) {
      console.log(`⚠️ Already connecting/connected to ${peerId}`);
      return; // Already connecting or connected
    }

    // Deterministic initiator selection: peer with lexicographically smaller ID initiates
    const myPeerId = this.signaling.getPeerId();
    const shouldInitiate = myPeerId < peerId;

    console.log(
      `🤔 Should I initiate to ${peerId}? ${shouldInitiate} (my ID: ${myPeerId})`
    );

    if (!shouldInitiate) {
      console.log(`⏳ Waiting for ${peerId} to initiate connection`);
      return; // Wait for the other peer to initiate
    }

    console.log(`🚀 Initiating connection to new peer: ${peerId}`);
    this.pendingConnections.add(peerId);

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
      this.emit("connection-error", { peerId, error });
    }
  }

  async handleOffer(peerId, offer) {
    console.log(`📨 Received offer from ${peerId}`);

    if (this.connectionManager.connections.has(peerId)) {
      console.log(`⚠️ Already connected to ${peerId}, ignoring offer`);
      return; // Already connected
    }

    console.log(`🤝 Processing offer from ${peerId}`);
    this.pendingConnections.add(peerId);

    try {
      // Create connection as responder
      console.log(`📞 Creating WebRTC connection to ${peerId} as responder`);
      const pc = await this.connectionManager.createConnection(peerId, false);

      console.log(`📝 Setting remote description from ${peerId}`);
      await pc.setRemoteDescription(offer);
      console.log(`📝 Creating answer for ${peerId}`);
      const answer = await pc.createAnswer();
      console.log(
        `📤 Setting local description and sending answer to ${peerId}`
      );
      await pc.setLocalDescription(answer);

      this.signaling.sendAnswer(answer);
      console.log(`✅ Answer sent to ${peerId}`);
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

    try {
      await pc.setRemoteDescription(answer);
      console.log(`Answer processed from ${peerId}`);
    } catch (error) {
      console.error(`Failed to handle answer from ${peerId}:`, error);
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
    console.log(`Peer left: ${peerId}`);
    this.connectionManager.cleanup(peerId);
    this.pendingConnections.delete(peerId);
    this.emit("peer-left", { peerId });
  }

  // Simple API for applications
  async connect() {
    try {
      const peerId = await this.signaling.connect();
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
    await this.signaling.joinRoom(roomId);
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

  disconnect() {
    // Clean up all connections
    for (const peerId of this.connectionManager.connections.keys()) {
      this.connectionManager.cleanup(peerId);
    }

    this.signaling.disconnect();
    this.currentRoom = null;
    this.pendingConnections.clear();
    this.emit("disconnected");
  }
}
