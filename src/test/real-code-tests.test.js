import { describe, it, expect, beforeEach, vi } from "vitest";

// Test the REAL MinimalSignaling class with minimal mocking
describe("MinimalSignaling - Real Code Tests", () => {
  let MinimalSignaling;
  let mockSocket;

  beforeEach(async () => {
    // Only mock the external Socket.IO dependency, test everything else for real
    mockSocket = {
      id: "test-socket-id",
      connected: false,
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    // Mock only the io function, not the entire class
    vi.doMock("socket.io-client", () => ({
      io: vi.fn(() => mockSocket),
    }));

    // Import the REAL class
    const module = await import("../lib/MinimalSignaling.js");
    MinimalSignaling = module.MinimalSignaling;
  });

  it("should create real MinimalSignaling instance with correct properties", () => {
    const signaling = new MinimalSignaling("http://localhost:4000");

    // Test real object properties
    expect(signaling.serverUrl).toBe("http://localhost:4000");
    expect(signaling.socket).toBeNull();
    expect(signaling.room).toBeNull();
    expect(signaling.peerId).toBeNull();
    expect(signaling.eventEmitter).toBeInstanceOf(EventTarget);
  });

  it("should handle real connection flow", async () => {
    const signaling = new MinimalSignaling("http://localhost:4000");

    // Start real connection process
    const connectPromise = signaling.connect();

    // Simulate socket connection (only external part we mock)
    mockSocket.connected = true;
    const connectHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "connect"
    )[1];
    connectHandler();

    // Test real connection result
    const peerId = await connectPromise;
    expect(peerId).toBe("test-socket-id");
    expect(signaling.peerId).toBe("test-socket-id");
    expect(signaling.socket).toBe(mockSocket);
  });

  it("should test real event handling system", () => {
    const signaling = new MinimalSignaling("http://localhost:4000");
    const eventSpy = vi.fn();

    // Test real event system
    signaling.on("test-event", eventSpy);
    signaling.emit("test-event", { data: "test" });

    expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
  });

  it("should validate real room joining logic", async () => {
    const signaling = new MinimalSignaling("http://localhost:4000");

    // Setup connected state
    signaling.socket = mockSocket;
    mockSocket.connected = true;

    // Test real joinRoom method
    await signaling.joinRoom("test-room");

    expect(signaling.room).toBe("test-room");
    expect(mockSocket.emit).toHaveBeenCalledWith("join-room", "test-room");
  });

  it("should test real error handling", async () => {
    const signaling = new MinimalSignaling("http://localhost:4000");

    // Test real error when not connected
    mockSocket.connected = false;
    signaling.socket = null;

    await expect(signaling.joinRoom("test-room")).rejects.toThrow(
      "Not connected to signaling server"
    );
  });
});

// Test real P2PConnectionManager with minimal WebRTC mocking
describe("P2PConnectionManager - Real Code Tests", () => {
  let P2PConnectionManager;
  let manager;

  beforeEach(async () => {
    // Import the REAL class
    const module = await import("../lib/P2PConnectionManager.js");
    P2PConnectionManager = module.P2PConnectionManager;

    // Create real instance
    manager = new P2PConnectionManager();
  });

  it("should create real instance with correct configuration", () => {
    // Test real configuration merging
    const customManager = new P2PConnectionManager({
      iceServers: [{ urls: "stun:custom.server.com" }],
      customOption: "test",
    });

    expect(customManager.config.iceServers).toEqual([
      { urls: "stun:custom.server.com" },
    ]);
    expect(customManager.config.customOption).toBe("test");
    expect(customManager.config.bundlePolicy).toBe("max-bundle"); // Default preserved
  });

  it("should test real event system", () => {
    const eventSpy = vi.fn();

    // Test real event emitter
    manager.on("test-event", eventSpy);
    manager.emit("test-event", { peerId: "test" });

    expect(eventSpy).toHaveBeenCalledWith({ peerId: "test" });
  });

  it("should test real message ID generation", () => {
    // Test real generateMessageId method
    const id1 = manager.generateMessageId();
    const id2 = manager.generateMessageId();

    expect(typeof id1).toBe("string");
    expect(typeof id2).toBe("string");
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
  });

  it("should test real connection status tracking", () => {
    // Test real getConnectionStatus method
    const status = manager.getConnectionStatus("unknown-peer");

    expect(status).toEqual({
      connectionState: "disconnected",
      iceConnectionState: "disconnected",
      dataChannelState: "closed",
    });
  });

  it("should test real cleanup functionality", () => {
    // Add some mock connections to test real cleanup logic
    const mockConnection = { close: vi.fn() };
    const mockChannel = { close: vi.fn() };

    manager.connections.set("test-peer", mockConnection);
    manager.dataChannels.set("test-peer", mockChannel);
    manager.reconnectAttempts.set("test-peer", 2);

    // Test real cleanup method
    manager.cleanup("test-peer");

    expect(mockConnection.close).toHaveBeenCalled();
    expect(mockChannel.close).toHaveBeenCalled();
    expect(manager.connections.has("test-peer")).toBe(false);
    expect(manager.dataChannels.has("test-peer")).toBe(false);
    expect(manager.reconnectAttempts.has("test-peer")).toBe(false);
  });
});

// Test real P2PApp integration with minimal mocking
describe("P2PApp - Real Code Tests", () => {
  let P2PApp;
  let app;

  beforeEach(async () => {
    // Mock only the external dependencies
    vi.doMock("../lib/MinimalSignaling.js", () => ({
      MinimalSignaling: class MockMinimalSignaling {
        constructor(url) {
          this.serverUrl = url;
          this.peerId = "mock-peer-id"; // Set peerId immediately
          this.room = null;
          this.eventEmitter = new EventTarget();
        }
        connect() {
          this.peerId = "mock-peer-id";
          return Promise.resolve("mock-peer-id");
        }
        joinRoom(roomId) {
          this.room = roomId;
          return Promise.resolve();
        }
        isConnected() {
          return true;
        }
        getPeerId() {
          return this.peerId;
        }
        on(event, handler) {
          this.eventEmitter.addEventListener(event, (e) => handler(e.detail));
        }
        emit(event, data) {
          this.eventEmitter.dispatchEvent(
            new CustomEvent(event, { detail: data })
          );
        }
        disconnect() {}
      },
    }));

    vi.doMock("../lib/P2PConnectionManager.js", () => ({
      P2PConnectionManager: class MockP2PConnectionManager {
        constructor() {
          this.connections = new Map();
          this.eventEmitter = new EventTarget();
        }
        getConnectedPeers() {
          return ["peer1", "peer2"];
        }
        sendReliable(peerId, data) {
          return Promise.resolve("msg-123");
        }
        cleanup() {}
        on(event, handler) {
          this.eventEmitter.addEventListener(event, (e) => handler(e.detail));
        }
        emit(event, data) {
          this.eventEmitter.dispatchEvent(
            new CustomEvent(event, { detail: data })
          );
        }
      },
    }));

    // Import and test the REAL P2PApp class
    const module = await import("../lib/P2PApp.js");
    P2PApp = module.P2PApp;
    app = new P2PApp({ signalingServer: "http://localhost:4000" });
  });

  it("should create real P2PApp with correct initialization", () => {
    // Test real initialization logic
    expect(app.currentRoom).toBeNull();
    expect(app.isInitiator).toBe(false);
    expect(app.pendingConnections).toBeInstanceOf(Set);
    expect(app.eventBus).toBeInstanceOf(EventTarget);
  });

  it("should test real connection flow", async () => {
    const eventSpy = vi.fn();
    app.on("connected", eventSpy);

    // Test real connect method
    const peerId = await app.connect();

    expect(peerId).toBe("mock-peer-id");
    expect(eventSpy).toHaveBeenCalledWith({ peerId: "mock-peer-id" });
  });

  it("should test real room joining", async () => {
    await app.connect();

    const eventSpy = vi.fn();
    app.on("room-joined", eventSpy);

    // Test real joinRoom method
    const result = await app.joinRoom("test-room");

    expect(app.currentRoom).toBe("test-room");
    expect(result).toBe("mock-peer-id");
    expect(eventSpy).toHaveBeenCalledWith({ roomId: "test-room" });
  });

  it("should test real message sending logic", async () => {
    await app.connect();
    await app.joinRoom("test-room");

    // Test real sendMessage method
    const results = await app.sendMessage("Hello, world!");

    expect(results).toHaveLength(2); // Two connected peers
    expect(results[0].success).toBe(true);
    expect(results[0].peerId).toBe("peer1");
    expect(results[1].success).toBe(true);
    expect(results[1].peerId).toBe("peer2");
  });

  it("should test real event handling system", () => {
    const eventSpy = vi.fn();

    // Test real event system
    app.on("test-event", eventSpy);
    app.emit("test-event", { data: "test" });

    expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
  });
});
