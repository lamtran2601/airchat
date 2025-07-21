import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/utils/test-utils';
import App from '../App';

// Mock the P2P service
vi.mock('../services/P2PService', () => ({
  p2pService: {
    initialize: vi.fn(),
    joinRoom: vi.fn(),
    sendMessage: vi.fn(),
    broadcastMessage: vi.fn(),
    initiateFileTransfer: vi.fn(),
    acceptFileTransfer: vi.fn(),
    rejectFileTransfer: vi.fn(),
    getConnectionStatus: vi.fn(() => false),
    disconnect: vi.fn(),
  },
}));

// Mock Zustand store
vi.mock('../stores/useP2PStore', () => {
  const mockUseP2PStore = vi.fn();
  const mockSelectConnectedPeers = vi.fn(() => []);

  return {
    useP2PStore: mockUseP2PStore,
    selectConnectedPeers: mockSelectConnectedPeers,
  };
});

// Mock components
vi.mock('../components/RoomJoin', () => ({
  RoomJoin: vi.fn(({ onRoomJoined }) => (
    <div data-testid="room-join">
      <button onClick={() => onRoomJoined('test-room')}>Join Room</button>
    </div>
  )),
}));

vi.mock('../components/ChatRoom', () => ({
  ChatRoom: vi.fn(({ roomId }) => (
    <div data-testid="chat-room">Chat Room: {roomId}</div>
  )),
}));

describe('App Component', () => {
  beforeEach(async () => {
    const { useP2PStore } = await vi.importMock('../stores/useP2PStore');
    useP2PStore.mockReturnValue({
      notifications: [],
      removeNotification: vi.fn(),
      messages: [],
      currentUserId: null,
      isConnected: false,
      fileTransfers: [],
      peers: new Map(),
      connectionStates: new Map(),
    });
  });

  it('renders room join interface initially', () => {
    render(<App />);

    expect(screen.getByTestId('room-join')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-room')).not.toBeInTheDocument();
  });

  it('switches to chat room when room is joined', async () => {
    render(<App />);

    const joinButton = screen.getByText('Join Room');
    joinButton.click();

    expect(screen.getByTestId('chat-room')).toBeInTheDocument();
    expect(screen.getByText('Chat Room: test-room')).toBeInTheDocument();
    expect(screen.queryByTestId('room-join')).not.toBeInTheDocument();
  });

  it('displays notifications when present', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        type: 'success' as const,
        title: 'Test Notification',
        message: 'Test message',
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      },
    ];

    const { useP2PStore } = await vi.importMock('../stores/useP2PStore');
    useP2PStore.mockReturnValue({
      notifications: mockNotifications,
      removeNotification: vi.fn(),
      messages: [],
      currentUserId: null,
      isConnected: false,
      fileTransfers: [],
      peers: new Map(),
      connectionStates: new Map(),
    });

    render(<App />);

    expect(screen.getByTestId('mock-notification')).toBeInTheDocument();
  });

  it('applies correct CSS classes for layout', () => {
    const { container } = render(<App />);

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('min-h-screen', 'bg-gray-50');
  });
});
