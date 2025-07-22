import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { P2PConnectionManager } from "../lib/P2PConnectionManager.js";

// Mock WebRTC APIs
global.RTCPeerConnection = vi.fn(() => ({
  createDataChannel: vi.fn(() => ({
    addEventListener: vi.fn(),
    close: vi.fn(),
    readyState: "open",
  })),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  addIceCandidate: vi.fn(),
  close: vi.fn(),
  connectionState: "connected",
  iceConnectionState: "connected",
  getStats: vi.fn(() =>
    Promise.resolve(
      new Map([
        [
          "inbound-rtp",
          {
            type: "inbound-rtp",
            bytesReceived: 1000,
            packetsLost: 5,
            packetsReceived: 100,
          },
        ],
        [
          "outbound-rtp",
          {
            type: "outbound-rtp",
            bytesSent: 2000,
          },
        ],
        [
          "candidate-pair",
          {
            type: "candidate-pair",
            state: "succeeded",
            currentRoundTripTime: 0.05, // 50ms
            availableOutgoingBitrate: 1000000, // 1Mbps
          },
        ],
      ])
    )
  ),
}));

describe("P2PConnectionManager - Enhanced Features", () => {
  let connectionManager;
  let mockPeerId;

  beforeEach(() => {
    connectionManager = new P2PConnectionManager({
      qualityMonitoringInterval: 100, // Short interval for testing
    });
    mockPeerId = "test-peer-123";
  });

  afterEach(() => {
    // Clean up any active connections
    for (const peerId of connectionManager.connections.keys()) {
      connectionManager.cleanup(peerId);
    }
  });

  describe("Service-Aware Connection Management", () => {
    it("should create service connections", async () => {
      const serviceType = "file_sharing";
      const connection = await connectionManager.createServiceConnection(
        mockPeerId,
        serviceType,
        true
      );

      expect(connection).toBeDefined();
      expect(
        connectionManager.peerProvidesService(mockPeerId, serviceType)
      ).toBe(true);

      const serviceConnections =
        connectionManager.getServiceConnections(serviceType);
      expect(serviceConnections).toHaveLength(1);
      expect(serviceConnections[0].peerId).toBe(mockPeerId);
    });

    it("should reuse existing connections for services", async () => {
      // Create initial connection
      const connection1 = await connectionManager.createConnection(
        mockPeerId,
        true
      );

      // Create service connection should reuse existing
      const connection2 = await connectionManager.createServiceConnection(
        mockPeerId,
        "file_sharing",
        true
      );

      expect(connection1).toBe(connection2);
    });

    it("should register and unregister service connections", () => {
      const mockConnection = { connectionState: "connected" };
      const serviceType = "signaling_relay";

      const registerSpy = vi.fn();
      const unregisterSpy = vi.fn();
      connectionManager.on("service-connection-registered", registerSpy);
      connectionManager.on("service-connection-unregistered", unregisterSpy);

      // Register service
      connectionManager.registerServiceConnection(
        mockPeerId,
        serviceType,
        mockConnection
      );

      expect(
        connectionManager.peerProvidesService(mockPeerId, serviceType)
      ).toBe(true);
      expect(registerSpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        serviceType,
        connection: mockConnection,
      });

      // Unregister service
      connectionManager.unregisterServiceConnection(mockPeerId, serviceType);

      expect(
        connectionManager.peerProvidesService(mockPeerId, serviceType)
      ).toBe(false);
      expect(unregisterSpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        serviceType,
      });
    });

    it("should get peer services correctly", () => {
      const mockConnection = { connectionState: "connected" };

      connectionManager.registerServiceConnection(
        mockPeerId,
        "messaging",
        mockConnection
      );
      connectionManager.registerServiceConnection(
        mockPeerId,
        "file_sharing",
        mockConnection
      );

      const services = connectionManager.getPeerServices(mockPeerId);
      expect(services).toContain("messaging");
      expect(services).toContain("file_sharing");
      expect(services).toHaveLength(2);
    });

    it("should filter service connections by state", () => {
      const connectedConnection = { connectionState: "connected" };
      const disconnectedConnection = { connectionState: "disconnected" };

      connectionManager.registerServiceConnection(
        "peer1",
        "messaging",
        connectedConnection
      );
      connectionManager.registerServiceConnection(
        "peer2",
        "messaging",
        disconnectedConnection
      );

      const activeConnections =
        connectionManager.getServiceConnections("messaging");
      expect(activeConnections).toHaveLength(1);
      expect(activeConnections[0].peerId).toBe("peer1");
    });
  });

  describe("Connection Quality Monitoring", () => {
    it("should start and stop quality monitoring", () => {
      expect(connectionManager.qualityTimers.has(mockPeerId)).toBe(false);

      connectionManager.startPeerQualityMonitoring(mockPeerId);
      expect(connectionManager.qualityTimers.has(mockPeerId)).toBe(true);

      connectionManager.stopPeerQualityMonitoring(mockPeerId);
      expect(connectionManager.qualityTimers.has(mockPeerId)).toBe(false);
    });

    it("should not start duplicate quality monitoring", () => {
      connectionManager.startPeerQualityMonitoring(mockPeerId);
      const timer1 = connectionManager.qualityTimers.get(mockPeerId);

      connectionManager.startPeerQualityMonitoring(mockPeerId);
      const timer2 = connectionManager.qualityTimers.get(mockPeerId);

      expect(timer1).toBe(timer2);
    });

    it("should measure connection quality", async () => {
      // Create a mock connection
      const mockConnection = new RTCPeerConnection();
      connectionManager.connections.set(mockPeerId, mockConnection);

      const qualitySpy = vi.fn();
      connectionManager.on("connection-quality-updated", qualitySpy);

      await connectionManager.measureConnectionQuality(mockPeerId);

      expect(qualitySpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        quality: expect.objectContaining({
          latency: expect.any(Number),
          packetLossRate: expect.any(Number),
          availableOutgoingBitrate: expect.any(Number),
          overallScore: expect.any(Number),
        }),
      });

      const quality = connectionManager.getConnectionQuality(mockPeerId);
      expect(quality).toBeDefined();
      expect(quality.latency).toBe(50); // 0.05 * 1000
      expect(quality.packetLossRate).toBeCloseTo(0.048, 3); // 5 / (100 + 5)
    });

    it("should analyze connection stats correctly", () => {
      const mockStats = new Map([
        [
          "inbound-rtp",
          {
            type: "inbound-rtp",
            bytesReceived: 2000,
            packetsLost: 10,
            packetsReceived: 200,
          },
        ],
        [
          "outbound-rtp",
          {
            type: "outbound-rtp",
            bytesSent: 3000,
          },
        ],
        [
          "candidate-pair",
          {
            type: "candidate-pair",
            state: "succeeded",
            currentRoundTripTime: 0.1, // 100ms
            availableOutgoingBitrate: 2000000, // 2Mbps
          },
        ],
      ]);

      const quality = connectionManager.analyzeConnectionStats(mockStats);

      expect(quality.latency).toBe(100);
      expect(quality.packetLossRate).toBeCloseTo(0.048, 3); // 10 / (200 + 10)
      expect(quality.availableOutgoingBitrate).toBe(2000000);
      expect(quality.bytesReceived).toBe(2000);
      expect(quality.bytesSent).toBe(3000);
      expect(quality.overallScore).toBeGreaterThan(0);
      expect(quality.overallScore).toBeLessThanOrEqual(1);
    });

    it("should update performance metrics", () => {
      const quality1 = {
        latency: 50,
        packetLossRate: 0.01,
        availableOutgoingBitrate: 1000000,
        overallScore: 0.8,
      };

      const quality2 = {
        latency: 70,
        packetLossRate: 0.02,
        availableOutgoingBitrate: 1500000,
        overallScore: 0.7,
      };

      connectionManager.updatePerformanceMetrics(mockPeerId, quality1);
      connectionManager.updatePerformanceMetrics(mockPeerId, quality2);

      const metrics = connectionManager.getPerformanceMetrics(mockPeerId);
      expect(metrics.averageLatency).toBe(60); // (50 + 70) / 2
      expect(metrics.averagePacketLoss).toBe(0.015); // (0.01 + 0.02) / 2
      expect(metrics.averageBandwidth).toBe(1250000); // (1000000 + 1500000) / 2
      expect(metrics.averageScore).toBe(0.75); // (0.8 + 0.7) / 2
      expect(metrics.measurementCount).toBe(2);
    });

    it("should maintain latency history", () => {
      const quality1 = { latency: 50 };
      const quality2 = { latency: 60 };
      const quality3 = { latency: 70 };

      connectionManager.updatePerformanceMetrics(mockPeerId, quality1);
      connectionManager.updatePerformanceMetrics(mockPeerId, quality2);
      connectionManager.updatePerformanceMetrics(mockPeerId, quality3);

      const history = connectionManager.latencyHistory.get(mockPeerId);
      expect(history).toEqual([50, 60, 70]);
    });

    it("should limit latency history size", () => {
      // Add more than 20 measurements
      for (let i = 0; i < 25; i++) {
        connectionManager.updatePerformanceMetrics(mockPeerId, { latency: i });
      }

      const history = connectionManager.latencyHistory.get(mockPeerId);
      expect(history.length).toBe(20);
      expect(history[0]).toBe(5); // First 5 should be removed
      expect(history[19]).toBe(24); // Last should be 24
    });

    it("should get all connection qualities", () => {
      const quality1 = { latency: 50, overallScore: 0.8 };
      const quality2 = { latency: 60, overallScore: 0.7 };

      connectionManager.connectionQuality.set("peer1", {
        ...quality1,
        peerId: "peer1",
      });
      connectionManager.connectionQuality.set("peer2", {
        ...quality2,
        peerId: "peer2",
      });

      const allQualities = connectionManager.getAllConnectionQualities();
      expect(allQualities.size).toBe(2);
      expect(allQualities.get("peer1").latency).toBe(50);
      expect(allQualities.get("peer2").latency).toBe(60);
    });
  });

  describe("Enhanced Cleanup", () => {
    it("should clean up service connections and quality monitoring", () => {
      const mockConnection = { connectionState: "connected", close: vi.fn() };
      const mockDataChannel = { close: vi.fn() };

      // Set up connections and services
      connectionManager.connections.set(mockPeerId, mockConnection);
      connectionManager.dataChannels.set(mockPeerId, mockDataChannel);
      connectionManager.registerServiceConnection(
        mockPeerId,
        "messaging",
        mockConnection
      );
      connectionManager.startPeerQualityMonitoring(mockPeerId);
      connectionManager.connectionQuality.set(mockPeerId, { latency: 50 });
      connectionManager.performanceMetrics.set(mockPeerId, {
        averageLatency: 50,
      });

      // Cleanup
      connectionManager.cleanup(mockPeerId);

      // Verify cleanup
      expect(connectionManager.connections.has(mockPeerId)).toBe(false);
      expect(connectionManager.dataChannels.has(mockPeerId)).toBe(false);
      expect(
        connectionManager.peerProvidesService(mockPeerId, "messaging")
      ).toBe(false);
      expect(connectionManager.qualityTimers.has(mockPeerId)).toBe(false);
      expect(connectionManager.connectionQuality.has(mockPeerId)).toBe(false);
      expect(connectionManager.performanceMetrics.has(mockPeerId)).toBe(false);
      expect(connectionManager.latencyHistory.has(mockPeerId)).toBe(false);
    });
  });

  describe("Connection Event Handling", () => {
    it("should start quality monitoring when connection becomes connected", () => {
      const mockConnection = new RTCPeerConnection();
      connectionManager.connections.set(mockPeerId, mockConnection);

      // Simulate connection state change to connected
      connectionManager.setupConnectionEventHandlers(
        mockConnection,
        mockPeerId
      );

      // Trigger the connection state change
      const onConnectionStateChange = mockConnection.onconnectionstatechange;
      mockConnection.connectionState = "connected";
      onConnectionStateChange();

      expect(connectionManager.qualityTimers.has(mockPeerId)).toBe(true);
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain existing connection methods", () => {
      expect(typeof connectionManager.createConnection).toBe("function");
      expect(typeof connectionManager.sendReliable).toBe("function");
      expect(typeof connectionManager.getConnectedPeers).toBe("function");
      expect(typeof connectionManager.hasConnection).toBe("function");
      expect(typeof connectionManager.getConnectionState).toBe("function");
    });

    it("should maintain existing event emissions", () => {
      const eventSpy = vi.fn();
      connectionManager.on("peer-connected", eventSpy);

      connectionManager.emit("peer-connected", { peerId: mockPeerId });
      expect(eventSpy).toHaveBeenCalledWith({ peerId: mockPeerId });
    });
  });
});
