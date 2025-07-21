// Simple WebSocket signaling server for P2P testing
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 4000 });
const rooms = new Map();

console.log('Signaling server running on ws://localhost:4000');

wss.on('connection', ws => {
  console.log('New client connected');

  ws.on('message', data => {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message.type);

      switch (message.type) {
        case 'join-room':
          handleJoinRoom(ws, message);
          break;

        case 'leave-room':
          handleLeaveRoom(ws, message);
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          handleSignalingMessage(ws, message);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleDisconnect(ws);
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

function handleJoinRoom(ws, message) {
  const { roomId } = message;

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId);
  const existingPeers = Array.from(room);

  // Add this client to the room
  ws.roomId = roomId;
  ws.peerId = generatePeerId();
  room.add(ws);

  console.log(`Peer ${ws.peerId} joined room ${roomId}`);

  // Notify existing peers about the new peer
  existingPeers.forEach(peer => {
    if (peer.readyState === 1) {
      // WebSocket.OPEN
      peer.send(
        JSON.stringify({
          type: 'peer-joined',
          peerId: ws.peerId,
          name: `Peer ${ws.peerId}`,
        })
      );
    }
  });

  // Send existing peers to the new client
  ws.send(
    JSON.stringify({
      type: 'room-peers',
      peers: existingPeers.map(peer => ({
        id: peer.peerId,
        name: `Peer ${peer.peerId}`,
      })),
    })
  );
}

function handleLeaveRoom(ws, _message) {
  if (ws.roomId && rooms.has(ws.roomId)) {
    const room = rooms.get(ws.roomId);
    room.delete(ws);

    // Notify other peers
    room.forEach(peer => {
      if (peer.readyState === 1) {
        // WebSocket.OPEN
        peer.send(
          JSON.stringify({
            type: 'peer-left',
            peerId: ws.peerId,
          })
        );
      }
    });

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(ws.roomId);
    }

    console.log(`Peer ${ws.peerId} left room ${ws.roomId}`);
    ws.roomId = null;
    ws.peerId = null;
  }
}

function handleSignalingMessage(ws, message) {
  const { targetPeerId } = message;

  if (ws.roomId && rooms.has(ws.roomId)) {
    const room = rooms.get(ws.roomId);

    // Find the target peer
    const targetPeer = Array.from(room).find(
      peer => peer.peerId === targetPeerId
    );

    if (targetPeer && targetPeer.readyState === 1) {
      // WebSocket.OPEN
      // Forward the message to the target peer
      const forwardedMessage = {
        ...message,
        senderId: ws.peerId,
      };
      delete forwardedMessage.targetPeerId;

      targetPeer.send(JSON.stringify(forwardedMessage));
      console.log(
        `Forwarded ${message.type} from ${ws.peerId} to ${targetPeerId}`
      );
    } else {
      console.log(`Target peer ${targetPeerId} not found or not connected`);
    }
  }
}

function handleDisconnect(ws) {
  if (ws.roomId && rooms.has(ws.roomId)) {
    handleLeaveRoom(ws, { roomId: ws.roomId });
  }
}

function generatePeerId() {
  return Math.random().toString(36).substring(2, 15);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down signaling server...');
  wss.close(() => {
    process.exit(0);
  });
});
