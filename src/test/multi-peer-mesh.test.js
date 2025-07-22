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
  signalingState: "stable",
  iceConnectionState: "connected",
  getStats: vi.fn(() => Promise.resolve(new Map())),
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
  onsignalingstatechange: null,
  ondatachannel: null
}));

describe("Multi-Peer Mesh Connectivity", () => {
  let apps;
  let mockSockets;

  beforeEach(async () => {
    // Create 4 mock sockets with predictable IDs
    const { io } = await import("socket.io-client");
    mockSockets = [
      { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: "peer-A" },
      { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: "peer-B" },
      { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: "peer-C" },
      { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true, id: "peer-D" }
    ];

    // Mock io to return different sockets for different instances
    let callCount = 0;
    io.mockImplementation(() => {
      return mockSockets[callCount++] || mockSockets[0];
    });

    // Create 4 P2P apps
    apps = [
      new P2PApp(),
      new P2PApp(),
      new P2PApp(),
      new P2PApp()
    ];
  });

  afterEach(() => {
    apps.forEach(app => app.disconnect());
  });

  it("should use hash-based initiator selection for balanced distribution", async () => {
    const app = apps[0];
    await app.connect();

    // Test hash function consistency
    const peerA = "peer-A";
    const peerB = "peer-B";
    const peerC = "peer-C";
    const peerD = "peer-D";

    const hashA = app.hashPeerId(peerA);
    const hashB = app.hashPeerId(peerB);
    const hashC = app.hashPeerId(peerC);
    const hashD = app.hashPeerId(peerD);

    // Hashes should be consistent
    expect(app.hashPeerId(peerA)).toBe(hashA);
    expect(app.hashPeerId(peerB)).toBe(hashB);

    // Test initiator selection logic
    const shouldAInitiateToB = app.shouldInitiateConnection(peerA, peerB);
    const shouldBInitiateToA = app.shouldInitiateConnection(peerB, peerA);

    // Only one should initiate (deterministic)
    expect(shouldAInitiateToB).not.toBe(shouldBInitiateToA);

    console.log(`Hash distribution: A=${hashA}, B=${hashB}, C=${hashC}, D=${hashD}`);
    console.log(`A→B: ${shouldAInitiateToB}, B→A: ${shouldBInitiateToA}`);
  });

  it("should handle simultaneous connection attempts correctly", async () => {
    const appA = apps[0];
    const appB = apps[1];
    
    await appA.connect();
    await appB.connect();

    // Mock the signaling methods
    appA.signaling.sendOffer = vi.fn();
    appB.signaling.sendOffer = vi.fn();
    appA.signaling.sendAnswer = vi.fn();
    appB.signaling.sendAnswer = vi.fn();

    // Simulate both peers trying to connect simultaneously
    const peerAId = "peer-A";
    const peerBId = "peer-B";

    // Both peers add each other to pending connections
    appA.pendingConnections.add(peerBId);
    appB.pendingConnections.add(peerAId);

    // Simulate A receiving offer from B while A is also trying to connect to B
    const mockOffer = { type: "offer", sdp: "mock-offer" };
    
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    await appA.handleOffer(peerBId, mockOffer);

    // Check that the conflict was handled properly
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Simultaneous connection attempt detected")
    );

    consoleSpy.mockRestore();
  });

  it("should set connection timeouts for non-initiating peers", async () => {
    const app = apps[0];
    await app.connect();

    // Mock setTimeout
    const originalSetTimeout = global.setTimeout;
    const mockSetTimeout = vi.fn((callback, delay) => {
      return originalSetTimeout(callback, delay);
    });
    global.setTimeout = mockSetTimeout;

    // Simulate peer joined where this peer should NOT initiate
    const shouldInitiate = app.shouldInitiateConnection("peer-Z", "peer-A"); // Z > A in hash
    
    if (!shouldInitiate) {
      app.setConnectionTimeout("peer-A");
      
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        3000
      );
      
      expect(app.connectionTimeouts.has("peer-A")).toBe(true);
    }

    global.setTimeout = originalSetTimeout;
  });

  it("should clear timeouts when receiving offers", async () => {
    const app = apps[0];
    await app.connect();

    // Set up a timeout
    app.setConnectionTimeout("peer-B");
    expect(app.connectionTimeouts.has("peer-B")).toBe(true);

    // Mock the signaling method
    app.signaling.sendAnswer = vi.fn();

    // Simulate receiving an offer
    const mockOffer = { type: "offer", sdp: "mock-offer" };
    await app.handleOffer("peer-B", mockOffer);

    // Timeout should be cleared
    expect(app.connectionTimeouts.has("peer-B")).toBe(false);
  });

  it("should clean up timeouts on disconnect", async () => {
    const app = apps[0];
    await app.connect();

    // Set up multiple timeouts
    app.setConnectionTimeout("peer-B");
    app.setConnectionTimeout("peer-C");
    
    expect(app.connectionTimeouts.size).toBe(2);

    // Disconnect should clean up all timeouts
    app.disconnect();
    
    expect(app.connectionTimeouts.size).toBe(0);
  });

  it("should prevent duplicate connection attempts", async () => {
    const app = apps[0];
    await app.connect();

    const peerId = "peer-B";
    
    // First call should proceed
    await app.handlePeerJoined(peerId);
    expect(app.pendingConnections.has(peerId)).toBe(true);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    // Second call should be ignored
    await app.handlePeerJoined(peerId);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      `⏳ Already attempting connection to ${peerId}`
    );

    consoleSpy.mockRestore();
  });

  it("should handle connection cleanup properly", async () => {
    const app = apps[0];
    await app.connect();

    // Mock connection manager methods
    app.connectionManager.hasConnection = vi.fn().mockReturnValue(true);
    app.connectionManager.cleanup = vi.fn();

    const peerId = "peer-B";
    
    // First call - should detect existing connection
    await app.handlePeerJoined(peerId);
    
    expect(app.connectionManager.hasConnection).toHaveBeenCalledWith(peerId);
  });

  it("should validate mesh connectivity structure", () => {
    const app = apps[0];
    
    // Test the mesh validation structure (even though getAllExpectedPeers is placeholder)
    expect(typeof app.validateMeshConnectivity).toBe("function");
    expect(typeof app.startMeshValidation).toBe("function");
    expect(typeof app.stopMeshValidation).toBe("function");
    
    // Should not crash when called
    app.validateMeshConnectivity();
    app.startMeshValidation();
    app.stopMeshValidation();
  });

  it("should maintain backward compatibility with existing API", async () => {
    const app = apps[0];
    
    // All existing methods should still exist
    expect(typeof app.connect).toBe("function");
    expect(typeof app.disconnect).toBe("function");
    expect(typeof app.joinRoom).toBe("function");
    expect(typeof app.sendMessage).toBe("function");
    expect(typeof app.handlePeerJoined).toBe("function");
    expect(typeof app.handleOffer).toBe("function");
    expect(typeof app.handleAnswer).toBe("function");
    
    // New methods should be available
    expect(typeof app.shouldInitiateConnection).toBe("function");
    expect(typeof app.hashPeerId).toBe("function");
    expect(typeof app.setConnectionTimeout).toBe("function");
    expect(typeof app.initiateConnectionToPeer).toBe("function");
  });
});
