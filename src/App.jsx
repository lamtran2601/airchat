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
  const [peerCapabilities, setPeerCapabilities] = useState(new Map());
  const [connectionQualities, setConnectionQualities] = useState(new Map());
  const [localCapabilities, setLocalCapabilities] = useState(null);

  // File transfer state
  const [fileTransfers, setFileTransfers] = useState([]); // Active file transfers
  const [receivedFiles, setReceivedFiles] = useState([]); // Completed file downloads

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

      // Get initial local capabilities (if available)
      if (p2pApp.getLocalCapabilities) {
        const capabilities = p2pApp.getLocalCapabilities();
        if (capabilities) {
          setLocalCapabilities(capabilities);
        }
      }
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

    const handleCapabilitiesUpdated = (data) => {
      setLocalCapabilities(data.newCapabilities);
    };

    const handleRemoteCapabilitiesUpdated = (data) => {
      setPeerCapabilities((prev) => {
        const updated = new Map(prev);
        updated.set(data.peerId, data.newCapabilities);
        return updated;
      });
    };

    const handleConnectionQualityUpdated = (data) => {
      setConnectionQualities((prev) => {
        const updated = new Map(prev);
        updated.set(data.peerId, data.quality);
        return updated;
      });
    };

    const handleRoleChanged = (data) => {
      addSystemMessage(
        `Your role changed from ${data.oldRole} to ${data.newRole}`
      );
    };

    // File transfer event handlers
    const handleFileOffer = (data) => {
      console.log("📥 File offer received:", data);
      addSystemMessage(
        `File offered: ${data.filename} (${formatFileSize(data.size)}) from ${
          data.peerId
        }`
      );

      // Add to file transfers list
      setFileTransfers((prev) => [
        ...prev,
        {
          ...data,
          direction: "incoming",
          status: "offered",
          progress: 0,
        },
      ]);
    };

    const handleFileProgress = (data) => {
      console.log("📊 File send progress:", data);
      setFileTransfers((prev) =>
        prev.map((transfer) =>
          transfer.fileId === data.fileId && transfer.direction === "outgoing"
            ? { ...transfer, progress: data.progress, status: "sending" }
            : transfer
        )
      );
    };

    const handleFileReceiveProgress = (data) => {
      console.log("📥 File receive progress:", data);
      setFileTransfers((prev) =>
        prev.map((transfer) =>
          transfer.fileId === data.fileId && transfer.direction === "incoming"
            ? { ...transfer, progress: data.progress, status: "receiving" }
            : transfer
        )
      );
    };

    const handleFileReceived = (data) => {
      console.log("✅ File received:", data);
      addSystemMessage(`File received: ${data.filename}`);

      // Remove from active transfers
      setFileTransfers((prev) =>
        prev.filter((transfer) => transfer.fileId !== data.fileId)
      );

      // Add to received files
      setReceivedFiles((prev) => [
        ...prev,
        {
          ...data,
          receivedAt: new Date().toLocaleTimeString(),
        },
      ]);
    };

    const handleFileError = (data) => {
      console.error("❌ File transfer error:", data);
      addSystemMessage(`File transfer error: ${data.error}`);

      // Update transfer status
      setFileTransfers((prev) =>
        prev.map((transfer) =>
          transfer.fileId === data.fileId
            ? { ...transfer, status: "error", error: data.error }
            : transfer
        )
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
    p2pApp.on("capabilities-updated", handleCapabilitiesUpdated);
    p2pApp.on("remote-capabilities-updated", handleRemoteCapabilitiesUpdated);
    p2pApp.on("connection-quality-updated", handleConnectionQualityUpdated);
    p2pApp.on("role-changed", handleRoleChanged);
    p2pApp.on("file-offer", handleFileOffer);
    p2pApp.on("file-progress", handleFileProgress);
    p2pApp.on("file-receive-progress", handleFileReceiveProgress);
    p2pApp.on("file-received", handleFileReceived);
    p2pApp.on("file-error", handleFileError);

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
      p2pApp.off("capabilities-updated", handleCapabilitiesUpdated);
      p2pApp.off(
        "remote-capabilities-updated",
        handleRemoteCapabilitiesUpdated
      );
      p2pApp.off("connection-quality-updated", handleConnectionQualityUpdated);
      p2pApp.off("role-changed", handleRoleChanged);
      p2pApp.off("file-offer", handleFileOffer);
      p2pApp.off("file-progress", handleFileProgress);
      p2pApp.off("file-receive-progress", handleFileReceiveProgress);
      p2pApp.off("file-received", handleFileReceived);
      p2pApp.off("file-error", handleFileError);
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

  // File handling functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      console.log("📁 Selected file:", file.name, file.size, "bytes");

      // Add to active transfers
      const fileId = `file_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      setFileTransfers((prev) => [
        ...prev,
        {
          fileId,
          filename: file.name,
          size: file.size,
          type: file.type,
          direction: "outgoing",
          status: "preparing",
          progress: 0,
        },
      ]);

      try {
        await p2pApp.shareFile(file);
        // Update status to completed
        setFileTransfers((prev) =>
          prev.map((transfer) =>
            transfer.filename === file.name && transfer.direction === "outgoing"
              ? { ...transfer, status: "completed", progress: 1 }
              : transfer
          )
        );
        addSystemMessage(`File sent: ${file.name}`);
      } catch (error) {
        console.error("❌ Failed to send file:", error);
        setFileTransfers((prev) =>
          prev.map((transfer) =>
            transfer.filename === file.name && transfer.direction === "outgoing"
              ? { ...transfer, status: "error", error: error.message }
              : transfer
          )
        );
        addSystemMessage(`Failed to send file: ${error.message}`);
      }
    }

    // Clear the input
    event.target.value = "";
  };

  const downloadFile = (file) => {
    const link = document.createElement("a");
    link.href = file.downloadUrl;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const getQualityClass = (score) => {
    if (score >= 0.8) return "excellent";
    if (score >= 0.6) return "good";
    if (score >= 0.4) return "fair";
    return "poor";
  };

  const getQualityText = (score) => {
    if (score >= 0.8) return "Excellent";
    if (score >= 0.6) return "Good";
    if (score >= 0.4) return "Fair";
    return "Poor";
  };

  const formatBandwidth = (bitsPerSecond) => {
    if (bitsPerSecond >= 1000000) {
      return `${(bitsPerSecond / 1000000).toFixed(1)} Mbps`;
    } else if (bitsPerSecond >= 1000) {
      return `${(bitsPerSecond / 1000).toFixed(1)} Kbps`;
    } else {
      return `${bitsPerSecond} bps`;
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

      {/* File Transfer Section */}
      <div className="file-transfer-section">
        <div className="file-input-container">
          <input
            type="file"
            id="file-input"
            multiple
            onChange={handleFileSelect}
            disabled={connectedPeers.length === 0}
            style={{ display: "none" }}
          />
          <label
            htmlFor="file-input"
            className={`file-input-label ${
              connectedPeers.length === 0 ? "disabled" : ""
            }`}
          >
            📁 Share Files
          </label>
          {connectedPeers.length === 0 && (
            <small style={{ color: "#666", marginLeft: "10px" }}>
              Connect to peers to share files
            </small>
          )}
        </div>

        {/* Active File Transfers */}
        {fileTransfers.length > 0 && (
          <div className="file-transfers">
            <h4>File Transfers</h4>
            {fileTransfers.map((transfer) => (
              <div key={transfer.fileId} className="file-transfer-item">
                <div className="file-info">
                  <span className="file-name">{transfer.filename}</span>
                  <span className="file-size">
                    ({formatFileSize(transfer.size)})
                  </span>
                  <span className={`file-status status-${transfer.status}`}>
                    {transfer.direction === "outgoing" ? "📤" : "📥"}{" "}
                    {transfer.status}
                  </span>
                </div>
                {transfer.progress > 0 && transfer.status !== "error" && (
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${transfer.progress * 100}%` }}
                    ></div>
                    <span className="progress-text">
                      {Math.round(transfer.progress * 100)}%
                    </span>
                  </div>
                )}
                {transfer.error && (
                  <div className="error-message">Error: {transfer.error}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Received Files */}
        {receivedFiles.length > 0 && (
          <div className="received-files">
            <h4>Received Files</h4>
            {receivedFiles.map((file, index) => (
              <div key={index} className="received-file-item">
                <div className="file-info">
                  <span className="file-name">{file.filename}</span>
                  <span className="file-size">
                    ({formatFileSize(file.size)})
                  </span>
                  <span className="received-time">at {file.receivedAt}</span>
                </div>
                <button
                  onClick={() => downloadFile(file)}
                  className="download-button"
                >
                  💾 Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="peers-list">
        <h3>Connected Peers: {connectedPeers.length}</h3>
        {localCapabilities && (
          <div className="local-capabilities">
            <h4>Your Capabilities</h4>
            <div className="capability-item">
              <strong>Role:</strong> {localCapabilities.role}
            </div>
            <div className="capability-item">
              <strong>Services:</strong>{" "}
              {Array.from(localCapabilities.services).join(", ")}
            </div>
            <div className="capability-item">
              <strong>Max Connections:</strong>{" "}
              {localCapabilities.resources.maxConnections}
            </div>
            <div className="capability-item">
              <strong>Bandwidth:</strong>{" "}
              {localCapabilities.resources.maxBandwidth}
            </div>
          </div>
        )}
        {connectedPeers.length > 0 && (
          <div>
            {connectedPeers.map((peer) => {
              const capabilities = peerCapabilities.get(peer);
              const quality = connectionQualities.get(peer);

              return (
                <div key={peer} className="peer-item enhanced">
                  <div className="peer-header">
                    <strong>{peer}</strong>
                    {quality && (
                      <span
                        className={`quality-indicator ${getQualityClass(
                          quality.overallScore
                        )}`}
                      >
                        {getQualityText(quality.overallScore)}
                      </span>
                    )}
                  </div>

                  {capabilities && (
                    <div className="peer-capabilities">
                      <div className="capability-row">
                        <span className="label">Role:</span>
                        <span className="value">{capabilities.role}</span>
                      </div>
                      <div className="capability-row">
                        <span className="label">Services:</span>
                        <span className="value">
                          {Array.isArray(capabilities.services)
                            ? capabilities.services.join(", ")
                            : Array.from(capabilities.services || []).join(
                                ", "
                              )}
                        </span>
                      </div>
                      {capabilities.resources && (
                        <div className="capability-row">
                          <span className="label">Bandwidth:</span>
                          <span className="value">
                            {capabilities.resources.maxBandwidth}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {quality && (
                    <div className="connection-quality">
                      <div className="quality-row">
                        <span className="label">Latency:</span>
                        <span className="value">
                          {Math.round(quality.latency)}ms
                        </span>
                      </div>
                      <div className="quality-row">
                        <span className="label">Packet Loss:</span>
                        <span className="value">
                          {(quality.packetLossRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="quality-row">
                        <span className="label">Bandwidth:</span>
                        <span className="value">
                          {formatBandwidth(quality.availableOutgoingBitrate)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
