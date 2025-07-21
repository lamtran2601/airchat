import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import type {
  PeerInfo,
  Message,
  FileTransfer,
  Notification,
} from '../types/p2p';

// Custom render function that can be extended with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { ...options });

export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const createTestPeer = (overrides?: Partial<PeerInfo>): PeerInfo => ({
  id: `peer-${Math.random().toString(36).substring(2)}`,
  status: 'online',
  name: 'Test Peer',
  ...overrides,
});

export const createTestMessage = (overrides?: Partial<Message>): Message => ({
  id: `msg-${Math.random().toString(36).substring(2)}`,
  senderId: 'test-sender',
  content: 'Test message content',
  timestamp: new Date(),
  type: 'text',
  status: 'sent',
  ...overrides,
});

export const createTestFileTransfer = (
  overrides?: Partial<FileTransfer>
): FileTransfer => ({
  id: `transfer-${Math.random().toString(36).substring(2)}`,
  fileName: 'test-file.txt',
  fileSize: 1024,
  fileType: 'text/plain',
  senderId: 'test-sender',
  receiverId: 'test-receiver',
  status: 'pending',
  progress: 0,
  chunks: [],
  timestamp: new Date(),
  ...overrides,
});

export const createTestNotification = (
  overrides?: Partial<Notification>
): Notification => ({
  id: `notif-${Math.random().toString(36).substring(2)}`,
  type: 'info',
  title: 'Test Notification',
  message: 'Test notification message',
  timestamp: new Date(),
  autoClose: true,
  duration: 3000,
  ...overrides,
});

// Mock file creation
export const createMockFile = (
  name: string = 'test-file.txt',
  size: number = 1024,
  type: string = 'text/plain'
): File => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Wait for async operations
export const waitFor = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Mock user interactions
export const mockUserInteraction = {
  type: (element: HTMLElement, text: string) => {
    element.focus();
    (element as HTMLInputElement).value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  },

  click: (element: HTMLElement) => {
    element.click();
  },

  keyPress: (element: HTMLElement, key: string) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent('keypress', { key, bubbles: true })
    );
    element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  },

  dragAndDrop: (element: HTMLElement, files: File[]) => {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));

    element.dispatchEvent(
      new DragEvent('dragenter', { bubbles: true, dataTransfer })
    );
    element.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, dataTransfer })
    );
    element.dispatchEvent(
      new DragEvent('drop', { bubbles: true, dataTransfer })
    );
  },
};

// Store state helpers
export const createMockStoreState = () => ({
  isConnected: false,
  currentRoomId: null,
  peers: new Map(),
  connectionStates: new Map(),
  messages: [],
  fileTransfers: [],
  selectedPeerId: null,
  isConnecting: false,
  showFileTransfer: false,
  notifications: [],
  currentUserId: null,
  currentUserName: null,
});

// Mock store actions
export const createMockStoreActions = () => ({
  setConnected: vi.fn(),
  setCurrentRoomId: vi.fn(),
  addPeer: vi.fn(),
  removePeer: vi.fn(),
  updateConnectionState: vi.fn(),
  addMessage: vi.fn(),
  removeMessage: vi.fn(),
  clearMessages: vi.fn(),
  addFileTransfer: vi.fn(),
  updateFileTransfer: vi.fn(),
  removeFileTransfer: vi.fn(),
  clearFileTransfers: vi.fn(),
  setSelectedPeer: vi.fn(),
  setConnecting: vi.fn(),
  setShowFileTransfer: vi.fn(),
  addNotification: vi.fn(),
  removeNotification: vi.fn(),
  clearNotifications: vi.fn(),
  setCurrentUser: vi.fn(),
  reset: vi.fn(),
});

// Environment variable helpers
export const mockEnvVars = (vars: Record<string, string>) => {
  Object.entries(vars).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });
};

// Cleanup helpers
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
};
