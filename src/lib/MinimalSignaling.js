import { io } from 'socket.io-client';

// Simplified signaling protocol
export class MinimalSignaling {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.room = null;
    this.peerId = null;
    this.eventEmitter = new EventTarget();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'], // Faster than polling alone
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        this.peerId = this.socket.id;
        console.log(`Connected with ID: ${this.peerId}`);
        resolve(this.peerId);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.setupSignalingHandlers();
    });
  }

  setupSignalingHandlers() {
    // Simplified message types
    const messageTypes = [
      'offer',
      'answer',
      'ice-candidate',
      'peer-joined',
      'peer-left',
      'room-participants'
    ];

    messageTypes.forEach(type => {
      this.socket.on(type, data => {
        console.log(`Received ${type}:`, data);
        this.emit(type, data);
      });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      this.emit('disconnected');
    });
  }

  async joinRoom(roomId) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to signaling server');
    }

    this.room = roomId;
    this.socket.emit('join-room', roomId);
    console.log(`Joining room: ${roomId}`);
  }

  sendOffer(offer) {
    if (!this.room) {
      throw new Error('Not in a room');
    }
    this.socket.emit('offer', { room: this.room, offer });
  }

  sendAnswer(answer) {
    if (!this.room) {
      throw new Error('Not in a room');
    }
    this.socket.emit('answer', { room: this.room, answer });
  }

  sendIceCandidate(candidate) {
    if (!this.room) {
      throw new Error('Not in a room');
    }
    this.socket.emit('ice-candidate', { room: this.room, candidate });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.room = null;
      this.peerId = null;
    }
  }

  emit(eventType, data) {
    this.eventEmitter.dispatchEvent(
      new CustomEvent(eventType, { detail: data })
    );
  }

  on(eventType, handler) {
    this.eventEmitter.addEventListener(eventType, event =>
      handler(event.detail)
    );
  }

  off(eventType, handler) {
    this.eventEmitter.removeEventListener(eventType, handler);
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  getCurrentRoom() {
    return this.room;
  }

  getPeerId() {
    return this.peerId;
  }
}
