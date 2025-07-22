import "@testing-library/jest-dom";

// Mock WebRTC APIs that aren't available in jsdom
global.RTCPeerConnection = class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.connectionState = "new";
    this.iceConnectionState = "new";
    this.iceGatheringState = "new";
    this.signalingState = "stable";
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
    this.onicecandidate = null;
    this.ondatachannel = null;
    this._channels = new Map();
  }

  createOffer() {
    return Promise.resolve({
      type: "offer",
      sdp: "mock-offer-sdp",
    });
  }

  createAnswer() {
    return Promise.resolve({
      type: "answer",
      sdp: "mock-answer-sdp",
    });
  }

  setLocalDescription(description) {
    this.localDescription = description;
    return Promise.resolve();
  }

  setRemoteDescription(description) {
    this.remoteDescription = description;
    return Promise.resolve();
  }

  addIceCandidate(candidate) {
    return Promise.resolve();
  }

  createDataChannel(label, options = {}) {
    const channel = new MockRTCDataChannel(label, options);
    this._channels.set(label, channel);
    return channel;
  }

  close() {
    this.connectionState = "closed";
    this._channels.forEach((channel) => channel.close());
  }
};

class MockRTCDataChannel {
  constructor(label, options = {}) {
    this.label = label;
    this.ordered = options.ordered !== false;
    this.maxRetransmits = options.maxRetransmits;
    this.readyState = "connecting";
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  send(data) {
    if (this.readyState !== "open") {
      throw new Error("DataChannel is not open");
    }
    // Mock successful send
  }

  close() {
    this.readyState = "closed";
    if (this.onclose) {
      this.onclose();
    }
  }
}

global.RTCDataChannel = MockRTCDataChannel;

// Mock Socket.IO client
global.mockSocket = {
  connected: false,
  id: "mock-socket-id",
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock DOM methods not available in jsdom
Element.prototype.scrollIntoView = vi.fn();
