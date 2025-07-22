import { useState, useEffect, useRef } from "react";
import { P2PApp } from "./lib/P2PApp.js";

function App() {
  const [p2pApp] = useState(
    () =>
      new P2PApp({
        signalingServer: "http://localhost:4000",
      })
  );

  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [currentRoom, setCurrentRoom] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [peerId, setPeerId] = useState("");

  // Track processed messages to prevent duplicates
  const processedMessages = useRef(new Set());

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Set up P2P app event listeners
    const handleConnected = (data) => {
      setConnectionStatus("connected");
      setPeerId(data.peerId);
      addSystemMessage(`Connected as ${data.peerId}`);
    };

    const handleConnectionFailed = (data) => {
      setConnectionStatus("disconnected");
      addSystemMessage(`Connection failed: ${data.error.message}`);
    };

    const handleRoomJoined = (data) => {
      setCurrentRoom(data.roomId);
      addSystemMessage(`Joined room: ${data.roomId}`);
    };

    const handlePeerReady = (data) => {
      setConnectedPeers((prev) => [
        ...prev.filter((p) => p !== data.peerId),
        data.peerId,
      ]);
      addSystemMessage(`Peer connected: ${data.peerId}`);
    };

    const handlePeerLeft = (data) => {
      setConnectedPeers((prev) => prev.filter((p) => p !== data.peerId));
      addSystemMessage(`Peer disconnected: ${data.peerId}`);
    };

    const handleMessage = (data) => {
      if (data.message.data.type === "message") {
        // Create a unique message ID for deduplication
        const messageId =
          data.message.id ||
          `${data.peerId}-${data.message.data.timestamp}-${data.message.data.content}`;

        // Check if we've already processed this message
        if (processedMessages.current.has(messageId)) {
          return;
        }

        // Mark message as processed
        processedMessages.current.add(messageId);

        // Ignore messages that originated from this peer to prevent duplicates
        const currentPeerId = p2pApp.getPeerId();

        if (data.message.data.from === currentPeerId) {
          return;
        }

        addMessage(data.message.data.content, data.peerId, "peer");
      }
    };

    const handleConnectionError = (data) => {
      addSystemMessage(
        `Connection error with ${data.peerId}: ${data.error.message}`
      );
    };

    // Add event listeners
    p2pApp.on("connected", handleConnected);
    p2pApp.on("connection-failed", handleConnectionFailed);
    p2pApp.on("room-joined", handleRoomJoined);
    p2pApp.on("peer-ready", handlePeerReady);
    p2pApp.on("peer-left", handlePeerLeft);
    p2pApp.on("message", handleMessage);
    p2pApp.on("connection-error", handleConnectionError);

    // Auto-connect on mount
    connectToServer();

    // Cleanup on unmount
    return () => {
      p2pApp.off("connected", handleConnected);
      p2pApp.off("connection-failed", handleConnectionFailed);
      p2pApp.off("room-joined", handleRoomJoined);
      p2pApp.off("peer-ready", handlePeerReady);
      p2pApp.off("peer-left", handlePeerLeft);
      p2pApp.off("message", handleMessage);
      p2pApp.off("connection-error", handleConnectionError);
    };
  }, [p2pApp]);

  const connectToServer = async () => {
    try {
      setConnectionStatus("connecting");
      await p2pApp.connect();
    } catch (error) {
      console.error("Failed to connect:", error);
      setConnectionStatus("disconnected");
    }
  };

  const addMessage = (content, sender, type = "own") => {
    const message = {
      id: Date.now() + Math.random(),
      content,
      sender,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const addSystemMessage = (content) => {
    addMessage(content, "System", "system");
  };

  const handleJoinRoom = async () => {
    if (!roomInput.trim() || !p2pApp.isConnected()) return;

    try {
      await p2pApp.joinRoom(roomInput.trim());
      setRoomInput("");
    } catch (error) {
      console.error("Failed to join room:", error);
      addSystemMessage(`Failed to join room: ${error.message}`);
    }
  };

  const handleSendMessage = async () => {
    console.log("🎯 Send message button clicked");
    console.log("📝 Message input:", messageInput);
    console.log("👥 Connected peers:", connectedPeers);

    if (!messageInput.trim()) {
      console.warn("⚠️ Empty message, not sending");
      return;
    }

    if (connectedPeers.length === 0) {
      console.warn("⚠️ No connected peers, not sending");
      return;
    }

    const message = messageInput.trim();
    setMessageInput("");

    // Add to local messages immediately
    addMessage(message, peerId, "own");

    try {
      console.log("🚀 Calling p2pApp.sendMessage...");
      const results = await p2pApp.sendMessage(message);
      console.log("📊 Send message results:", results);
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      addSystemMessage(`Failed to send message: ${error.message}`);
    }
  };

  const handleKeyPress = (e, handler) => {
    if (e.key === "Enter") {
      handler();
    }
  };

  const getStatusClass = () => {
    switch (connectionStatus) {
      case "connected":
        return "status-connected";
      case "connecting":
        return "status-connecting";
      default:
        return "status-disconnected";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return `Connected (${peerId})`;
      case "connecting":
        return "Connecting...";
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>🔗 P2P Messenger</h1>
        <div className={`connection-status ${getStatusClass()}`}>
          {getStatusText()}
        </div>
      </div>

      <div className="room-controls">
        <input
          type="text"
          placeholder="Enter room ID"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, handleJoinRoom)}
          disabled={connectionStatus !== "connected"}
        />
        <button
          onClick={handleJoinRoom}
          disabled={connectionStatus !== "connected" || !roomInput.trim()}
        >
          Join Room
        </button>
      </div>

      {currentRoom && (
        <div style={{ marginBottom: "20px", textAlign: "center" }}>
          <strong>Current Room: {currentRoom}</strong>
        </div>
      )}

      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.type}`}>
            <div>
              {message.type !== "system" && (
                <small>
                  {message.sender} - {message.timestamp}:{" "}
                </small>
              )}
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input">
        <input
          type="text"
          placeholder="Type a message..."
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyDown={(e) => handleKeyPress(e, handleSendMessage)}
        />
        <button
          onClick={handleSendMessage}
          disabled={connectedPeers.length === 0 || !messageInput.trim()}
        >
          Send
        </button>
      </div>

      <div className="peers-list">
        <h3>Connected Peers: {connectedPeers.length}</h3>
        {connectedPeers.length > 0 && (
          <div>
            {connectedPeers.map((peer) => (
              <div key={peer} className="peer-item">
                {peer}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
