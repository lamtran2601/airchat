import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test/utils/test-utils';
import { ChatRoom } from '../components/ChatRoom';
import { p2pService } from '../services/P2PService';
import {
  createTestMessage,
  createTestPeer,
  createTestFileTransfer,
} from '../test/utils/test-utils';

// Mock the P2P service
vi.mock('../services/P2PService', () => ({
  p2pService: {
    broadcastMessage: vi.fn(),
    initiateFileTransfer: vi.fn(),
    leaveRoom: vi.fn(),
    disconnect: vi.fn(),
  },
}));

// Mock Zustand store
vi.mock('../stores/useP2PStore', () => ({
  useP2PStore: vi.fn(),
  selectConnectedPeers: vi.fn(),
}));

describe('ChatRoom Component', () => {
  const defaultStoreState = {
    messages: [],
    currentUserId: 'user-123',
    isConnected: true,
    fileTransfers: [],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { useP2PStore, selectConnectedPeers } = await vi.importMock(
      '../stores/useP2PStore'
    );
    useP2PStore.mockReturnValue(defaultStoreState);
    selectConnectedPeers.mockReturnValue([]);
  });

  it('renders chat room interface correctly', () => {
    render(<ChatRoom roomId="TEST123" />);

    expect(screen.getByText('Room: TEST123')).toBeInTheDocument();
    expect(screen.getByTestId('mock-filedropzone')).toBeInTheDocument();
    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-button')).toBeInTheDocument();
  });

  it('displays messages correctly', async () => {
    const messages = [
      createTestMessage({
        id: 'msg-1',
        senderId: 'user-123',
        content: 'My message',
      }),
      createTestMessage({
        id: 'msg-2',
        senderId: 'other-user',
        content: 'Other user message',
      }),
    ];

    const { useP2PStore } = await vi.importMock('../stores/useP2PStore');
    useP2PStore.mockReturnValue({
      ...defaultStoreState,
      messages,
    });

    render(<ChatRoom roomId="TEST123" />);

    expect(screen.getByText('My message')).toBeInTheDocument();
    expect(screen.getByText('Other user message')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<ChatRoom roomId="TEST123" />);

    expect(
      screen.getByText('No messages yet. Start the conversation!')
    ).toBeInTheDocument();
  });

  it('sends message when form is submitted', async () => {
    const mockBroadcastMessage = vi.mocked(p2pService.broadcastMessage);
    mockBroadcastMessage.mockReturnValue([]);

    render(<ChatRoom roomId="TEST123" />);

    const input = screen.getByTestId('mock-input');
    const button = screen.getByTestId('mock-button');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);

    expect(mockBroadcastMessage).toHaveBeenCalledWith('Test message');
  });

  it('sends message on Enter key press', async () => {
    const mockBroadcastMessage = vi.mocked(p2pService.broadcastMessage);
    mockBroadcastMessage.mockReturnValue([]);

    render(<ChatRoom roomId="TEST123" />);

    const input = screen.getByTestId('mock-input');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });

    expect(mockBroadcastMessage).toHaveBeenCalledWith('Test message');
  });

  it('does not send empty messages', () => {
    const mockBroadcastMessage = vi.mocked(p2pService.broadcastMessage);

    render(<ChatRoom roomId="TEST123" />);

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    expect(mockBroadcastMessage).not.toHaveBeenCalled();
  });

  it('clears input after sending message', async () => {
    const mockBroadcastMessage = vi.mocked(p2pService.broadcastMessage);
    mockBroadcastMessage.mockReturnValue([]);

    render(<ChatRoom roomId="TEST123" />);

    const input = screen.getByTestId('mock-input');
    const button = screen.getByTestId('mock-button');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);

    // Input should be cleared after sending
    expect(input).toHaveValue('');
  });

  it('displays connected peers count', async () => {
    const connectedPeers = [
      createTestPeer({ id: 'peer-1', name: 'Peer 1' }),
      createTestPeer({ id: 'peer-2', name: 'Peer 2' }),
    ];

    const { selectConnectedPeers } = await vi.importMock(
      '../stores/useP2PStore'
    );
    selectConnectedPeers.mockReturnValue(connectedPeers);

    render(<ChatRoom roomId="TEST123" />);

    expect(screen.getByText('2 peers connected')).toBeInTheDocument();
  });

  it('shows no peers message when alone', () => {
    mockSelectConnectedPeers.mockReturnValue([]);

    render(<ChatRoom roomId="TEST123" />);

    expect(screen.getByText('No peers connected')).toBeInTheDocument();
  });

  it('handles file drop for file transfer', async () => {
    const mockInitiateFileTransfer = vi.mocked(p2pService.initiateFileTransfer);
    const connectedPeers = [createTestPeer({ id: 'peer-1' })];

    mockSelectConnectedPeers.mockReturnValue(connectedPeers);

    render(<ChatRoom roomId="TEST123" />);

    const fileDropZone = screen.getByTestId('mock-filedropzone');
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

    // Simulate file drop
    fireEvent.drop(fileDropZone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    expect(mockInitiateFileTransfer).toHaveBeenCalledWith(mockFile, 'peer-1');
  });

  it('disables file drop when no peers connected', () => {
    mockSelectConnectedPeers.mockReturnValue([]);

    render(<ChatRoom roomId="TEST123" />);

    const fileDropZone = screen.getByTestId('mock-filedropzone');
    expect(fileDropZone).toHaveAttribute('disabled', 'true');
  });

  it('displays file transfers', () => {
    const fileTransfers = [
      createTestFileTransfer({
        id: 'transfer-1',
        fileName: 'test.txt',
        status: 'pending',
      }),
    ];

    mockUseP2PStore.mockReturnValue({
      ...defaultStoreState,
      fileTransfers,
    });

    render(<ChatRoom roomId="TEST123" />);

    expect(
      screen.getByTestId('mock-filetransfercomponent')
    ).toBeInTheDocument();
  });

  it('toggles file transfer panel', () => {
    render(<ChatRoom roomId="TEST123" />);

    const toggleButton = screen.getByText(/file transfers/i);
    fireEvent.click(toggleButton);

    // Should show file transfer panel
    expect(screen.getByTestId('mock-fileupload')).toBeInTheDocument();
  });

  it('handles leave room action', () => {
    const mockLeaveRoom = vi.mocked(p2pService.leaveRoom);

    render(<ChatRoom roomId="TEST123" />);

    const leaveButton = screen.getByText(/leave room/i);
    fireEvent.click(leaveButton);

    expect(mockLeaveRoom).toHaveBeenCalled();
  });

  it('shows loading state when sending message', async () => {
    const mockBroadcastMessage = vi.mocked(p2pService.broadcastMessage);
    // Make broadcastMessage take some time
    mockBroadcastMessage.mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve([]), 100));
    });

    render(<ChatRoom roomId="TEST123" />);

    const input = screen.getByTestId('mock-input');
    const button = screen.getByTestId('mock-button');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);

    // Should show loading state
    expect(button).toHaveAttribute('loading', 'true');
  });

  it('scrolls to bottom when new messages arrive', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(<ChatRoom roomId="TEST123" />);

    // Add a new message
    const newMessages = [createTestMessage({ content: 'New message' })];
    mockUseP2PStore.mockReturnValue({
      ...defaultStoreState,
      messages: newMessages,
    });

    rerender(<ChatRoom roomId="TEST123" />);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('applies correct styling for own vs other messages', () => {
    const messages = [
      createTestMessage({
        id: 'msg-1',
        senderId: 'user-123', // own message
        content: 'My message',
      }),
      createTestMessage({
        id: 'msg-2',
        senderId: 'other-user', // other's message
        content: 'Other message',
      }),
    ];

    mockUseP2PStore.mockReturnValue({
      ...defaultStoreState,
      messages,
    });

    render(<ChatRoom roomId="TEST123" />);

    // Own messages should be aligned right, others left
    const myMessage = screen.getByText('My message').closest('div');
    const otherMessage = screen.getByText('Other message').closest('div');

    expect(myMessage).toHaveClass('justify-end');
    expect(otherMessage).toHaveClass('justify-start');
  });
});
