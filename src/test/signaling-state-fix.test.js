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

// Mock WebRTC with signaling state tracking
global.RTCPeerConnection = vi.fn(() => {
  let signalingState = "stable";
  let connectionState = "new";
  
  const pc = {
    createDataChannel: vi.fn(() => ({
      addEventListener: vi.fn(),
      close: vi.fn(),
      readyState: "open",
      send: vi.fn()
    })),
    setLocalDescription: vi.fn(async (desc) => {
      if (desc.type === "offer") {
        signalingState = "have-local-offer";
      } else if (desc.type === "answer") {
        signalingState = "stable";
      }
    }),
    setRemoteDescription: vi.fn(async (desc) => {
      if (desc.type === "offer") {
        signalingState = "have-remote-offer";
      } else if (desc.type === "answer") {
        if (signalingState !== "have-local-offer") {
          throw new Error("Failed to set remote answer sdp: Called in wrong state: " + signalingState);
        }
        signalingState = "stable";
      }
    }),
    createOffer: vi.fn(() => Promise.resolve({ type: "offer", sdp: "mock-offer" })),
    createAnswer: vi.fn(() => Promise.resolve({ type: "answer", sdp: "mock-answer" })),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
    get signalingState() { return signalingState; },
    get connectionState() { return connectionState; },
    set connectionState(state) { connectionState = state; },
    iceConnectionState: "connected",
    getStats: vi.fn(() => Promise.resolve(new Map())),
    onconnectionstatechange: null,
    oniceconnectionstatechange: null,
    onsignalingstatechange: null,
    ondatachannel: null
  };
  
  return pc;
});

describe("Signaling State Fix", () => {
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

  it("should reject answer when not in have-local-offer state", async () => {
    await app1.connect();

    // Create a mock peer connection in stable state
    const mockPc = new RTCPeerConnection();
    app1.connectionManager.connections.set("peer2", mockPc);

    // Try to handle an answer when in stable state (should be ignored)
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    
    await app1.handleAnswer("peer2", { type: "answer", sdp: "mock-answer" });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Ignoring answer from peer2 - wrong signaling state: stable (expected: have-local-offer)"
    );

    consoleSpy.mockRestore();
  });

  it("should accept answer when in have-local-offer state", async () => {
    await app1.connect();

    // Create a mock peer connection and set it to have-local-offer state
    const mockPc = new RTCPeerConnection();
    await mockPc.setLocalDescription({ type: "offer", sdp: "mock-offer" });
    app1.connectionManager.connections.set("peer2", mockPc);

    // Should successfully handle the answer
    await expect(
      app1.handleAnswer("peer2", { type: "answer", sdp: "mock-answer" })
    ).resolves.not.toThrow();

    expect(mockPc.signalingState).toBe("stable");
  });

  it("should prevent duplicate connection attempts", async () => {
    await app1.connect();

    // Add peer to pending connections
    app1.pendingConnections.add("peer2");

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    // Try to handle offer for peer already being processed
    await app1.handleOffer("peer2", { type: "offer", sdp: "mock-offer" });

    expect(consoleSpy).toHaveBeenCalledWith(
      "⚠️ Already processing connection to peer2, ignoring duplicate offer"
    );

    consoleSpy.mockRestore();
  });

  it("should reuse existing stable connections", async () => {
    await app1.connect();

    // Create an existing connection
    const existingPc = new RTCPeerConnection();
    existingPc.connectionState = "connected";
    app1.connectionManager.connections.set("peer2", existingPc);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    // Try to create another connection - should reuse existing
    const result = await app1.connectionManager.createConnection("peer2", false);

    expect(result).toBe(existingPc);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Reusing existing connection to peer2"
    );

    consoleSpy.mockRestore();
  });

  it("should clean up failed connections before creating new ones", async () => {
    await app1.connect();

    // Create a failed connection
    const failedPc = new RTCPeerConnection();
    failedPc.connectionState = "failed";
    app1.connectionManager.connections.set("peer2", failedPc);

    const cleanupSpy = vi.spyOn(app1.connectionManager, "cleanup");
    
    // Create new connection - should clean up failed one first
    const result = await app1.connectionManager.createConnection("peer2", false);

    expect(cleanupSpy).toHaveBeenCalledWith("peer2");
    expect(result).not.toBe(failedPc);

    cleanupSpy.mockRestore();
  });

  it("should handle signaling state changes correctly", async () => {
    await app1.connect();

    const mockPc = new RTCPeerConnection();
    const stateChangeSpy = vi.fn();
    app1.connectionManager.on("signaling-state-change", stateChangeSpy);

    // Simulate signaling state change
    app1.connectionManager.setupConnectionEventHandlers(mockPc, "peer2");
    
    // Trigger state change
    if (mockPc.onsignalingstatechange) {
      mockPc.onsignalingstatechange();
    }

    expect(stateChangeSpy).toHaveBeenCalledWith({
      peerId: "peer2",
      state: "stable"
    });
  });

  it("should log detailed signaling state information", async () => {
    await app1.connect();

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    // Create connection and simulate offer handling
    const mockPc = new RTCPeerConnection();
    app1.connectionManager.connections.set("peer2", mockPc);

    await app1.handleOffer("peer2", { type: "offer", sdp: "mock-offer" });

    // Should log signaling state information
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Setting remote description (offer) from peer2, current state:")
    );

    consoleSpy.mockRestore();
  });
});
