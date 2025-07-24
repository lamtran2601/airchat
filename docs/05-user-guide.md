# 05 - User Guide

## 👥 How to Use P2P Messenger

### **Getting Started**

P2P Messenger is a browser-based application that enables direct peer-to-peer communication. No installation is required - simply open the application in your web browser and start connecting with others.

### **🚀 Quick Start**

#### **Step 1: Access the Application**

1. Open your web browser (Chrome, Firefox, Safari, or Edge)
2. Navigate to the application URL (e.g., `http://localhost:3000` for local development)
3. The application will automatically attempt to connect to the signaling server

#### **Step 2: Check Connection Status**

- Look for the connection status indicator at the top of the page
- **"Connected (peer-id)"**: Ready to join rooms and connect with peers (shows your peer ID)
- **"Connecting..."**: Establishing connection to server
- **"Disconnected"**: Connection failed or lost

#### **Step 3: Join a Room**

1. Enter a room ID in the "Enter room ID" field
2. Click "Join Room" or press Enter
3. Share the same room ID with others you want to connect with
4. Wait for peers to join the same room

#### **Step 4: Start Messaging**

1. Once peers are connected, you'll see them listed under "Connected Peers"
2. Type your message in the message input field
3. Click "Send" or press Enter to send the message
4. Messages appear in the chat area with timestamps and sender information

### **💬 Messaging Features**

#### **Sending Messages**

- **Text Input**: Type your message in the input field at the bottom
- **Send Methods**: Click "Send" button or press Enter key
- **Message Limits**: No character limit, but very long messages may take longer to send
- **Emoji Support**: Full Unicode emoji support 😊

#### **Message Display**

- **Your Messages**: Displayed with your peer ID and timestamp
- **Peer Messages**: Displayed with sender's peer ID and timestamp
- **System Messages**: Connection status and file transfer notifications
- **Auto-Scroll**: Chat automatically scrolls to show latest messages

#### **Message Types**

- **Regular Messages**: Standard text communication
- **System Notifications**: Connection events, file transfers, errors
- **File Transfer Status**: Progress updates for file sharing

### **📁 File Sharing**

#### **Sharing Files**

1. **Select Files**: Click the "📁 Share Files" button (disabled if no peers connected)
2. **Choose Files**: Select one or multiple files from your device
3. **Automatic Sharing**: Files are automatically shared with all connected peers
4. **Progress Tracking**: Monitor upload progress in the "File Transfers" section with progress bars

#### **Receiving Files**

1. **File Offers**: You'll see notifications when peers offer files
2. **Automatic Download**: Files are automatically received and processed
3. **Download Files**: Click "💾 Download" button to save received files
4. **File History**: All received files are listed in the "Received Files" section

#### **File Transfer Features**

- **Multiple Files**: Share multiple files simultaneously
- **Progress Tracking**: Real-time progress bars showing percentage completion
- **File Information**: File names, sizes, transfer direction (📤 outgoing, 📥 incoming), and status
- **Transfer Status**: Shows "offered", "sending", "receiving", "completed", or "error"
- **Error Handling**: Error messages displayed for failed transfers
- **Received Files Section**: All received files listed with download buttons
- **No Size Limits**: Limited only by browser memory and connection speed

### **👥 Peer Management**

#### **Connected Peers List**

The bottom section of the interface shows:

- **Peer Count**: "Connected Peers: X" showing total number
- **Your Capabilities**: Local peer role, services, max connections, and bandwidth
- **Peer Details**: Each connected peer shows:
  - Peer ID (unique identifier)
  - Connection quality indicator with color coding
  - Role (BASIC, RELAY, SUPER_PEER)
  - Available services
  - Resource information (max connections, bandwidth, etc.)

#### **Connection Quality Indicators**

- **Excellent**: High-quality connection (>80% score) - green indicator
- **Good**: Stable connection (60-80% score) - yellow indicator
- **Fair**: Moderate connection (40-60% score) - orange indicator
- **Poor**: Unstable connection (<40% score) - red indicator

#### **Peer Information Display**

For each connected peer, you can see:

- **Peer ID**: Unique identifier
- **Role**: BASIC, RELAY, or SUPER_PEER
- **Services**: Available services (messaging, file_transfer, etc.)
- **Connection Metrics**: Latency, packet loss, bandwidth
- **Capabilities**: Maximum connections and bandwidth

### **🔧 Advanced Features**

#### **Room Management**

- **Room IDs**: Can be any text string (e.g., "family-chat", "project-team")
- **Room Privacy**: Only users with the exact room ID can join
- **Multiple Rooms**: Leave current room by joining a different one
- **Room Persistence**: Rooms exist as long as users are connected

#### **Capability Management**

Your peer automatically advertises capabilities:

- **Role**: Automatically assigned based on connection quality
- **Services**: Available features (messaging, file transfer)
- **Resources**: Connection limits and bandwidth capacity
- **Performance**: Real-time quality metrics

#### **Connection Recovery**

- **Automatic Reconnection**: Attempts to reconnect if connection drops
- **Mesh Healing**: Rebuilds connections in multi-peer scenarios
- **Error Recovery**: Handles temporary network issues gracefully
- **State Preservation**: Maintains chat history during reconnections

### **🎯 Use Case Examples**

#### **Personal Messaging**

```
Scenario: Chat with family members
1. Share room ID "family-chat-2024" with family
2. Everyone joins the same room
3. Start group conversation
4. Share photos and documents directly
```

#### **Team Collaboration**

```
Scenario: Small team project coordination
1. Create room "project-alpha-team"
2. Team members join using the room ID
3. Share project files and updates
4. Real-time communication during work
```

#### **File Sharing Session**

```
Scenario: Share large files with friends
1. Create room "file-share-session"
2. Friends join the room
3. Select and share multiple files
4. Everyone receives files directly
```

#### **Study Group**

```
Scenario: Online study session
1. Create room "study-group-math"
2. Students join the room
3. Share notes and resources
4. Coordinate study activities
```

### **📱 Browser Compatibility**

#### **Recommended Browsers**

- **Chrome 56+**: Best performance and feature support
- **Firefox 51+**: Excellent compatibility
- **Safari 11+**: Good support on macOS/iOS
- **Edge 79+**: Full feature support

#### **Required Features**

- **WebRTC Support**: For peer-to-peer connections
- **WebSocket Support**: For signaling server communication
- **File API Support**: For file transfer capabilities
- **Modern JavaScript**: ES2020+ features

### **⚠️ Troubleshooting**

#### **Connection Issues**

**Problem**: Cannot connect to signaling server

- **Check**: Server is running on correct port
- **Verify**: No firewall blocking the connection
- **Try**: Refresh the page and retry

**Problem**: Peers cannot connect to each other

- **Check**: Both peers are in the same room
- **Verify**: WebRTC is supported in both browsers
- **Try**: Use different room ID or restart browsers

#### **File Transfer Issues**

**Problem**: File transfer fails or is very slow

- **Check**: File size (very large files may fail)
- **Verify**: Stable internet connection
- **Try**: Transfer smaller files or retry

**Problem**: Cannot download received files

- **Check**: Browser allows downloads
- **Verify**: Sufficient disk space
- **Try**: Right-click download link and "Save As"

#### **Performance Issues**

**Problem**: Messages are delayed or lost

- **Check**: Connection quality indicators
- **Verify**: Not too many peers connected (limit ~10-20)
- **Try**: Reduce number of connected peers

**Problem**: Application is slow or unresponsive

- **Check**: Browser memory usage
- **Verify**: Close other browser tabs
- **Try**: Refresh page and reconnect

### **🔒 Privacy and Security**

#### **Data Privacy**

- **No Server Storage**: Messages and files are not stored on servers
- **Direct Transfer**: All data flows directly between peers
- **Temporary Storage**: Files temporarily stored in browser memory only
- **No Logging**: No message or file transfer logs kept

#### **Security Considerations**

- **Encrypted Connections**: WebRTC uses DTLS encryption by default
- **Peer Discovery**: Room IDs act as simple access control
- **IP Exposure**: Peer IP addresses are shared for direct connections
- **No Authentication**: No user accounts or authentication system

#### **Best Practices**

- **Use Unique Room IDs**: Avoid predictable room names
- **Share Room IDs Securely**: Use secure channels to share room IDs
- **Verify Peers**: Confirm peer identities through other means
- **Scan Downloaded Files**: Check files for viruses before opening

### **💡 Tips and Tricks**

#### **Optimal Usage**

- **Limit Peer Count**: Keep connections under 10-20 for best performance
- **Use Descriptive Room IDs**: Make room IDs meaningful but not guessable
- **Monitor Connection Quality**: Check peer connection indicators regularly
- **Close Unused Tabs**: Free up browser resources for better performance

#### **File Transfer Tips**

- **Chunk Large Files**: Very large files transfer more reliably in smaller pieces
- **Stable Connections**: Ensure stable internet for large file transfers
- **Multiple Recipients**: Files are sent to all connected peers automatically
- **Download Promptly**: Download received files quickly to free memory

#### **Troubleshooting Tips**

- **Refresh Often**: Refresh page if experiencing issues
- **Check Console**: Open browser developer tools for error messages
- **Test with Two Tabs**: Use two browser tabs for local testing
- **Network Diagnostics**: Check network connectivity if connections fail

### **🆘 Getting Help**

If you encounter issues:

1. **Check this guide** for common solutions
2. **Review browser console** for error messages
3. **Test with different browsers** to isolate issues
4. **Check network connectivity** and firewall settings
5. **Report bugs** with detailed reproduction steps

For technical support, provide:

- Browser type and version
- Operating system
- Error messages from console
- Steps to reproduce the issue
- Network environment details
