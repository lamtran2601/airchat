// Enhanced P2P Connection Manager
export class P2PConnectionManager {
  constructor(config = {}) {
    this.config = {
      // Free STUN servers
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun.services.mozilla.com:3478" },
      ],
      // Optimize for small apps
      iceCandidatePoolSize: 3,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      ...config,
    };

    this.connections = new Map(); // peerId -> connection
    this.dataChannels = new Map(); // peerId -> channel
    this.eventEmitter = new EventTarget();
    this.reconnectAttempts = new Map(); // peerId -> attempts
    this.maxReconnectAttempts = 3;
  }

  // Create reliable P2P connection
  async createConnection(peerId, isInitiator = false) {
    console.log(`Creating connection to ${peerId}, initiator: ${isInitiator}`);

    try {
      const pc = new RTCPeerConnection(this.config);
      this.setupConnectionEventHandlers(pc, peerId);

      if (isInitiator) {
        // Create data channel for initiator
        const dataChannel = pc.createDataChannel("main", {
          ordered: true,
          maxRetransmits: 3,
        });
        this.setupDataChannelHandlers(dataChannel, peerId);
        this.dataChannels.set(peerId, dataChannel);
      } else {
        // Wait for data channel from remote
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          this.setupDataChannelHandlers(dataChannel, peerId);
          this.dataChannels.set(peerId, dataChannel);
        };
      }

      this.connections.set(peerId, pc);
      this.emit("connection-created", { peerId, isInitiator });

      return pc;
    } catch (error) {
      console.error("Failed to create connection:", error);
      this.emit("connection-error", { peerId, error });
      throw error;
    }
  }

  // Enhanced connection reliability
  setupConnectionEventHandlers(pc, peerId) {
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Connection to ${peerId}: ${state}`);

      this.emit("connection-state-change", { peerId, state });

      switch (state) {
        case "connected":
          this.reconnectAttempts.delete(peerId);
          this.emit("peer-connected", { peerId });
          break;

        case "disconnected":
          this.emit("peer-disconnected", { peerId });
          this.scheduleReconnect(peerId);
          break;

        case "failed":
          this.emit("peer-failed", { peerId });
          this.handleConnectionFailure(peerId);
          break;

        case "closed":
          this.cleanup(peerId);
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection to ${peerId}: ${pc.iceConnectionState}`);
    };

    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering for ${peerId}: ${pc.iceGatheringState}`);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`ICE candidate for ${peerId}:`, event.candidate);
        this.emit("ice-candidate", { peerId, candidate: event.candidate });
      }
    };
  }

  setupDataChannelHandlers(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log(`🟢 Data channel opened with ${peerId}`);
      console.log(`📊 Data channel state: ${dataChannel.readyState}`);
      this.emit("data-channel-open", { peerId });
    };

    dataChannel.onclose = () => {
      console.log(`🔴 Data channel closed with ${peerId}`);
      this.emit("data-channel-close", { peerId });
    };

    dataChannel.onmessage = (event) => {
      console.log(`📨 Received message from ${peerId}:`, event.data);
      try {
        const message = JSON.parse(event.data);
        console.log(`📦 Parsed message from ${peerId}:`, message);
        this.emit("message-received", { peerId, message });
      } catch (error) {
        console.error(`❌ Failed to parse message from ${peerId}:`, error);
        console.error("Raw message data:", event.data);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`❌ Data channel error with ${peerId}:`, error);
      this.emit("data-channel-error", { peerId, error });
    };
  }

  // Automatic reconnection logic
  async scheduleReconnect(peerId) {
    const attempts = this.reconnectAttempts.get(peerId) || 0;

    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(peerId, attempts + 1);

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempts) * 1000;

      console.log(
        `Scheduling reconnect to ${peerId} in ${delay}ms (attempt ${
          attempts + 1
        })`
      );

      setTimeout(async () => {
        try {
          await this.reconnect(peerId);
        } catch (error) {
          console.error(`Reconnect failed:`, error);
        }
      }, delay);
    } else {
      console.log(`Max reconnect attempts reached for ${peerId}`);
      this.emit("peer-unreachable", { peerId });
    }
  }

  async reconnect(peerId) {
    console.log(`Attempting to reconnect to ${peerId}`);
    this.cleanup(peerId);
    this.emit("reconnect-attempt", { peerId });
  }

  handleConnectionFailure(peerId) {
    console.log(`Connection failed with ${peerId}`);
    this.scheduleReconnect(peerId);
  }

  // Send data with reliability
  async sendReliable(peerId, data, options = {}) {
    console.log(`🔍 Checking data channel for peer ${peerId}`);
    const channel = this.dataChannels.get(peerId);

    if (!channel) {
      console.error(`❌ No data channel found for peer ${peerId}`);
      throw new Error(`No data channel to ${peerId}`);
    }

    console.log(`📡 Data channel state for ${peerId}: ${channel.readyState}`);

    if (channel.readyState !== "open") {
      console.error(
        `❌ Data channel not open for peer ${peerId}, state: ${channel.readyState}`
      );
      throw new Error(
        `Data channel not open to ${peerId}, state: ${channel.readyState}`
      );
    }

    const message = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data: data,
      ...options,
    };

    console.log(`📤 Sending message to ${peerId}:`, message);

    try {
      const messageStr = JSON.stringify(message);
      console.log(
        `📦 Serialized message (${messageStr.length} chars):`,
        messageStr
      );
      channel.send(messageStr);
      console.log(`✅ Message sent successfully to ${peerId}`);
      this.emit("message-sent", { peerId, message });
      return message.id;
    } catch (error) {
      console.error(`❌ Failed to send message to ${peerId}:`, error);
      this.emit("message-failed", { peerId, message, error });
      throw error;
    }
  }

  cleanup(peerId) {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }

    this.reconnectAttempts.delete(peerId);
    this.emit("peer-cleanup", { peerId });
  }

  // Helper methods
  emit(eventType, data) {
    this.eventEmitter.dispatchEvent(
      new CustomEvent(eventType, { detail: data })
    );
  }

  on(eventType, handler) {
    this.eventEmitter.addEventListener(eventType, (event) =>
      handler(event.detail)
    );
  }

  generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Get connection status
  getConnectionStatus(peerId) {
    const connection = this.connections.get(peerId);
    const dataChannel = this.dataChannels.get(peerId);

    return {
      connectionState: connection?.connectionState || "disconnected",
      iceConnectionState: connection?.iceConnectionState || "disconnected",
      dataChannelState: dataChannel?.readyState || "closed",
    };
  }

  // Get all connected peers
  getConnectedPeers() {
    const connectedPeers = [];
    for (const [peerId, connection] of this.connections) {
      if (connection.connectionState === "connected") {
        connectedPeers.push(peerId);
      }
    }
    return connectedPeers;
  }
}
