import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PeerCapabilityManager } from "../lib/PeerCapabilityManager.js";

describe("PeerCapabilityManager", () => {
  let capabilityManager;
  let mockPeerId;

  beforeEach(() => {
    mockPeerId = "test-peer-123";
    capabilityManager = new PeerCapabilityManager(mockPeerId, {
      role: "BASIC",
      services: ["messaging"],
      maxConnections: 10,
      maxBandwidth: "10mbps",
      advertisementInterval: 100, // Short interval for testing
      capabilityTTL: 1000, // Short TTL for testing
    });
  });

  afterEach(() => {
    if (capabilityManager) {
      capabilityManager.stop();
    }
  });

  describe("Initialization", () => {
    it("should initialize with correct default capabilities", () => {
      const capabilities = capabilityManager.getLocalCapabilities();

      expect(capabilities.peerId).toBe(mockPeerId);
      expect(capabilities.role).toBe("BASIC");
      expect(capabilities.services).toContain("messaging");
      expect(capabilities.resources.maxConnections).toBe(10);
      expect(capabilities.resources.maxBandwidth).toBe("10mbps");
    });

    it("should have correct service types defined", () => {
      const serviceTypes = PeerCapabilityManager.SERVICE_TYPES;

      expect(serviceTypes.MESSAGING).toBe("messaging");
      expect(serviceTypes.SIGNALING_RELAY).toBe("signaling_relay");
      expect(serviceTypes.FILE_SHARING).toBe("file_sharing");
      expect(serviceTypes.CONTACT_DISCOVERY).toBe("contact_discovery");
      expect(serviceTypes.ROOM_MANAGEMENT).toBe("room_management");
      expect(serviceTypes.BOOTSTRAP).toBe("bootstrap");
    });

    it("should have correct peer roles defined", () => {
      const roles = PeerCapabilityManager.PEER_ROLES;

      expect(roles.BASIC.level).toBe(1);
      expect(roles.ENHANCED.level).toBe(2);
      expect(roles.SUPER.level).toBe(3);
      expect(roles.INFRASTRUCTURE.level).toBe(4);
    });
  });

  describe("Service Management", () => {
    it("should add services correctly", () => {
      const eventSpy = vi.fn();
      capabilityManager.on("service-added", eventSpy);

      capabilityManager.addService("file_sharing");

      expect(capabilityManager.providesService("file_sharing")).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        serviceType: "file_sharing",
        capabilities: expect.any(Object),
      });
    });

    it("should remove services correctly", () => {
      const eventSpy = vi.fn();
      capabilityManager.addService("file_sharing");
      capabilityManager.on("service-removed", eventSpy);

      capabilityManager.removeService("file_sharing");

      expect(capabilityManager.providesService("file_sharing")).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        serviceType: "file_sharing",
        capabilities: expect.any(Object),
      });
    });

    it("should not add invalid service types", () => {
      const initialServices = capabilityManager.getLocalCapabilities().services;
      const initialSize = initialServices.size;

      capabilityManager.addService("invalid_service");

      expect(capabilityManager.getLocalCapabilities().services.size).toBe(
        initialSize
      );
    });

    it("should check service provision correctly", () => {
      expect(capabilityManager.providesService("messaging")).toBe(true);
      expect(capabilityManager.providesService("file_sharing")).toBe(false);
    });
  });

  describe("Role Management", () => {
    it("should suggest optimal role based on resources", () => {
      // Test role upgrade
      capabilityManager.updateLocalCapabilities({
        resources: {
          maxConnections: 200,
          maxBandwidth: "100mbps",
          reliability: 0.95,
        },
      });

      const capabilities = capabilityManager.getLocalCapabilities();
      expect(capabilities.role).toBe("SUPER");
    });

    it("should emit role-changed event when role changes", () => {
      const eventSpy = vi.fn();
      capabilityManager.on("role-changed", eventSpy);

      capabilityManager.updateLocalCapabilities({
        resources: {
          maxConnections: 200,
          maxBandwidth: "100mbps",
          reliability: 0.95,
        },
      });

      expect(eventSpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        oldRole: "BASIC",
        newRole: "SUPER",
        capabilities: expect.any(Object),
      });
    });

    it("should meet role requirements correctly", () => {
      const basicRole = PeerCapabilityManager.PEER_ROLES.BASIC;
      const superRole = PeerCapabilityManager.PEER_ROLES.SUPER;

      const basicResources = {
        maxConnections: 10,
        maxBandwidth: "10mbps",
        reliability: 0.8,
      };

      const superResources = {
        maxConnections: 200,
        maxBandwidth: "100mbps",
        reliability: 0.95,
      };

      expect(
        capabilityManager.meetsRoleRequirements(basicResources, basicRole)
      ).toBe(true);
      expect(
        capabilityManager.meetsRoleRequirements(basicResources, superRole)
      ).toBe(false);
      expect(
        capabilityManager.meetsRoleRequirements(superResources, superRole)
      ).toBe(true);
    });
  });

  describe("Remote Peer Management", () => {
    it("should update remote peer capabilities", () => {
      const remotePeerId = "remote-peer-456";
      const remoteCapabilities = {
        peerId: remotePeerId,
        role: "ENHANCED",
        services: ["messaging", "file_sharing"],
        resources: {
          maxConnections: 50,
          maxBandwidth: "50mbps",
          reliability: 0.9,
        },
      };

      const eventSpy = vi.fn();
      capabilityManager.on("remote-capabilities-updated", eventSpy);

      capabilityManager.updateRemotePeerCapabilities(
        remotePeerId,
        remoteCapabilities
      );

      const allRemoteCapabilities =
        capabilityManager.getAllRemotePeerCapabilities();
      expect(allRemoteCapabilities.has(remotePeerId)).toBe(true);
      expect(allRemoteCapabilities.get(remotePeerId).role).toBe("ENHANCED");
      expect(eventSpy).toHaveBeenCalled();
    });

    it("should find service providers correctly", () => {
      const remotePeerId1 = "remote-peer-1";
      const remotePeerId2 = "remote-peer-2";

      capabilityManager.updateRemotePeerCapabilities(remotePeerId1, {
        peerId: remotePeerId1,
        services: ["messaging", "file_sharing"],
        resources: { reliability: 0.9, maxBandwidth: "50mbps" },
      });

      capabilityManager.updateRemotePeerCapabilities(remotePeerId2, {
        peerId: remotePeerId2,
        services: ["messaging", "signaling_relay"],
        resources: { reliability: 0.8, maxBandwidth: "30mbps" },
      });

      const fileProviders =
        capabilityManager.findServiceProviders("file_sharing");
      const signalingProviders =
        capabilityManager.findServiceProviders("signaling_relay");

      expect(fileProviders).toHaveLength(1);
      expect(fileProviders[0].peerId).toBe(remotePeerId1);
      expect(signalingProviders).toHaveLength(1);
      expect(signalingProviders[0].peerId).toBe(remotePeerId2);
    });

    it("should filter service providers by requirements", () => {
      const remotePeerId1 = "remote-peer-1";
      const remotePeerId2 = "remote-peer-2";

      capabilityManager.updateRemotePeerCapabilities(remotePeerId1, {
        peerId: remotePeerId1,
        services: ["messaging"],
        resources: { reliability: 0.95, maxBandwidth: "100mbps" },
      });

      capabilityManager.updateRemotePeerCapabilities(remotePeerId2, {
        peerId: remotePeerId2,
        services: ["messaging"],
        resources: { reliability: 0.7, maxBandwidth: "10mbps" },
      });

      const highReliabilityProviders = capabilityManager.findServiceProviders(
        "messaging",
        {
          minReliability: 0.9,
        }
      );

      expect(highReliabilityProviders).toHaveLength(1);
      expect(highReliabilityProviders[0].peerId).toBe(remotePeerId1);
    });

    it("should score peers correctly", () => {
      const capabilities1 = {
        peerId: "peer-1",
        resources: {
          reliability: 0.9,
          maxBandwidth: "50mbps",
          uptime: 0.95,
        },
      };

      const capabilities2 = {
        peerId: "peer-2",
        resources: {
          reliability: 0.8,
          maxBandwidth: "100mbps",
          uptime: 0.8,
        },
      };

      const score1 = capabilityManager.calculatePeerScore(capabilities1);
      const score2 = capabilityManager.calculatePeerScore(capabilities2);

      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
      expect(typeof score1).toBe("number");
      expect(typeof score2).toBe("number");
    });
  });

  describe("Performance Tracking", () => {
    it("should update peer performance metrics", () => {
      const remotePeerId = "remote-peer-123";

      capabilityManager.updatePeerPerformance(remotePeerId, {
        latency: 50,
        success: true,
      });

      capabilityManager.updatePeerPerformance(remotePeerId, {
        latency: 60,
        success: true,
      });

      const performance =
        capabilityManager.performanceHistory.get(remotePeerId);
      expect(performance).toBeDefined();
      expect(performance.averageLatency).toBe(55); // (50 + 60) / 2
      expect(performance.successRate).toBeGreaterThan(0.9);
    });

    it("should handle performance failures", () => {
      const remotePeerId = "remote-peer-123";

      // Multiple failures to bring success rate below 0.5
      capabilityManager.updatePeerPerformance(remotePeerId, {
        latency: 100,
        success: false,
      });

      capabilityManager.updatePeerPerformance(remotePeerId, {
        latency: 120,
        success: false,
      });

      capabilityManager.updatePeerPerformance(remotePeerId, {
        latency: 110,
        success: false,
      });

      const performance =
        capabilityManager.performanceHistory.get(remotePeerId);
      expect(performance.successRate).toBeLessThan(0.5);
    });
  });

  describe("Capability Cleanup", () => {
    it("should clean up stale capabilities", async () => {
      const remotePeerId = "remote-peer-123";

      capabilityManager.updateRemotePeerCapabilities(remotePeerId, {
        peerId: remotePeerId,
        services: ["messaging"],
      });

      expect(
        capabilityManager.getAllRemotePeerCapabilities().has(remotePeerId)
      ).toBe(true);

      // Wait for TTL to expire and trigger cleanup
      await new Promise((resolve) => setTimeout(resolve, 1100));
      capabilityManager.cleanupStaleCapabilities();

      expect(
        capabilityManager.getAllRemotePeerCapabilities().has(remotePeerId)
      ).toBe(false);
    });

    it("should remove peer capabilities manually", () => {
      const remotePeerId = "remote-peer-123";

      capabilityManager.updateRemotePeerCapabilities(remotePeerId, {
        peerId: remotePeerId,
        services: ["messaging"],
      });

      const eventSpy = vi.fn();
      capabilityManager.on("peer-capabilities-removed", eventSpy);

      capabilityManager.removePeerCapabilities(remotePeerId);

      expect(
        capabilityManager.getAllRemotePeerCapabilities().has(remotePeerId)
      ).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({ peerId: remotePeerId });
    });
  });

  describe("Bandwidth Comparison", () => {
    it("should compare bandwidth strings correctly", () => {
      expect(
        capabilityManager.compareBandwidth("100mbps", "50mbps")
      ).toBeGreaterThan(0);
      expect(
        capabilityManager.compareBandwidth("1gbps", "500mbps")
      ).toBeGreaterThan(0);
      expect(
        capabilityManager.compareBandwidth("50mbps", "100mbps")
      ).toBeLessThan(0);
      expect(capabilityManager.compareBandwidth("100mbps", "100mbps")).toBe(0);
    });

    it("should normalize bandwidth correctly", () => {
      expect(capabilityManager.normalizeBandwidth("100mbps")).toBe(0.1);
      expect(capabilityManager.normalizeBandwidth("1gbps")).toBe(1.0);
      expect(capabilityManager.normalizeBandwidth("500mbps")).toBe(0.5);
    });
  });

  describe("Event Handling", () => {
    it("should emit capability advertisement events", () => {
      const eventSpy = vi.fn();
      capabilityManager.on("advertise-capabilities", eventSpy);

      capabilityManager.advertiseCapabilities();

      expect(eventSpy).toHaveBeenCalledWith({
        type: "capability_advertisement",
        capabilities: expect.any(Object),
        timestamp: expect.any(Number),
      });
    });

    it("should emit capabilities-updated events", () => {
      const eventSpy = vi.fn();
      capabilityManager.on("capabilities-updated", eventSpy);

      capabilityManager.updateLocalCapabilities({
        resources: { maxConnections: 20 },
      });

      expect(eventSpy).toHaveBeenCalledWith({
        peerId: mockPeerId,
        oldCapabilities: expect.any(Object),
        newCapabilities: expect.any(Object),
      });
    });
  });
});
