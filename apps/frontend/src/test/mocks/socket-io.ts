import { vi } from 'vitest';

// Mock Socket instance
export const mockSocket = {
  id: 'mock-socket-id',
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Mock io function
export const mockIo = vi.fn(() => mockSocket);

// Mock the entire socket.io-client module
vi.mock('socket.io-client', () => ({
  io: mockIo,
  Socket: vi.fn().mockImplementation(() => mockSocket),
}));

// Helper functions for testing
export const simulateSocketEvent = (event: string, data?: any) => {
  const handler = mockSocket.on.mock.calls.find(call => call[0] === event)?.[1];
  if (handler) {
    handler(data);
  }
};

export const getSocketEventHandler = (event: string) => {
  return mockSocket.on.mock.calls.find(call => call[0] === event)?.[1];
};

// Reset socket mocks
export const resetSocketMocks = () => {
  mockSocket.on.mockClear();
  mockSocket.off.mockClear();
  mockSocket.emit.mockClear();
  mockSocket.connect.mockClear();
  mockSocket.disconnect.mockClear();
  mockSocket.removeAllListeners.mockClear();
  mockIo.mockClear();
};
