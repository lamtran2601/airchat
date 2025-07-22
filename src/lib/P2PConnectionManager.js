// Enhanced P2P Connection Manager with Service-Aware Connections
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
    this.eventHandlers = new Map(); // eventType -> Map(originalHandler -> wrappedHandler)
    this.reconnectAttempts = new Map(); // peerId -> attempts
    this.maxReconnectAttempts = 3;

    // Service-aware connection management
    this.serviceConnections = new Map(); // serviceType -> Map(peerId -> connection)
    this.connectionServices = new Map(); // peerId -> Set(serviceTypes)

    // Connection quality monitoring
    this.connectionQuality = new Map(); // peerId -> qualityMetrics
    this.qualityMonitoringInterval = 10000; // 10 seconds
    this.qualityTimers = new Map(); // peerId -> timer

    // Performance tracking
    this.performanceMetrics = new Map(); // peerId -> metrics
    this.latencyHistory = new Map(); // peerId -> latency measurements

    // Connection pools for different service types
    this.connectionPools = new Map(); // serviceType -> ConnectionPool
  }

  // Create reliable P2P connection
  async createConnection(peerId, isInitiator = false) {
    console.log(`Creating connection to ${peerId}, initiator: ${isInitiator}`);

    // Check if connection already exists
    const existingConnection = this.connections.get(peerId);
    if (existingConnection) {
      console.log(
        `Connection to ${peerId} already exists, state: ${existingConnection.connectionState}`
      );

      // If existing connection is failed or closed, clean it up and create new one
      if (
        existingConnection.connectionState === "failed" ||
        existingConnection.connectionState === "closed"
      ) {
        console.log(`Cleaning up failed/closed connection to ${peerId}`);
        this.cleanup(peerId);
      } else {
        console.log(`Reusing existing connection to ${peerId}`);
        return existingConnection;
      }
    }

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
          this.startPeerQualityMonitoring(peerId);
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

    pc.onsignalingstatechange = () => {
      console.log(`Signaling state to ${peerId}: ${pc.signalingState}`);
      this.emit("signaling-state-change", { peerId, state: pc.signalingState });
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
    console.log(`🔧 Setting up data channel handlers for ${peerId}`);

    dataChannel.onopen = () => {
      console.log(`🟢 Data channel opened with ${peerId}`);
      console.log(`📊 Data channel state: ${dataChannel.readyState}`);
      console.log(`📊 Data channel label: ${dataChannel.label}`);
      console.log(`📊 Data channel protocol: ${dataChannel.protocol}`);
      this.emit("data-channel-open", { peerId });
    };

    dataChannel.onclose = () => {
      console.log(`🔴 Data channel closed with ${peerId}`);
      console.log(`📊 Data channel state: ${dataChannel.readyState}`);
      this.emit("data-channel-close", { peerId });
    };

    dataChannel.onmessage = (event) => {
      console.log(
        `📨 Received raw message from ${peerId}, length: ${event.data.length}`
      );
      try {
        const message = JSON.parse(event.data);
        console.log(`📦 Parsed message from ${peerId}:`, message);
        this.emit("message-received", { peerId, message });
      } catch (error) {
        console.error(`❌ Failed to parse message from ${peerId}:`, error);
        console.error("Raw message data:", event.data);
        console.error("Data type:", typeof event.data);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`❌ Data channel error with ${peerId}:`, error);
      console.error(
        `📊 Data channel state during error: ${dataChannel.readyState}`
      );
      this.emit("data-channel-error", { peerId, error });
    };

    // Log initial state
    console.log(
      `📊 Initial data channel state for ${peerId}: ${dataChannel.readyState}`
    );
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

  // Send message (wrapper for sendReliable for test compatibility)
  async sendMessage(peerId, data, options = {}) {
    return this.sendReliable(peerId, data, options);
  }

  // Send data with reliability
  async sendReliable(peerId, data, options = {}) {
    console.log(`🔍 Checking data channel for peer ${peerId}`);

    // Get both connection and data channel
    const connection = this.connections.get(peerId);
    const channel = this.dataChannels.get(peerId);

    // Validate connection exists
    if (!connection) {
      console.error(`❌ No WebRTC connection found for peer ${peerId}`);
      throw new Error(`No connection to ${peerId}`);
    }

    // Validate data channel exists
    if (!channel) {
      console.error(`❌ No data channel found for peer ${peerId}`);
      console.error(
        `📊 Available data channels: [${Array.from(
          this.dataChannels.keys()
        ).join(", ")}]`
      );
      throw new Error(`No data channel to ${peerId}`);
    }

    // Log detailed state information
    console.log(
      `📊 Connection state for ${peerId}: ${connection.connectionState}`
    );
    console.log(
      `📊 ICE connection state for ${peerId}: ${connection.iceConnectionState}`
    );
    console.log(
      `📊 Signaling state for ${peerId}: ${connection.signalingState}`
    );
    console.log(`📡 Data channel state for ${peerId}: ${channel.readyState}`);
    console.log(`📡 Data channel label for ${peerId}: ${channel.label}`);

    // Validate data channel is open
    if (channel.readyState !== "open") {
      console.error(
        `❌ Data channel not open for peer ${peerId}, state: ${channel.readyState}`
      );

      // Try to wait a bit for data channel to open
      if (channel.readyState === "connecting") {
        console.log(`⏳ Data channel connecting, waiting 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (channel.readyState === "open") {
          console.log(`✅ Data channel opened after waiting`);
        } else {
          throw new Error(
            `Data channel still not open to ${peerId}, state: ${channel.readyState}`
          );
        }
      } else {
        throw new Error(
          `Data channel not open to ${peerId}, state: ${channel.readyState}`
        );
      }
    }

    const message = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data: data,
      ...options,
    };

    console.log(`📤 Sending message to ${peerId}:`);

    try {
      const messageStr = JSON.stringify(message);
      console.log(`📦 Serialized message (${messageStr.length} chars):`);
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
    if (peerId) {
      // Clean up specific peer
      this.cleanupPeer(peerId);
    } else {
      // Clean up all connections
      const allPeerIds = Array.from(this.connections.keys());
      for (const id of allPeerIds) {
        this.cleanupPeer(id);
      }
    }
  }

  cleanupPeer(peerId) {
    // Stop quality monitoring
    this.stopPeerQualityMonitoring(peerId);

    // Clean up service connections
    const connectionServices = this.connectionServices.get(peerId);
    if (connectionServices) {
      for (const serviceType of connectionServices) {
        this.unregisterServiceConnection(peerId, serviceType);
      }
    }

    // Clean up quality and performance data
    this.connectionQuality.delete(peerId);
    this.performanceMetrics.delete(peerId);
    this.latencyHistory.delete(peerId);

    // Original cleanup
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
    // Create a wrapped handler that extracts the detail
    const wrappedHandler = (event) => handler(event.detail);

    // Store the mapping for proper cleanup
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Map());
    }
    this.eventHandlers.get(eventType).set(handler, wrappedHandler);

    // Add the wrapped handler to the event emitter
    this.eventEmitter.addEventListener(eventType, wrappedHandler);
  }

  off(eventType, handler) {
    // Get the wrapped handler from our mapping
    const typeHandlers = this.eventHandlers.get(eventType);
    if (typeHandlers && typeHandlers.has(handler)) {
      const wrappedHandler = typeHandlers.get(handler);
      this.eventEmitter.removeEventListener(eventType, wrappedHandler);
      typeHandlers.delete(handler);

      // Clean up empty maps
      if (typeHandlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
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

  // Get all connected peers (with working data channels)
  getConnectedPeers() {
    const connectedPeers = [];
    for (const [peerId] of this.connections) {
      if (this.hasConnection(peerId)) {
        connectedPeers.push(peerId);
      }
    }
    console.log(
      `📊 Connected peers with working data channels: [${connectedPeers.join(
        ", "
      )}]`
    );
    return connectedPeers;
  }

  // Check if peer has connection
  hasConnection(peerId) {
    const connection = this.connections.get(peerId);
    const dataChannel = this.dataChannels.get(peerId);

    // Connection is only truly working if both connection and data channel are ready
    const connectionReady =
      connection && connection.connectionState === "connected";
    const dataChannelReady = dataChannel && dataChannel.readyState === "open";

    console.log(
      `🔍 Connection check for ${peerId}: connection=${connection?.connectionState}, dataChannel=${dataChannel?.readyState}`
    );

    return connectionReady && dataChannelReady;
  }

  // Check if data channel is open
  isDataChannelOpen(peerId) {
    const dataChannel = this.dataChannels.get(peerId);
    return dataChannel && dataChannel.readyState === "open";
  }

  // Get connection state
  getConnectionState(peerId) {
    const connection = this.connections.get(peerId);
    return connection ? connection.connectionState : "disconnected";
  }

  // Get connection statistics
  async getConnectionStats(peerId) {
    const connection = this.connections.get(peerId);
    if (!connection) return null;
    return await connection.getStats();
  }

  // === SERVICE-AWARE CONNECTION MANAGEMENT ===

  // Create connection for specific service
  async createServiceConnection(peerId, serviceType, isInitiator = false) {
    console.log(
      `Creating service connection to ${peerId} for service: ${serviceType}`
    );

    // Check if we already have a connection for this service
    const serviceConnections = this.serviceConnections.get(serviceType);
    if (serviceConnections && serviceConnections.has(peerId)) {
      return serviceConnections.get(peerId);
    }

    // Create or reuse existing connection
    let connection = this.connections.get(peerId);
    if (!connection) {
      connection = await this.createConnection(peerId, isInitiator);
    }

    // Register connection for service
    this.registerServiceConnection(peerId, serviceType, connection);

    return connection;
  }

  // Register connection for a service
  registerServiceConnection(peerId, serviceType, connection) {
    // Add to service connections map
    if (!this.serviceConnections.has(serviceType)) {
      this.serviceConnections.set(serviceType, new Map());
    }
    this.serviceConnections.get(serviceType).set(peerId, connection);

    // Add to connection services map
    if (!this.connectionServices.has(peerId)) {
      this.connectionServices.set(peerId, new Set());
    }
    this.connectionServices.get(peerId).add(serviceType);

    this.emit("service-connection-registered", {
      peerId,
      serviceType,
      connection,
    });
  }

  // Unregister connection from a service
  unregisterServiceConnection(peerId, serviceType) {
    const serviceConnections = this.serviceConnections.get(serviceType);
    if (serviceConnections) {
      serviceConnections.delete(peerId);
      if (serviceConnections.size === 0) {
        this.serviceConnections.delete(serviceType);
      }
    }

    const connectionServices = this.connectionServices.get(peerId);
    if (connectionServices) {
      connectionServices.delete(serviceType);
      if (connectionServices.size === 0) {
        this.connectionServices.delete(peerId);
      }
    }

    this.emit("service-connection-unregistered", {
      peerId,
      serviceType,
    });
  }

  // Get connections for a specific service
  getServiceConnections(serviceType) {
    const serviceConnections = this.serviceConnections.get(serviceType);
    if (!serviceConnections) return [];

    const activeConnections = [];
    for (const [peerId, connection] of serviceConnections) {
      if (connection.connectionState === "connected") {
        activeConnections.push({ peerId, connection });
      }
    }
    return activeConnections;
  }

  // Get services for a specific peer
  getPeerServices(peerId) {
    return Array.from(this.connectionServices.get(peerId) || []);
  }

  // Check if peer provides a service
  peerProvidesService(peerId, serviceType) {
    const connectionServices = this.connectionServices.get(peerId);
    return connectionServices ? connectionServices.has(serviceType) : false;
  }

  // === CONNECTION QUALITY MONITORING ===

  // Start quality monitoring for specific peer
  startPeerQualityMonitoring(peerId) {
    if (this.qualityTimers.has(peerId)) {
      return; // Already monitoring
    }

    const timer = setInterval(async () => {
      await this.measureConnectionQuality(peerId);
    }, this.qualityMonitoringInterval);

    this.qualityTimers.set(peerId, timer);
  }

  // Stop quality monitoring for specific peer
  stopPeerQualityMonitoring(peerId) {
    const timer = this.qualityTimers.get(peerId);
    if (timer) {
      clearInterval(timer);
      this.qualityTimers.delete(peerId);
    }
  }

  // Measure connection quality for a peer
  async measureConnectionQuality(peerId) {
    const connection = this.connections.get(peerId);
    if (!connection || connection.connectionState !== "connected") {
      return;
    }

    try {
      // Get WebRTC stats
      const stats = await connection.getStats();
      const quality = this.analyzeConnectionStats(stats);

      // Update quality metrics
      this.connectionQuality.set(peerId, {
        ...quality,
        timestamp: Date.now(),
        peerId,
      });

      // Update performance metrics
      this.updatePerformanceMetrics(peerId, quality);

      // Emit quality update event
      this.emit("connection-quality-updated", {
        peerId,
        quality,
      });
    } catch (error) {
      console.error(
        `Failed to measure connection quality for ${peerId}:`,
        error
      );
    }
  }

  // Analyze WebRTC stats to determine connection quality
  analyzeConnectionStats(stats) {
    let bytesReceived = 0;
    let bytesSent = 0;
    let packetsLost = 0;
    let packetsReceived = 0;
    let currentRoundTripTime = 0;
    let availableOutgoingBitrate = 0;

    for (const report of stats.values()) {
      if (report.type === "inbound-rtp") {
        bytesReceived += report.bytesReceived || 0;
        packetsLost += report.packetsLost || 0;
        packetsReceived += report.packetsReceived || 0;
      } else if (report.type === "outbound-rtp") {
        bytesSent += report.bytesSent || 0;
      } else if (
        report.type === "candidate-pair" &&
        report.state === "succeeded"
      ) {
        currentRoundTripTime = report.currentRoundTripTime || 0;
        availableOutgoingBitrate = report.availableOutgoingBitrate || 0;
      }
    }

    // Calculate quality metrics
    const packetLossRate =
      packetsReceived > 0 ? packetsLost / (packetsReceived + packetsLost) : 0;
    const latency = currentRoundTripTime * 1000; // Convert to milliseconds

    // Quality score (0-1, higher is better)
    const latencyScore = Math.max(0, 1 - latency / 500); // 500ms = 0 score
    const packetLossScore = Math.max(0, 1 - packetLossRate * 10); // 10% loss = 0 score
    const bandwidthScore = Math.min(1, availableOutgoingBitrate / 1000000); // 1Mbps = 1.0 score

    const overallScore = (latencyScore + packetLossScore + bandwidthScore) / 3;

    return {
      latency,
      packetLossRate,
      availableOutgoingBitrate,
      bytesReceived,
      bytesSent,
      overallScore,
      latencyScore,
      packetLossScore,
      bandwidthScore,
    };
  }

  // Update performance metrics
  updatePerformanceMetrics(peerId, quality) {
    const existing = this.performanceMetrics.get(peerId) || {
      averageLatency: 0,
      averagePacketLoss: 0,
      averageBandwidth: 0,
      averageScore: 0,
      measurementCount: 0,
    };

    // Update running averages
    const count = existing.measurementCount + 1;
    existing.averageLatency =
      (existing.averageLatency * existing.measurementCount + quality.latency) /
      count;
    existing.averagePacketLoss =
      (existing.averagePacketLoss * existing.measurementCount +
        quality.packetLossRate) /
      count;
    existing.averageBandwidth =
      (existing.averageBandwidth * existing.measurementCount +
        quality.availableOutgoingBitrate) /
      count;
    existing.averageScore =
      (existing.averageScore * existing.measurementCount +
        quality.overallScore) /
      count;
    existing.measurementCount = count;
    existing.lastUpdated = Date.now();

    this.performanceMetrics.set(peerId, existing);

    // Update latency history
    if (!this.latencyHistory.has(peerId)) {
      this.latencyHistory.set(peerId, []);
    }
    const history = this.latencyHistory.get(peerId);
    history.push(quality.latency);

    // Keep only last 20 measurements
    if (history.length > 20) {
      history.shift();
    }
  }

  // Get connection quality for a peer
  getConnectionQuality(peerId) {
    return this.connectionQuality.get(peerId);
  }

  // Get performance metrics for a peer
  getPerformanceMetrics(peerId) {
    return this.performanceMetrics.get(peerId);
  }

  // Get all connection qualities
  getAllConnectionQualities() {
    const result = new Map();
    for (const [peerId, quality] of this.connectionQuality) {
      result.set(peerId, { ...quality });
    }
    return result;
  }
}
