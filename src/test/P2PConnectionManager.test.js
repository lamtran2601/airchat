import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { P2PConnectionManager } from "../lib/P2PConnectionManager.js";

describe("P2PConnectionManager", () => {
  let manager;
  let mockPeerConnection;
  let mockDataChannel;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock data channel
    mockDataChannel = {
      label: "main",
      readyState: "connecting",
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    };

    // Create mock peer connection
    mockPeerConnection = {
      connectionState: "new",
      iceConnectionState: "new",
      localDescription: null,
      remoteDescription: null,
      createOffer: vi
        .fn()
        .mockResolvedValue({ type: "offer", sdp: "mock-offer" }),
      createAnswer: vi
        .fn()
        .mockResolvedValue({ type: "answer", sdp: "mock-answer" }),
      setLocalDescription: vi.fn().mockResolvedValue(),
      setRemoteDescription: vi.fn().mockResolvedValue(),
      addIceCandidate: vi.fn().mockResolvedValue(),
      createDataChannel: vi.fn().mockReturnValue(mockDataChannel),
      close: vi.fn(),
      onconnectionstatechange: null,
      oniceconnectionstatechange: null,
      onicecandidate: null,
      ondatachannel: null,
    };

    // Mock RTCPeerConnection constructor
    global.RTCPeerConnection = vi
      .fn()
      .mockImplementation(() => mockPeerConnection);

    manager = new P2PConnectionManager();
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      expect(manager.config).toEqual({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun.services.mozilla.com:3478" },
        ],
        iceCandidatePoolSize: 3,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      expect(manager.connections).toBeInstanceOf(Map);
      expect(manager.dataChannels).toBeInstanceOf(Map);
      expect(manager.eventEmitter).toBeInstanceOf(EventTarget);
    });

    it("should merge custom config", () => {
      const customConfig = {
        iceServers: [{ urls: "stun:custom.server.com:3478" }],
        customOption: "test",
      };

      const customManager = new P2PConnectionManager(customConfig);

      expect(customManager.config.iceServers).toEqual(customConfig.iceServers);
      expect(customManager.config.customOption).toBe("test");
      expect(customManager.config.bundlePolicy).toBe("max-bundle"); // Should keep defaults
    });
  });

  describe("createConnection", () => {
    it("should create connection as initiator", async () => {
      const peerId = "test-peer";

      const result = await manager.createConnection(peerId, true);

      expect(global.RTCPeerConnection).toHaveBeenCalledWith(manager.config);
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith(
        "main",
        {
          ordered: true,
          maxRetransmits: 3,
        }
      );
      expect(manager.connections.get(peerId)).toBe(mockPeerConnection);
      expect(manager.dataChannels.get(peerId)).toBe(mockDataChannel);
      expect(result).toBe(mockPeerConnection);
    });

    it("should create connection as non-initiator", async () => {
      const peerId = "test-peer";

      const result = await manager.createConnection(peerId, false);

      expect(global.RTCPeerConnection).toHaveBeenCalledWith(manager.config);
      expect(mockPeerConnection.createDataChannel).not.toHaveBeenCalled();
      expect(mockPeerConnection.ondatachannel).toBeInstanceOf(Function);
      expect(manager.connections.get(peerId)).toBe(mockPeerConnection);
      expect(result).toBe(mockPeerConnection);
    });

    it("should setup connection event handlers", async () => {
      const peerId = "test-peer";

      await manager.createConnection(peerId, true);

      expect(mockPeerConnection.onconnectionstatechange).toBeInstanceOf(
        Function
      );
      expect(mockPeerConnection.oniceconnectionstatechange).toBeInstanceOf(
        Function
      );
      expect(mockPeerConnection.onicecandidate).toBeInstanceOf(Function);
    });

    it("should handle connection state changes", async () => {
      const peerId = "test-peer";
      const eventSpy = vi.fn();
      manager.on("peer-connected", eventSpy);

      await manager.createConnection(peerId, true);

      // Simulate connection state change to 'connected'
      mockPeerConnection.connectionState = "connected";
      mockPeerConnection.onconnectionstatechange();

      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });

    it("should handle connection failure", async () => {
      const peerId = "test-peer";
      const eventSpy = vi.fn();
      manager.on("peer-failed", eventSpy);

      await manager.createConnection(peerId, true);

      // Simulate connection state change to 'failed'
      mockPeerConnection.connectionState = "failed";
      mockPeerConnection.onconnectionstatechange();

      expect(eventSpy).toHaveBeenCalledWith({ peerId });
    });
  });

  describe("data channel management", () => {
    beforeEach(async () => {
      await manager.createConnection("test-peer", true);
    });

    it("should setup data channel handlers", () => {
      expect(mockDataChannel.onopen).toBeInstanceOf(Function);
      expect(mockDataChannel.onclose).toBeInstanceOf(Function);
      expect(mockDataChannel.onmessage).toBeInstanceOf(Function);
      expect(mockDataChannel.onerror).toBeInstanceOf(Function);
    });

    it("should handle data channel open", () => {
      const eventSpy = vi.fn();
      manager.on("data-channel-open", eventSpy);

      mockDataChannel.readyState = "open";
      mockDataChannel.onopen();

      expect(eventSpy).toHaveBeenCalledWith({ peerId: "test-peer" });
    });

    it("should handle incoming messages", () => {
      const eventSpy = vi.fn();
      manager.on("message-received", eventSpy);

      const messageData = { type: "test", content: "hello" };
      const mockEvent = { data: JSON.stringify(messageData) };

      mockDataChannel.onmessage(mockEvent);

      expect(eventSpy).toHaveBeenCalledWith({
        peerId: "test-peer",
        message: messageData,
      });
    });

    it("should handle malformed messages gracefully", () => {
      const eventSpy = vi.fn();
      manager.on("message-received", eventSpy);

      const mockEvent = { data: "invalid-json" };

      expect(() => mockDataChannel.onmessage(mockEvent)).not.toThrow();
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    beforeEach(async () => {
      await manager.createConnection("test-peer", true);
      mockDataChannel.readyState = "open";
    });

    it("should send message when channel is open", async () => {
      const message = { type: "test", content: "hello" };

      const result = await manager.sendMessage("test-peer", message);

      // Check that the sent message has the expected structure
      expect(mockDataChannel.send).toHaveBeenCalledTimes(1);
      const sentData = mockDataChannel.send.mock.calls[0][0];
      const sentMessage = JSON.parse(sentData);

      expect(sentMessage).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Number),
        data: message,
      });
      expect(result).toBe(sentMessage.id);
    });

    it("should reject when peer not found", async () => {
      const message = { type: "test", content: "hello" };

      await expect(
        manager.sendMessage("unknown-peer", message)
      ).rejects.toThrow("No connection to unknown-peer");
    });

    it("should reject when channel not ready", async () => {
      mockDataChannel.readyState = "connecting";
      const message = { type: "test", content: "hello" };

      await expect(manager.sendMessage("test-peer", message)).rejects.toThrow(
        "Data channel still not open to test-peer, state: connecting"
      );
    });

    it("should handle send errors", async () => {
      mockDataChannel.send.mockImplementation(() => {
        throw new Error("Send failed");
      });
      const message = { type: "test", content: "hello" };

      await expect(manager.sendMessage("test-peer", message)).rejects.toThrow(
        "Send failed"
      );
    });
  });

  describe("getConnectedPeers", () => {
    it("should return empty array when no connections", () => {
      expect(manager.getConnectedPeers()).toEqual([]);
    });

    it("should return connected peers only", async () => {
      // Create connections
      await manager.createConnection("peer1", true);
      await manager.createConnection("peer2", true);

      // Set up connection states and data channels
      const connection1 = manager.connections.get("peer1");
      const connection2 = manager.connections.get("peer2");
      connection1.connectionState = "connected";
      connection2.connectionState = "connecting";

      // Create separate mock data channels for each peer
      const channel1 = {
        label: "main",
        readyState: "open",
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
      };
      const channel2 = {
        label: "main",
        readyState: "connecting",
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
      };

      // Override the data channels
      manager.dataChannels.set("peer1", channel1);
      manager.dataChannels.set("peer2", channel2);

      // Debug the state before calling getConnectedPeers
      console.log("Connection1 state:", connection1.connectionState);
      console.log("Connection2 state:", connection2.connectionState);
      console.log("Channel1 state:", channel1.readyState);
      console.log("Channel2 state:", channel2.readyState);
      console.log("DataChannels map size:", manager.dataChannels.size);
      console.log("Connections map size:", manager.connections.size);

      const connectedPeers = manager.getConnectedPeers();

      expect(connectedPeers).toEqual(["peer1"]);
    });
  });

  describe("cleanup", () => {
    beforeEach(async () => {
      await manager.createConnection("test-peer", true);
    });

    it("should cleanup specific peer", () => {
      manager.cleanup("test-peer");

      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(manager.connections.has("test-peer")).toBe(false);
      expect(manager.dataChannels.has("test-peer")).toBe(false);
    });

    it("should cleanup all connections when no peer specified", () => {
      manager.cleanup();

      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(manager.connections.size).toBe(0);
      expect(manager.dataChannels.size).toBe(0);
    });

    it("should handle cleanup of non-existent peer", () => {
      expect(() => manager.cleanup("unknown-peer")).not.toThrow();
    });
  });

  describe("event system", () => {
    it("should emit and handle events", () => {
      const eventSpy = vi.fn();
      manager.on("test-event", eventSpy);

      manager.emit("test-event", { data: "test" });

      expect(eventSpy).toHaveBeenCalledWith({ data: "test" });
    });

    it("should remove event listeners", () => {
      const eventSpy = vi.fn();
      manager.on("test-event", eventSpy);
      manager.off("test-event", eventSpy);

      manager.emit("test-event", { data: "test" });

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
