// Peer Capability Management for Hybrid P2P Architecture
export class PeerCapabilityManager {
  constructor(peerId, config = {}) {
    this.peerId = peerId;
    this.eventEmitter = new EventTarget();

    // Local peer capabilities
    this.localCapabilities = {
      peerId: peerId,
      role: config.role || "BASIC",
      services: new Set(config.services || ["messaging"]),
      resources: {
        maxConnections: config.maxConnections || 10,
        maxBandwidth: config.maxBandwidth || "10mbps",
        availableStorage: config.availableStorage || 100, // MB
        uptime: 0.8, // Will be calculated over time
        reliability: 0.8, // Will be calculated based on performance
      },
      location: {
        region: config.region || "unknown",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      lastUpdated: Date.now(),
      version: "1.0",
    };

    // Remote peer capabilities cache
    this.remotePeerCapabilities = new Map(); // peerId -> capabilities

    // Service availability tracking
    this.serviceProviders = new Map(); // serviceType -> Set of peerIds

    // Performance tracking
    this.performanceHistory = new Map(); // peerId -> performance metrics

    // Configuration
    this.config = {
      advertisementInterval: config.advertisementInterval || 30000, // 30 seconds
      capabilityTTL: config.capabilityTTL || 120000, // 2 minutes
      maxCachedPeers: config.maxCachedPeers || 100,
      ...config,
    };

    // Start capability management
    this.startCapabilityManagement();
  }

  // Define available service types
  static get SERVICE_TYPES() {
    return {
      MESSAGING: "messaging",
      SIGNALING_RELAY: "signaling_relay",
      FILE_SHARING: "file_sharing",
      CONTACT_DISCOVERY: "contact_discovery",
      ROOM_MANAGEMENT: "room_management",
      BOOTSTRAP: "bootstrap",
    };
  }

  // Define peer role levels
  static get PEER_ROLES() {
    return {
      BASIC: {
        level: 1,
        services: ["messaging"],
        maxConnections: 10,
        maxBandwidth: "10mbps",
        minReliability: 0.8,
      },
      ENHANCED: {
        level: 2,
        services: ["messaging", "file_sharing", "contact_discovery"],
        maxConnections: 50,
        maxBandwidth: "50mbps",
        minReliability: 0.9,
      },
      SUPER: {
        level: 3,
        services: [
          "messaging",
          "file_sharing",
          "contact_discovery",
          "signaling_relay",
          "room_management",
        ],
        maxConnections: 200,
        maxBandwidth: "100mbps",
        minReliability: 0.95,
      },
      INFRASTRUCTURE: {
        level: 4,
        services: [
          "messaging",
          "file_sharing",
          "contact_discovery",
          "signaling_relay",
          "room_management",
          "bootstrap",
        ],
        maxConnections: 1000,
        maxBandwidth: "1gbps",
        minReliability: 0.99,
      },
    };
  }

  // Start capability management processes
  startCapabilityManagement() {
    // Periodic capability advertisement
    this.advertisementTimer = setInterval(() => {
      this.advertiseCapabilities();
    }, this.config.advertisementInterval);

    // Periodic cleanup of stale capabilities
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleCapabilities();
    }, this.config.capabilityTTL / 2);

    // Initial capability evaluation
    this.evaluateLocalCapabilities();
  }

  // Stop capability management
  stop() {
    if (this.advertisementTimer) {
      clearInterval(this.advertisementTimer);
      this.advertisementTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Update local capabilities
  updateLocalCapabilities(updates) {
    const oldCapabilities = { ...this.localCapabilities };

    // Merge updates
    this.localCapabilities = {
      ...this.localCapabilities,
      ...updates,
      lastUpdated: Date.now(),
    };

    // Re-evaluate role if resources changed
    if (updates.resources) {
      this.evaluateLocalCapabilities();
    }

    // Emit capability change event
    this.emit("capabilities-updated", {
      peerId: this.peerId,
      oldCapabilities,
      newCapabilities: this.localCapabilities,
    });

    // Advertise updated capabilities
    this.advertiseCapabilities();
  }

  // Evaluate and potentially upgrade local capabilities
  evaluateLocalCapabilities() {
    const currentRole = this.localCapabilities.role;
    const suggestedRole = this.suggestOptimalRole();

    if (suggestedRole !== currentRole) {
      const roleInfo = PeerCapabilityManager.PEER_ROLES[suggestedRole];

      // Update role and services
      this.localCapabilities.role = suggestedRole;
      this.localCapabilities.services = new Set(roleInfo.services);

      this.emit("role-changed", {
        peerId: this.peerId,
        oldRole: currentRole,
        newRole: suggestedRole,
        capabilities: this.localCapabilities,
      });
    }
  }

  // Suggest optimal role based on current resources
  suggestOptimalRole() {
    const resources = this.localCapabilities.resources;
    const roles = PeerCapabilityManager.PEER_ROLES;

    // Check from highest to lowest role by level
    const rolesByLevel = Object.entries(roles).sort(
      (a, b) => b[1].level - a[1].level
    );

    for (const [roleName, roleInfo] of rolesByLevel) {
      if (this.meetsRoleRequirements(resources, roleInfo)) {
        return roleName;
      }
    }

    return "BASIC"; // Fallback to basic role
  }

  // Check if resources meet role requirements
  meetsRoleRequirements(resources, roleInfo) {
    return (
      resources.maxConnections >= roleInfo.maxConnections &&
      resources.reliability >= roleInfo.minReliability &&
      this.compareBandwidth(resources.maxBandwidth, roleInfo.maxBandwidth) >= 0
    );
  }

  // Compare bandwidth strings (simple implementation)
  compareBandwidth(bandwidth1, bandwidth2) {
    const getValue = (bw) => {
      const match = bw.match(/(\d+)(mbps|gbps)/i);
      if (!match) return 0;
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return unit === "gbps" ? value * 1000 : value;
    };

    return getValue(bandwidth1) - getValue(bandwidth2);
  }

  // Get local capabilities
  getLocalCapabilities() {
    return { ...this.localCapabilities };
  }

  // Add a service to local capabilities
  addService(serviceType) {
    if (
      Object.values(PeerCapabilityManager.SERVICE_TYPES).includes(serviceType)
    ) {
      this.localCapabilities.services.add(serviceType);
      this.localCapabilities.lastUpdated = Date.now();
      this.advertiseCapabilities();

      this.emit("service-added", {
        peerId: this.peerId,
        serviceType,
        capabilities: this.localCapabilities,
      });
    }
  }

  // Remove a service from local capabilities
  removeService(serviceType) {
    if (this.localCapabilities.services.has(serviceType)) {
      this.localCapabilities.services.delete(serviceType);
      this.localCapabilities.lastUpdated = Date.now();
      this.advertiseCapabilities();

      this.emit("service-removed", {
        peerId: this.peerId,
        serviceType,
        capabilities: this.localCapabilities,
      });
    }
  }

  // Check if local peer provides a service
  providesService(serviceType) {
    return this.localCapabilities.services.has(serviceType);
  }

  // Update remote peer capabilities
  updateRemotePeerCapabilities(peerId, capabilities) {
    const oldCapabilities = this.remotePeerCapabilities.get(peerId);

    // Store capabilities with timestamp
    const capabilitiesWithTimestamp = {
      ...capabilities,
      receivedAt: Date.now(),
    };

    this.remotePeerCapabilities.set(peerId, capabilitiesWithTimestamp);

    // Update service providers index
    this.updateServiceProvidersIndex(peerId, capabilities);

    // Emit event
    this.emit("remote-capabilities-updated", {
      peerId,
      oldCapabilities,
      newCapabilities: capabilities,
    });
  }

  // Update service providers index
  updateServiceProvidersIndex(peerId, capabilities) {
    // Remove peer from all service provider sets
    for (const providers of this.serviceProviders.values()) {
      providers.delete(peerId);
    }

    // Add peer to relevant service provider sets
    if (capabilities.services) {
      const services = Array.isArray(capabilities.services)
        ? capabilities.services
        : Array.from(capabilities.services);

      for (const serviceType of services) {
        if (!this.serviceProviders.has(serviceType)) {
          this.serviceProviders.set(serviceType, new Set());
        }
        this.serviceProviders.get(serviceType).add(peerId);
      }
    }
  }

  // Find peers that provide a specific service
  findServiceProviders(serviceType, options = {}) {
    const providers = this.serviceProviders.get(serviceType) || new Set();
    const results = [];

    for (const peerId of providers) {
      const capabilities = this.remotePeerCapabilities.get(peerId);
      if (
        capabilities &&
        this.meetsServiceRequirements(capabilities, options)
      ) {
        results.push({
          peerId,
          capabilities,
          score: this.calculatePeerScore(capabilities, options),
        });
      }
    }

    // Sort by score (higher is better)
    results.sort((a, b) => b.score - a.score);

    return options.limit ? results.slice(0, options.limit) : results;
  }

  // Check if peer meets service requirements
  meetsServiceRequirements(capabilities, requirements) {
    if (
      requirements.minReliability &&
      capabilities.resources.reliability < requirements.minReliability
    ) {
      return false;
    }

    if (
      requirements.minBandwidth &&
      this.compareBandwidth(
        capabilities.resources.maxBandwidth,
        requirements.minBandwidth
      ) < 0
    ) {
      return false;
    }

    return true;
  }

  // Calculate peer score for service selection
  calculatePeerScore(capabilities, options = {}) {
    const weights = options.weights || {
      reliability: 0.4,
      bandwidth: 0.3,
      uptime: 0.2,
      latency: 0.1,
    };

    const resources = capabilities.resources;
    const performance = this.performanceHistory.get(capabilities.peerId) || {};

    // Calculate individual scores (0-1, higher is better)
    const reliabilityScore = resources.reliability || 0.5;
    const bandwidthScore = this.normalizeBandwidth(resources.maxBandwidth);
    const uptimeScore = resources.uptime || 0.5;
    const latencyScore = performance.averageLatency
      ? Math.max(0, 1 - performance.averageLatency / 1000)
      : 0.5;

    // Weighted sum
    return (
      weights.reliability * reliabilityScore +
      weights.bandwidth * bandwidthScore +
      weights.uptime * uptimeScore +
      weights.latency * latencyScore
    );
  }

  // Normalize bandwidth to 0-1 scale
  normalizeBandwidth(bandwidth) {
    const value = this.compareBandwidth(bandwidth, "0mbps");
    return Math.min(1, value / 1000); // Normalize to 1Gbps = 1.0
  }

  // Advertise capabilities to connected peers
  async advertiseCapabilities() {
    const advertisement = {
      type: "capability_advertisement",
      capabilities: this.getLocalCapabilities(),
      timestamp: Date.now(),
    };

    this.emit("advertise-capabilities", advertisement);
  }

  // Clean up stale remote peer capabilities
  cleanupStaleCapabilities() {
    const now = Date.now();
    const staleThreshold = this.config.capabilityTTL;

    for (const [peerId, capabilities] of this.remotePeerCapabilities) {
      if (now - capabilities.receivedAt > staleThreshold) {
        this.removePeerCapabilities(peerId);
      }
    }
  }

  // Remove peer capabilities
  removePeerCapabilities(peerId) {
    this.remotePeerCapabilities.delete(peerId);

    // Remove from service providers
    for (const providers of this.serviceProviders.values()) {
      providers.delete(peerId);
    }

    // Remove performance history
    this.performanceHistory.delete(peerId);

    this.emit("peer-capabilities-removed", { peerId });
  }

  // Update peer performance metrics
  updatePeerPerformance(peerId, metrics) {
    const existing = this.performanceHistory.get(peerId) || {
      latencyHistory: [],
      successRate: 1.0,
      lastUpdated: Date.now(),
    };

    // Update metrics
    if (metrics.latency !== undefined) {
      existing.latencyHistory.push(metrics.latency);
      // Keep only last 10 measurements
      if (existing.latencyHistory.length > 10) {
        existing.latencyHistory.shift();
      }
      existing.averageLatency =
        existing.latencyHistory.reduce((a, b) => a + b, 0) /
        existing.latencyHistory.length;
    }

    if (metrics.success !== undefined) {
      // Simple exponential moving average for success rate
      const alpha = 0.3; // Learning rate
      existing.successRate =
        existing.successRate * (1 - alpha) + (metrics.success ? 1 : 0) * alpha;
    }

    existing.lastUpdated = Date.now();
    this.performanceHistory.set(peerId, existing);
  }

  // Get all remote peer capabilities
  getAllRemotePeerCapabilities() {
    const result = new Map();
    for (const [peerId, capabilities] of this.remotePeerCapabilities) {
      result.set(peerId, { ...capabilities });
    }
    return result;
  }

  // Event handling
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

  off(eventType, handler) {
    this.eventEmitter.removeEventListener(eventType, handler);
  }
}
