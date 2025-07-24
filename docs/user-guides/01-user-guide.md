# 👥 P2P Messenger User Guide

## Getting Started

Welcome to P2P Messenger! This guide will help you understand how to use the application for direct peer-to-peer communication.

### What is P2P Messaging?

P2P (Peer-to-Peer) messaging allows you to send messages directly to other users without going through a central server. This means:
- **Faster communication**: Messages travel directly between you and your contacts
- **Privacy**: Your messages don't pass through third-party servers
- **Cost-effective**: No server costs for message delivery

## System Requirements

### Browser Compatibility
- **Chrome**: Version 56 or later ✅
- **Firefox**: Version 51 or later ✅
- **Safari**: Version 11 or later ✅
- **Edge**: Version 79 or later ✅

### Network Requirements
- **Internet connection**: Stable broadband connection recommended
- **Firewall**: May need to allow WebRTC traffic
- **NAT**: Most home routers work fine, corporate firewalls may block connections

## Step-by-Step Tutorial

### 1. Accessing the Application

1. Open your web browser
2. Navigate to the P2P Messenger URL (e.g., `http://localhost:3000`)
3. The application will automatically attempt to connect to the signaling server

### 2. Understanding the Interface

The main interface consists of:

```
┌─────────────────────────────────────────┐
│ 🔗 P2P Messenger    [Connection Status] │ ← Header
├─────────────────────────────────────────┤
│ [Room ID Input] [Join Room Button]      │ ← Room Controls
├─────────────────────────────────────────┤
│                                         │
│         Message History Area            │ ← Messages Display
│                                         │
├─────────────────────────────────────────┤
│ [Type message...] [Send Button]         │ ← Message Input
├─────────────────────────────────────────┤
│ Connected Peers: 2                      │ ← Peers List
│ • user_abc123                           │
│ • user_def456                           │
└─────────────────────────────────────────┘
```

### 3. Connection Status

The connection status indicator shows:
- **🔴 Disconnected**: Not connected to signaling server
- **🟡 Connecting...**: Attempting to connect
- **🟢 Connected (your_id)**: Successfully connected

### 4. Joining a Room

To start messaging:

1. **Wait for connection**: Ensure status shows "Connected"
2. **Enter room ID**: Type a room name in the input field (e.g., "family-chat")
3. **Click "Join Room"**: This will connect you to the room
4. **Share room ID**: Give the same room ID to people you want to chat with

**Room ID Tips:**
- Use memorable names like "study-group" or "project-team"
- Room IDs are case-sensitive
- Special characters are allowed
- No spaces (use hyphens or underscores instead)

### 5. Waiting for Peers

After joining a room:
1. You'll see "Current Room: [room-name]" displayed
2. Wait for others to join the same room
3. When someone joins, you'll see "Peer connected: [peer-id]"
4. The "Connected Peers" count will update

### 6. Sending Messages

Once peers are connected:
1. **Type your message** in the input field at the bottom
2. **Press Enter** or **click "Send"**
3. Your message appears immediately in your chat
4. Other users receive the message directly through P2P connection

**Message Features:**
- Messages show sender name and timestamp
- Your messages appear on the right (blue background)
- Others' messages appear on the left (gray background)
- System messages appear in the center (yellow background)

## Common Use Cases

### 1. Family Chat
```
Room ID: "family-dinner-planning"
Participants: Mom, Dad, Kids
Use: Coordinate family activities
```

### 2. Study Group
```
Room ID: "cs101-study-group"
Participants: Classmates
Use: Share notes and discuss assignments
```

### 3. Project Team
```
Room ID: "project-alpha-team"
Participants: Team members
Use: Quick project coordination
```

### 4. Gaming Coordination
```
Room ID: "friday-game-night"
Participants: Gaming friends
Use: Coordinate multiplayer sessions
```

## Troubleshooting

### Connection Issues

#### "Disconnected" Status
**Problem**: Can't connect to signaling server
**Solutions**:
1. Check your internet connection
2. Refresh the page
3. Verify the server is running (for local installations)
4. Check browser console for error messages

#### "No Connected Peers"
**Problem**: Joined room but no one else is there
**Solutions**:
1. Verify others are using the exact same room ID
2. Check that others have successfully connected
3. Try a different room ID
4. Ask others to refresh their browsers

#### Messages Not Sending
**Problem**: Can't send messages even with connected peers
**Solutions**:
1. Check that peers are actually connected (green status)
2. Try refreshing the page
3. Check browser console for WebRTC errors
4. Verify firewall isn't blocking WebRTC

### Browser-Specific Issues

#### Chrome
- Enable "Insecure origins treated as secure" for localhost
- Check WebRTC settings in chrome://flags

#### Firefox
- Ensure WebRTC is enabled in about:config
- Check media.peerconnection.enabled setting

#### Safari
- Enable WebRTC in Develop menu
- Check privacy settings for camera/microphone access

### Network Issues

#### Corporate Firewalls
- WebRTC may be blocked by corporate firewalls
- Contact IT department for WebRTC access
- Try using a personal device/network

#### Slow Connections
- P2P works better with stable connections
- Close other bandwidth-heavy applications
- Try connecting fewer peers simultaneously

## Privacy and Security

### What's Private
- **Direct messages**: Sent directly between peers
- **Room participation**: Only signaling server knows who's in rooms
- **Connection metadata**: Minimal data stored on signaling server

### What's Not Private
- **Room IDs**: Anyone with the room ID can join
- **Peer IDs**: Visible to other room participants
- **Message content**: Not encrypted (currently)

### Security Best Practices
1. **Use unique room IDs**: Don't use predictable names
2. **Share room IDs securely**: Use secure channels to share room information
3. **Be cautious with sensitive information**: Remember messages aren't encrypted
4. **Use trusted networks**: Avoid public WiFi for sensitive conversations

## Tips for Best Experience

### Performance Tips
1. **Stable internet**: Use wired connection when possible
2. **Close unnecessary tabs**: Reduce browser resource usage
3. **Limit participants**: Works best with 2-10 people
4. **Refresh periodically**: If experiencing issues

### Communication Tips
1. **Coordinate joining**: Have everyone join around the same time
2. **Use clear room names**: Make them easy to remember and share
3. **Be patient**: P2P connections may take a few seconds to establish
4. **Have backup communication**: Keep another way to coordinate if needed

### Room Management
1. **Create specific rooms**: Use different rooms for different topics
2. **Clean room names**: Use descriptive, professional names
3. **Time coordination**: Agree on when everyone will join
4. **Backup plans**: Have alternative communication methods ready

## Frequently Asked Questions

### Q: How many people can join one room?
A: The application supports multiple peers, but performance is best with 2-10 participants.

### Q: Are my messages saved anywhere?
A: No, messages are sent directly between peers and not stored on any server.

### Q: Can I use this on mobile?
A: Yes, the application works on mobile browsers that support WebRTC.

### Q: What happens if I refresh the page?
A: You'll need to rejoin your room and reconnect to peers.

### Q: Can I join multiple rooms at once?
A: Currently, you can only be in one room at a time.

### Q: Is there a message history?
A: Messages are only visible during your current session. No history is saved.

### Q: What if the signaling server goes down?
A: You won't be able to establish new connections, but existing P2P connections may continue working.

### Q: Can I block or report users?
A: Currently, there are no user management features. Simply leave the room to stop communication.

## Getting Help

If you encounter issues:
1. **Check this guide**: Review the troubleshooting section
2. **Browser console**: Check for error messages (F12 → Console)
3. **Try different browser**: Test with another browser
4. **Contact support**: Report issues through the project's GitHub repository

## Advanced Features

### Keyboard Shortcuts
- **Enter**: Send message
- **Ctrl+R**: Refresh page (rejoin room)
- **F12**: Open browser developer tools

### URL Parameters
You can bookmark specific rooms:
```
http://localhost:3000?room=my-room-name
```
(Note: This feature may need to be implemented)

### Browser Developer Tools
For troubleshooting, check:
- **Console tab**: Error messages
- **Network tab**: Connection issues
- **Application tab**: Local storage data
