import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

// Instead of mocking everything, let's test real behavior with minimal mocking
// We'll only mock the parts that can't work in test environment (WebRTC, Socket.IO)

describe("App Component", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();

    // Reset mock implementations
    mockP2PApp.connect.mockResolvedValue("mock-peer-id");
    mockP2PApp.joinRoom.mockResolvedValue("mock-peer-id");
    mockP2PApp.sendMessage.mockResolvedValue([
      { success: true, peerId: "peer1" },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial render", () => {
    it("should render main UI elements", () => {
      render(<App />);

      expect(screen.getByText("🔗 P2P Messenger")).toBeInTheDocument();
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter room ID")).toBeInTheDocument();
      expect(screen.getByText("Join Room")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Type a message...")
      ).toBeInTheDocument();
      expect(screen.getByText("Send")).toBeInTheDocument();
    });

    it("should have correct initial state", () => {
      render(<App />);

      // Room input should be enabled but join button disabled (no room entered)
      expect(screen.getByPlaceholderText("Enter room ID")).toBeDisabled();
      expect(screen.getByText("Join Room")).toBeDisabled();

      // Send button should be disabled (no peers)
      expect(screen.getByText("Send")).toBeDisabled();
    });

    it("should attempt to connect on mount", () => {
      render(<App />);

      expect(mockP2PApp.connect).toHaveBeenCalled();
    });
  });

  describe("connection status", () => {
    it("should show connecting status", async () => {
      // Make connect hang to simulate connecting state
      mockP2PApp.connect.mockImplementation(() => new Promise(() => {}));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Connecting...")).toBeInTheDocument();
      });
    });

    it("should show connected status after successful connection", async () => {
      render(<App />);

      // Simulate successful connection
      const connectHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "connected"
      )[1];
      connectHandler({ peerId: "mock-peer-id" });

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });

      // Room input should be enabled
      expect(screen.getByPlaceholderText("Enter room ID")).not.toBeDisabled();
    });

    it("should show error status on connection failure", async () => {
      render(<App />);

      // Simulate connection failure
      const errorHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "connection-failed"
      )[1];
      errorHandler({ error: new Error("Connection failed") });

      await waitFor(() => {
        expect(screen.getByText("Connection Error")).toBeInTheDocument();
      });
    });
  });

  describe("room management", () => {
    beforeEach(async () => {
      render(<App />);

      // Simulate successful connection
      const connectHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "connected"
      )[1];
      connectHandler({ peerId: "mock-peer-id" });

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("should enable join button when room ID is entered", async () => {
      const roomInput = screen.getByPlaceholderText("Enter room ID");
      const joinButton = screen.getByText("Join Room");

      expect(joinButton).toBeDisabled();

      await user.type(roomInput, "test-room");

      expect(joinButton).not.toBeDisabled();
    });

    it("should join room when button clicked", async () => {
      const roomInput = screen.getByPlaceholderText("Enter room ID");
      const joinButton = screen.getByText("Join Room");

      await user.type(roomInput, "test-room");
      await user.click(joinButton);

      expect(mockP2PApp.joinRoom).toHaveBeenCalledWith("test-room");
    });

    it("should join room when Enter key pressed", async () => {
      const roomInput = screen.getByPlaceholderText("Enter room ID");

      await user.type(roomInput, "test-room");
      await user.keyboard("{Enter}");

      expect(mockP2PApp.joinRoom).toHaveBeenCalledWith("test-room");
    });

    it("should display current room after joining", async () => {
      const roomInput = screen.getByPlaceholderText("Enter room ID");

      await user.type(roomInput, "test-room");
      await user.keyboard("{Enter}");

      // Simulate room joined event
      const roomJoinedHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "room-joined"
      )[1];
      roomJoinedHandler({ roomId: "test-room" });

      await waitFor(() => {
        expect(screen.getByText("Current Room: test-room")).toBeInTheDocument();
      });
    });

    it("should clear room input after joining", async () => {
      const roomInput = screen.getByPlaceholderText("Enter room ID");

      await user.type(roomInput, "test-room");
      await user.keyboard("{Enter}");

      // Simulate room joined event
      const roomJoinedHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "room-joined"
      )[1];
      roomJoinedHandler({ roomId: "test-room" });

      await waitFor(() => {
        expect(roomInput.value).toBe("");
      });
    });
  });

  describe("peer management", () => {
    beforeEach(async () => {
      render(<App />);

      // Simulate successful connection and room join
      const connectHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "connected"
      )[1];
      connectHandler({ peerId: "mock-peer-id" });

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("should display connected peers count", async () => {
      // Simulate peer ready event
      const peerReadyHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "peer-ready"
      )[1];
      peerReadyHandler({ peerId: "peer1" });

      await waitFor(() => {
        expect(screen.getByText("Connected Peers: 1")).toBeInTheDocument();
      });
    });

    it("should enable send button when peers are connected", async () => {
      const sendButton = screen.getByText("Send");
      const messageInput = screen.getByPlaceholderText("Type a message...");

      expect(sendButton).toBeDisabled();

      // Add a message and simulate peer connection
      await user.type(messageInput, "Hello");

      const peerReadyHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "peer-ready"
      )[1];
      peerReadyHandler({ peerId: "peer1" });

      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe("messaging", () => {
    beforeEach(async () => {
      render(<App />);

      // Setup connected state with peers
      const connectHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "connected"
      )[1];
      connectHandler({ peerId: "mock-peer-id" });

      const peerReadyHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "peer-ready"
      )[1];
      peerReadyHandler({ peerId: "peer1" });

      await waitFor(() => {
        expect(screen.getByText("Connected Peers: 1")).toBeInTheDocument();
      });
    });

    it("should send message when button clicked", async () => {
      const messageInput = screen.getByPlaceholderText("Type a message...");
      const sendButton = screen.getByText("Send");

      await user.type(messageInput, "Hello, world!");
      await user.click(sendButton);

      expect(mockP2PApp.sendMessage).toHaveBeenCalledWith("Hello, world!");
    });

    it("should send message when Enter key pressed", async () => {
      const messageInput = screen.getByPlaceholderText("Type a message...");

      await user.type(messageInput, "Hello, world!");
      await user.keyboard("{Enter}");

      expect(mockP2PApp.sendMessage).toHaveBeenCalledWith("Hello, world!");
    });

    it("should clear message input after sending", async () => {
      const messageInput = screen.getByPlaceholderText("Type a message...");

      await user.type(messageInput, "Hello, world!");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(messageInput.value).toBe("");
      });
    });

    it("should display sent messages", async () => {
      const messageInput = screen.getByPlaceholderText("Type a message...");

      await user.type(messageInput, "Hello, world!");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Hello, world!")).toBeInTheDocument();
      });
    });

    it("should display received messages", async () => {
      // Simulate receiving a message
      const messageHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "message"
      )[1];
      messageHandler({
        peerId: "peer1",
        data: {
          type: "message",
          content: "Hello from peer!",
          timestamp: Date.now(),
          id: "msg-123",
        },
      });

      await waitFor(() => {
        expect(screen.getByText("Hello from peer!")).toBeInTheDocument();
      });
    });

    it("should not send empty messages", async () => {
      const sendButton = screen.getByText("Send");

      // Button should be disabled with empty input
      expect(sendButton).toBeDisabled();

      await user.click(sendButton);

      expect(mockP2PApp.sendMessage).not.toHaveBeenCalled();
    });

    it("should handle message send failures gracefully", async () => {
      mockP2PApp.sendMessage.mockResolvedValue([
        { success: false, error: new Error("Send failed") },
      ]);

      const messageInput = screen.getByPlaceholderText("Type a message...");

      await user.type(messageInput, "Hello, world!");
      await user.keyboard("{Enter}");

      // Should still clear input even on failure
      await waitFor(() => {
        expect(messageInput.value).toBe("");
      });
    });
  });

  describe("system messages", () => {
    beforeEach(async () => {
      render(<App />);

      const connectHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "connected"
      )[1];
      connectHandler({ peerId: "mock-peer-id" });

      await waitFor(() => {
        expect(screen.getByText("Connected")).toBeInTheDocument();
      });
    });

    it("should display peer joined messages", async () => {
      const peerJoinedHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "peer-joined"
      )[1];
      peerJoinedHandler({ peerId: "peer1" });

      await waitFor(() => {
        expect(screen.getByText("peer1 joined the room")).toBeInTheDocument();
      });
    });

    it("should display peer left messages", async () => {
      const peerLeftHandler = mockP2PApp.on.mock.calls.find(
        (call) => call[0] === "peer-left"
      )[1];
      peerLeftHandler({ peerId: "peer1" });

      await waitFor(() => {
        expect(screen.getByText("peer1 left the room")).toBeInTheDocument();
      });
    });
  });

  describe("cleanup", () => {
    it("should disconnect on unmount", () => {
      const { unmount } = render(<App />);

      unmount();

      expect(mockP2PApp.disconnect).toHaveBeenCalled();
    });
  });
});
