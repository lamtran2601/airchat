import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// Mock WebRTC APIs
const RTCPeerConnectionMock = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  addIceCandidate: vi.fn(),
  createDataChannel: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  signalingState: 'stable',
  localDescription: null,
  remoteDescription: null,
}));

RTCPeerConnectionMock.generateCertificate = vi.fn();
global.RTCPeerConnection = RTCPeerConnectionMock;

global.RTCDataChannel = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 'connecting',
  label: 'test-channel',
}));

global.RTCSessionDescription = vi.fn().mockImplementation(init => ({
  type: init?.type || 'offer',
  sdp: init?.sdp || 'mock-sdp',
}));

global.RTCIceCandidate = vi.fn().mockImplementation(init => ({
  candidate: init?.candidate || 'mock-candidate',
  sdpMLineIndex: init?.sdpMLineIndex || 0,
  sdpMid: init?.sdpMid || '0',
}));

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(),
    getDisplayMedia: vi.fn(),
  },
});

// Mock File API
global.File = vi.fn().mockImplementation((chunks, filename, options) => ({
  name: filename,
  size: chunks.reduce((acc: number, chunk: any) => acc + chunk.length, 0),
  type: options?.type || 'text/plain',
  lastModified: Date.now(),
  arrayBuffer: vi.fn(),
  text: vi.fn(),
  stream: vi.fn(),
  slice: vi.fn(),
}));

const FileReaderMock = vi.fn().mockImplementation(() => ({
  readAsArrayBuffer: vi.fn(),
  readAsText: vi.fn(),
  readAsDataURL: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  result: null,
  error: null,
  readyState: 0,
}));

FileReaderMock.EMPTY = 0;
FileReaderMock.LOADING = 1;
FileReaderMock.DONE = 2;
global.FileReader = FileReaderMock;

// Mock console methods to reduce noise in tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Import mocks to ensure they're loaded
import './mocks/p2p-core';
import './mocks/ui-components';
import './mocks/socket-io';
