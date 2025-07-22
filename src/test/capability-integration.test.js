import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { P2PApp } from "../lib/P2PApp.js";

// Mock socket.io-client
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
    id: "mock-socket-id"
  }))
}));

// Mock WebRTC
global.RTCPeerConnection = vi.fn(() => ({
  createDataChannel: vi.fn(() => ({
    addEventListener: vi.fn(),
    close: vi.fn(),
    readyState: "open",
    send: vi.fn()
  })),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  createOffer: vi.fn(() => Promise.resolve({ type: "offer", sdp: "mock-offer" })),
  createAnswer: vi.fn(() => Promise.resolve({ type: "answer", sdp: "mock-answer" })),
  addIceCandidate: vi.fn(),
  close: vi.fn(),
  connectionState: "connected",
  iceConnectionState: "connected",
  getStats: vi.fn(() => Promise.resolve(new Map()))
}));

describe("Capability Integration Test", () => {
  let app1, app2;
  let mockSocket1, mockSocket2;

  beforeEach(async () => {
    // Create mock sockets
    const { io } = await import("socket.io-client");
    mockSocket1 = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
      id: "peer1"
    };
    mockSocket2 = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
      id: "peer2"
    };

    // Mock io to return different sockets for different instances
    let callCount = 0;
    io.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockSocket1 : mockSocket2;
    });

    // Create P2P apps
    app1 = new P2PApp();
    app2 = new P2PApp();
  });

  afterEach(() => {
    if (app1) app1.disconnect();
    if (app2) app2.disconnect();
  });

  it("should exchange capabilities between peers", async () => {
    // Connect both apps
    await app1.connect();
    await app2.connect();

    // Verify capability managers are initialized
    expect(app1.capabilityManager).toBeDefined();
    expect(app2.capabilityManager).toBeDefined();

    // Get initial capabilities
    const app1Capabilities = app1.getLocalCapabilities();
    const app2Capabilities = app2.getLocalCapabilities();

    expect(app1Capabilities).toBeDefined();
    expect(app1Capabilities.peerId).toBe("peer1");
    expect(app1Capabilities.role).toBe("BASIC");
    expect(Array.from(app1Capabilities.services)).toContain("messaging");

    expect(app2Capabilities).toBeDefined();
    expect(app2Capabilities.peerId).toBe("peer2");
    expect(app2Capabilities.role).toBe("BASIC");
    expect(Array.from(app2Capabilities.services)).toContain("messaging");
  });

  it("should upgrade peer role when capabilities improve", async () => {
    await app1.connect();

    const roleChangedSpy = vi.fn();
    app1.on("role-changed", roleChangedSpy);

    // Upgrade capabilities to meet ENHANCED role requirements
    app1.updateCapabilities({
      resources: {
        maxConnections: 50,
        maxBandwidth: "50mbps",
        reliability: 0.9
      }
    });

    expect(roleChangedSpy).toHaveBeenCalledWith({
      peerId: "peer1",
      oldRole: "BASIC",
      newRole: "ENHANCED",
      capabilities: expect.any(Object)
    });

    const updatedCapabilities = app1.getLocalCapabilities();
    expect(updatedCapabilities.role).toBe("ENHANCED");
    expect(Array.from(updatedCapabilities.services)).toContain("file_sharing");
    expect(Array.from(updatedCapabilities.services)).toContain("contact_discovery");
  });

  it("should add and remove services correctly", async () => {
    await app1.connect();

    const serviceAddedSpy = vi.fn();
    const serviceRemovedSpy = vi.fn();
    app1.on("service-added", serviceAddedSpy);
    app1.on("service-removed", serviceRemovedSpy);

    // Add a service
    app1.addService("file_sharing");
    expect(app1.providesService("file_sharing")).toBe(true);
    expect(serviceAddedSpy).toHaveBeenCalledWith({
      peerId: "peer1",
      serviceType: "file_sharing",
      capabilities: expect.any(Object)
    });

    // Remove a service
    app1.removeService("file_sharing");
    expect(app1.providesService("file_sharing")).toBe(false);
    expect(serviceRemovedSpy).toHaveBeenCalledWith({
      peerId: "peer1",
      serviceType: "file_sharing",
      capabilities: expect.any(Object)
    });
  });

  it("should find service providers correctly", async () => {
    await app1.connect();
    await app2.connect();

    // Simulate app2 providing file sharing service
    const app2Capabilities = {
      peerId: "peer2",
      role: "ENHANCED",
      services: ["messaging", "file_sharing"],
      resources: {
        reliability: 0.9,
        maxBandwidth: "50mbps"
      }
    };

    // Simulate receiving remote capabilities
    app1.capabilityManager.updateRemotePeerCapabilities("peer2", app2Capabilities);

    // Find file sharing providers
    const providers = app1.findServiceProviders("file_sharing");
    expect(providers).toHaveLength(1);
    expect(providers[0].peerId).toBe("peer2");
    expect(providers[0].capabilities.role).toBe("ENHANCED");

    // Find providers with specific requirements
    const highReliabilityProviders = app1.findServiceProviders("file_sharing", {
      minReliability: 0.95
    });
    expect(highReliabilityProviders).toHaveLength(0); // 0.9 < 0.95

    const moderateReliabilityProviders = app1.findServiceProviders("file_sharing", {
      minReliability: 0.8
    });
    expect(moderateReliabilityProviders).toHaveLength(1);
  });

  it("should handle capability advertisements", async () => {
    await app1.connect();

    const capabilitiesUpdatedSpy = vi.fn();
    app1.on("remote-capabilities-updated", capabilitiesUpdatedSpy);

    // Simulate receiving a capability advertisement
    const advertisement = {
      type: "capability_advertisement",
      capabilities: {
        peerId: "peer3",
        role: "SUPER",
        services: ["messaging", "file_sharing", "signaling_relay"],
        resources: {
          maxConnections: 200,
          maxBandwidth: "100mbps",
          reliability: 0.95
        }
      }
    };

    // Simulate the message handler
    const messageHandler = app1.connectionManager.eventEmitter.addEventListener;
    const messageReceivedHandler = messageHandler.mock.calls.find(
      call => call[0] === "message-received"
    );

    if (messageReceivedHandler) {
      const handler = messageReceivedHandler[1];
      handler({
        detail: {
          peerId: "peer3",
          message: { data: advertisement }
        }
      });
    }

    // Verify the capabilities were updated
    expect(capabilitiesUpdatedSpy).toHaveBeenCalledWith({
      peerId: "peer3",
      oldCapabilities: undefined,
      newCapabilities: advertisement.capabilities
    });

    // Verify we can find the new peer
    const allCapabilities = app1.getAllRemotePeerCapabilities();
    expect(allCapabilities.has("peer3")).toBe(true);
    expect(allCapabilities.get("peer3").role).toBe("SUPER");
  });

  it("should track connection quality", async () => {
    await app1.connect();

    const qualityUpdatedSpy = vi.fn();
    app1.on("connection-quality-updated", qualityUpdatedSpy);

    // Simulate connection quality update
    const qualityData = {
      peerId: "peer2",
      quality: {
        latency: 50,
        packetLossRate: 0.01,
        availableOutgoingBitrate: 1000000,
        overallScore: 0.8
      }
    };

    // Simulate the quality update
    app1.connectionManager.emit("connection-quality-updated", qualityData);

    expect(qualityUpdatedSpy).toHaveBeenCalledWith(qualityData);

    // Verify quality can be retrieved
    const quality = app1.getConnectionQuality("peer2");
    expect(quality).toEqual(qualityData.quality);
  });

  it("should maintain backward compatibility", async () => {
    await app1.connect();

    // Verify all existing methods still work
    expect(typeof app1.connect).toBe("function");
    expect(typeof app1.disconnect).toBe("function");
    expect(typeof app1.joinRoom).toBe("function");
    expect(typeof app1.sendMessage).toBe("function");
    expect(typeof app1.getPeerId).toBe("function");
    expect(typeof app1.isConnected).toBe("function");

    // Verify new methods are available
    expect(typeof app1.getLocalCapabilities).toBe("function");
    expect(typeof app1.getAllRemotePeerCapabilities).toBe("function");
    expect(typeof app1.findServiceProviders).toBe("function");
    expect(typeof app1.addService).toBe("function");
    expect(typeof app1.removeService).toBe("function");
    expect(typeof app1.providesService).toBe("function");
    expect(typeof app1.updateCapabilities).toBe("function");
    expect(typeof app1.getConnectionQuality).toBe("function");
    expect(typeof app1.getPerformanceMetrics).toBe("function");
    expect(typeof app1.getAllConnectionQualities).toBe("function");
  });
});
