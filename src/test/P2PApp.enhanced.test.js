import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { P2PApp } from "../lib/P2PApp.js";

// Mock the dependencies
vi.mock("../lib/MinimalSignaling.js", () => ({
  MinimalSignaling: vi.fn(() => ({
    connect: vi.fn(() => Promise.resolve("test-peer-123")),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    getPeerId: vi.fn(() => "test-peer-123"),
    joinRoom: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }))
}));

vi.mock("../lib/P2PConnectionManager.js", () => ({
  P2PConnectionManager: vi.fn(() => ({
    connections: new Map(),
    getConnectedPeers: vi.fn(() => []),
    cleanup: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    sendReliable: vi.fn(),
    getConnectionQuality: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    getAllConnectionQualities: vi.fn(() => new Map())
  }))
}));

vi.mock("../lib/PeerCapabilityManager.js", () => ({
  PeerCapabilityManager: vi.fn(() => ({
    getLocalCapabilities: vi.fn(() => ({
      peerId: "test-peer-123",
      role: "BASIC",
      services: new Set(["messaging"])
    })),
    getAllRemotePeerCapabilities: vi.fn(() => new Map()),
    findServiceProviders: vi.fn(() => []),
    addService: vi.fn(),
    removeService: vi.fn(),
    providesService: vi.fn(() => false),
    updateLocalCapabilities: vi.fn(),
    updateRemotePeerCapabilities: vi.fn(),
    updatePeerPerformance: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }))
}));

describe("P2PApp - Enhanced Features", () => {
  let p2pApp;
  let mockSignaling;
  let mockConnectionManager;
  let mockCapabilityManager;

  beforeEach(async () => {
    p2pApp = new P2PApp({
      signalingServer: "http://localhost:4000"
    });

    // Get mock instances
    mockSignaling = p2pApp.signaling;
    mockConnectionManager = p2pApp.connectionManager;
    
    // Connect to initialize capability manager
    await p2pApp.connect();
    mockCapabilityManager = p2pApp.capabilityManager;
  });

  afterEach(() => {
    if (p2pApp) {
      p2pApp.disconnect();
    }
  });

  describe("Capability Manager Integration", () => {
    it("should initialize capability manager on connect", async () => {
      expect(p2pApp.capabilityManager).toBeDefined();
      expect(mockCapabilityManager).toBeDefined();
    });

    it("should set up capability event handlers", () => {
      expect(mockCapabilityManager.on).toHaveBeenCalledWith(
        "advertise-capabilities",
        expect.any(Function)
      );
      expect(mockCapabilityManager.on).toHaveBeenCalledWith(
        "capabilities-updated",
        expect.any(Function)
      );
      expect(mockCapabilityManager.on).toHaveBeenCalledWith(
        "role-changed",
        expect.any(Function)
      );
    });

    it("should handle capability advertisements", async () => {
      const advertisement = {
        type: "capability_advertisement",
        capabilities: { peerId: "remote-peer", services: ["messaging"] }
      };

      // Simulate receiving capability advertisement
      const messageHandler = mockConnectionManager.on.mock.calls.find(
        call => call[0] === "message-received"
      )[1];

      messageHandler({
        peerId: "remote-peer",
        message: { data: advertisement }
      });

      expect(mockCapabilityManager.updateRemotePeerCapabilities).toHaveBeenCalledWith(
        "remote-peer",
        advertisement.capabilities
      );
    });

    it("should not emit regular message events for capability advertisements", () => {
      const messageSpy = vi.fn();
      p2pApp.on("message", messageSpy);

      const advertisement = {
        type: "capability_advertisement",
        capabilities: { peerId: "remote-peer", services: ["messaging"] }
      };

      // Simulate receiving capability advertisement
      const messageHandler = mockConnectionManager.on.mock.calls.find(
        call => call[0] === "message-received"
      )[1];

      messageHandler({
        peerId: "remote-peer",
        message: { data: advertisement }
      });

      expect(messageSpy).not.toHaveBeenCalled();
    });

    it("should update peer performance on connection quality updates", () => {
      const qualityData = {
        peerId: "remote-peer",
        quality: { latency: 50, overallScore: 0.8 }
      };

      // Simulate connection quality update
      const qualityHandler = mockConnectionManager.on.mock.calls.find(
        call => call[0] === "connection-quality-updated"
      )[1];

      qualityHandler(qualityData);

      expect(mockCapabilityManager.updatePeerPerformance).toHaveBeenCalledWith(
        "remote-peer",
        { latency: 50, success: true }
      );
    });
  });

  describe("Capability Management API", () => {
    it("should get local capabilities", () => {
      const capabilities = p2pApp.getLocalCapabilities();
      expect(mockCapabilityManager.getLocalCapabilities).toHaveBeenCalled();
      expect(capabilities).toBeDefined();
    });

    it("should get all remote peer capabilities", () => {
      const capabilities = p2pApp.getAllRemotePeerCapabilities();
      expect(mockCapabilityManager.getAllRemotePeerCapabilities).toHaveBeenCalled();
      expect(capabilities).toBeInstanceOf(Map);
    });

    it("should get peer capabilities for specific peer", () => {
      const remotePeerId = "remote-peer-123";
      mockCapabilityManager.getAllRemotePeerCapabilities.mockReturnValue(
        new Map([[remotePeerId, { peerId: remotePeerId, role: "ENHANCED" }]])
      );

      const capabilities = p2pApp.getPeerCapabilities(remotePeerId);
      expect(capabilities).toEqual({ peerId: remotePeerId, role: "ENHANCED" });
    });

    it("should find service providers", () => {
      const serviceType = "file_sharing";
      const options = { minReliability: 0.9 };

      p2pApp.findServiceProviders(serviceType, options);
      expect(mockCapabilityManager.findServiceProviders).toHaveBeenCalledWith(
        serviceType,
        options
      );
    });

    it("should add services", () => {
      const serviceType = "file_sharing";
      p2pApp.addService(serviceType);
      expect(mockCapabilityManager.addService).toHaveBeenCalledWith(serviceType);
    });

    it("should remove services", () => {
      const serviceType = "file_sharing";
      p2pApp.removeService(serviceType);
      expect(mockCapabilityManager.removeService).toHaveBeenCalledWith(serviceType);
    });

    it("should check if peer provides service", () => {
      const serviceType = "messaging";
      p2pApp.providesService(serviceType);
      expect(mockCapabilityManager.providesService).toHaveBeenCalledWith(serviceType);
    });

    it("should update capabilities", () => {
      const updates = { resources: { maxConnections: 20 } };
      p2pApp.updateCapabilities(updates);
      expect(mockCapabilityManager.updateLocalCapabilities).toHaveBeenCalledWith(updates);
    });
  });

  describe("Connection Quality API", () => {
    it("should get connection quality for peer", () => {
      const peerId = "test-peer";
      p2pApp.getConnectionQuality(peerId);
      expect(mockConnectionManager.getConnectionQuality).toHaveBeenCalledWith(peerId);
    });

    it("should get performance metrics for peer", () => {
      const peerId = "test-peer";
      p2pApp.getPerformanceMetrics(peerId);
      expect(mockConnectionManager.getPerformanceMetrics).toHaveBeenCalledWith(peerId);
    });

    it("should get all connection qualities", () => {
      p2pApp.getAllConnectionQualities();
      expect(mockConnectionManager.getAllConnectionQualities).toHaveBeenCalled();
    });
  });

  describe("Event Forwarding", () => {
    it("should forward capability events", () => {
      const capabilitiesUpdatedSpy = vi.fn();
      const roleChangedSpy = vi.fn();
      const serviceAddedSpy = vi.fn();

      p2pApp.on("capabilities-updated", capabilitiesUpdatedSpy);
      p2pApp.on("role-changed", roleChangedSpy);
      p2pApp.on("service-added", serviceAddedSpy);

      // Simulate capability manager events
      const capabilitiesHandler = mockCapabilityManager.on.mock.calls.find(
        call => call[0] === "capabilities-updated"
      )[1];
      const roleHandler = mockCapabilityManager.on.mock.calls.find(
        call => call[0] === "role-changed"
      )[1];
      const serviceHandler = mockCapabilityManager.on.mock.calls.find(
        call => call[0] === "service-added"
      )[1];

      const capabilitiesData = { peerId: "test", capabilities: {} };
      const roleData = { peerId: "test", oldRole: "BASIC", newRole: "ENHANCED" };
      const serviceData = { peerId: "test", serviceType: "file_sharing" };

      capabilitiesHandler(capabilitiesData);
      roleHandler(roleData);
      serviceHandler(serviceData);

      expect(capabilitiesUpdatedSpy).toHaveBeenCalledWith(capabilitiesData);
      expect(roleChangedSpy).toHaveBeenCalledWith(roleData);
      expect(serviceAddedSpy).toHaveBeenCalledWith(serviceData);
    });

    it("should forward connection quality events", () => {
      const qualitySpy = vi.fn();
      p2pApp.on("connection-quality-updated", qualitySpy);

      const qualityHandler = mockConnectionManager.on.mock.calls.find(
        call => call[0] === "connection-quality-updated"
      )[1];

      const qualityData = { peerId: "test", quality: { latency: 50 } };
      qualityHandler(qualityData);

      expect(qualitySpy).toHaveBeenCalledWith(qualityData);
    });
  });

  describe("Capability Advertisement Broadcasting", () => {
    it("should broadcast capability advertisements to connected peers", async () => {
      const connectedPeers = ["peer1", "peer2", "peer3"];
      mockConnectionManager.getConnectedPeers.mockReturnValue(connectedPeers);

      const advertisement = {
        type: "capability_advertisement",
        capabilities: { peerId: "test-peer-123", services: ["messaging"] }
      };

      // Simulate capability advertisement
      const advertisementHandler = mockCapabilityManager.on.mock.calls.find(
        call => call[0] === "advertise-capabilities"
      )[1];

      await advertisementHandler(advertisement);

      // Should send to all connected peers
      expect(mockConnectionManager.sendReliable).toHaveBeenCalledTimes(3);
      expect(mockConnectionManager.sendReliable).toHaveBeenCalledWith("peer1", advertisement);
      expect(mockConnectionManager.sendReliable).toHaveBeenCalledWith("peer2", advertisement);
      expect(mockConnectionManager.sendReliable).toHaveBeenCalledWith("peer3", advertisement);
    });

    it("should handle advertisement broadcast failures gracefully", async () => {
      const connectedPeers = ["peer1", "peer2"];
      mockConnectionManager.getConnectedPeers.mockReturnValue(connectedPeers);
      mockConnectionManager.sendReliable.mockRejectedValueOnce(new Error("Send failed"));

      const advertisement = {
        type: "capability_advertisement",
        capabilities: { peerId: "test-peer-123", services: ["messaging"] }
      };

      const advertisementHandler = mockCapabilityManager.on.mock.calls.find(
        call => call[0] === "advertise-capabilities"
      )[1];

      // Should not throw error
      await expect(advertisementHandler(advertisement)).resolves.toBeUndefined();
    });
  });

  describe("Cleanup and Disconnection", () => {
    it("should clean up capability manager on disconnect", () => {
      p2pApp.disconnect();

      expect(mockCapabilityManager.stop).toHaveBeenCalled();
      expect(p2pApp.capabilityManager).toBeNull();
    });

    it("should handle disconnect when capability manager is not initialized", () => {
      const newApp = new P2PApp();
      expect(() => newApp.disconnect()).not.toThrow();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain existing P2PApp API", () => {
      expect(typeof p2pApp.connect).toBe("function");
      expect(typeof p2pApp.disconnect).toBe("function");
      expect(typeof p2pApp.joinRoom).toBe("function");
      expect(typeof p2pApp.sendMessage).toBe("function");
      expect(typeof p2pApp.getPeerId).toBe("function");
      expect(typeof p2pApp.isConnected).toBe("function");
    });

    it("should handle capability API calls when capability manager is not initialized", () => {
      const newApp = new P2PApp();
      
      expect(newApp.getLocalCapabilities()).toBeNull();
      expect(newApp.getAllRemotePeerCapabilities()).toBeInstanceOf(Map);
      expect(newApp.getAllRemotePeerCapabilities().size).toBe(0);
      expect(newApp.findServiceProviders("messaging")).toEqual([]);
      expect(newApp.providesService("messaging")).toBe(false);
      
      // These should not throw
      expect(() => newApp.addService("file_sharing")).not.toThrow();
      expect(() => newApp.removeService("file_sharing")).not.toThrow();
      expect(() => newApp.updateCapabilities({})).not.toThrow();
    });

    it("should maintain existing event emissions", () => {
      const connectedSpy = vi.fn();
      const messageSpy = vi.fn();

      p2pApp.on("connected", connectedSpy);
      p2pApp.on("message", messageSpy);

      p2pApp.emit("connected", { peerId: "test" });
      p2pApp.emit("message", { content: "test message" });

      expect(connectedSpy).toHaveBeenCalledWith({ peerId: "test" });
      expect(messageSpy).toHaveBeenCalledWith({ content: "test message" });
    });
  });
});
