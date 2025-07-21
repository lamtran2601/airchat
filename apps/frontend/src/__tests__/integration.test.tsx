import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../test/utils/test-utils';
import App from '../App';
import { p2pService } from '../services/P2PService';
import { useP2PStore } from '../stores/useP2PStore';
import { createTestPeer, createTestMessage, createTestFileTransfer } from '../test/utils/test-utils';

// Mock the P2P service
vi.mock('../services/P2PService', () => ({
  p2pService: {
    initialize: vi.fn(),
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    sendMessage: vi.fn(),
    broadcastMessage: vi.fn(),
    initiateFileTransfer: vi.fn(),
    acceptFileTransfer: vi.fn(),
    rejectFileTransfer: vi.fn(),
    getConnectionStatus: vi.fn(),
    disconnect: vi.fn(),
  },
}));

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store state
    act(() => {
      useP2PStore.getState().reset();
    });

    // Set up default mock implementations
    vi.mocked(p2pService.initialize).mockResolvedValue();
    vi.mocked(p2pService.joinRoom).mockResolvedValue();
    vi.mocked(p2pService.getConnectionStatus).mockReturnValue(true);
    vi.mocked(p2pService.broadcastMessage).mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete User Journey', () => {
    it('handles complete room join and chat workflow', async () => {
      render(<App />);

      // Initially should show room join interface
      expect(screen.getByTestId('room-join')).toBeInTheDocument();

      // Simulate user filling out form
      const nameInput = screen.getAllByTestId('mock-input')[0];
      const roomInput = screen.getAllByTestId('mock-input')[1];
      const joinButton = screen.getByText('Join Room');

      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(roomInput, { target: { value: 'TEST123' } });

      // Join room
      fireEvent.click(joinButton);

      await waitFor(() => {
        expect(p2pService.initialize).toHaveBeenCalledWith(
          expect.stringMatching(/^user-\d+-[a-z0-9]+$/),
          'Test User'
        );
        expect(p2pService.joinRoom).toHaveBeenCalledWith('TEST123');
      });

      // Should now show chat room
      expect(screen.getByTestId('chat-room')).toBeInTheDocument();
      expect(screen.getByText('Chat Room: TEST123')).toBeInTheDocument();
    });

    it('handles peer connection and messaging workflow', async () => {
      // Start with chat room already joined
      act(() => {
        useP2PStore.getState().setCurrentUser('user-123', 'Test User');
        useP2PStore.getState().setConnected(true);
      });

      render(<App />);

      // Simulate joining room
      fireEvent.click(screen.getByText('Join Room'));

      // Simulate peer joining
      act(() => {
        const peer = createTestPeer({ id: 'peer-1', name: 'Peer 1' });
        useP2PStore.getState().addPeer(peer);
        useP2PStore.getState().updateConnectionState('peer-1', {
          status: 'connected',
          connection: null,
          dataChannel: null,
          lastActivity: new Date(),
        });
      });

      // Should show connected peer
      expect(screen.getByText('1 peers connected')).toBeInTheDocument();

      // Send a message
      const messageInput = screen.getByTestId('mock-input');
      const sendButton = screen.getByTestId('mock-button');

      fireEvent.change(messageInput, { target: { value: 'Hello everyone!' } });
      fireEvent.click(sendButton);

      expect(p2pService.broadcastMessage).toHaveBeenCalledWith('Hello everyone!');
    });

    it('handles file transfer workflow', async () => {
      // Set up connected state with peer
      act(() => {
        useP2PStore.getState().setCurrentUser('user-123', 'Test User');
        useP2PStore.getState().setConnected(true);
        
        const peer = createTestPeer({ id: 'peer-1', name: 'Peer 1' });
        useP2PStore.getState().addPeer(peer);
        useP2PStore.getState().updateConnectionState('peer-1', {
          status: 'connected',
          connection: null,
          dataChannel: null,
          lastActivity: new Date(),
        });
      });

      render(<App />);

      // Join room
      fireEvent.click(screen.getByText('Join Room'));

      // Simulate file drop
      const fileDropZone = screen.getByTestId('mock-filedropzone');
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

      fireEvent.drop(fileDropZone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      expect(p2pService.initiateFileTransfer).toHaveBeenCalledWith(mockFile, 'peer-1');
    });
  });

  describe('Store Integration', () => {
    it('updates store when messages are received', async () => {
      render(<App />);

      const message = createTestMessage({
        senderId: 'peer-1',
        content: 'Hello from peer!',
      });

      // Simulate message received
      act(() => {
        useP2PStore.getState().addMessage(message);
      });

      expect(useP2PStore.getState().messages).toContain(message);
    });

    it('updates store when peer connects', async () => {
      render(<App />);

      const peer = createTestPeer({ id: 'peer-1', name: 'New Peer' });

      // Simulate peer connection
      act(() => {
        useP2PStore.getState().addPeer(peer);
      });

      expect(useP2PStore.getState().peers.get('peer-1')).toEqual(peer);
    });

    it('updates store when file transfer is initiated', async () => {
      render(<App />);

      const transfer = createTestFileTransfer({
        fileName: 'document.pdf',
        senderId: 'user-123',
        receiverId: 'peer-1',
      });

      // Simulate file transfer initiation
      act(() => {
        useP2PStore.getState().addFileTransfer(transfer);
      });

      expect(useP2PStore.getState().fileTransfers).toContain(transfer);
    });

    it('handles notification lifecycle', async () => {
      render(<App />);

      // Add notification
      act(() => {
        useP2PStore.getState().addNotification({
          id: 'notif-1',
          type: 'success',
          title: 'Test Notification',
          message: 'Test message',
          timestamp: new Date(),
          autoClose: true,
          duration: 3000,
        });
      });

      expect(useP2PStore.getState().notifications).toHaveLength(1);

      // Remove notification
      act(() => {
        useP2PStore.getState().removeNotification('notif-1');
      });

      expect(useP2PStore.getState().notifications).toHaveLength(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('handles room join failure gracefully', async () => {
      vi.mocked(p2pService.joinRoom).mockRejectedValue(new Error('Room join failed'));

      render(<App />);

      const nameInput = screen.getAllByTestId('mock-input')[0];
      const roomInput = screen.getAllByTestId('mock-input')[1];
      const joinButton = screen.getByText('Join Room');

      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(roomInput, { target: { value: 'TEST123' } });
      fireEvent.click(joinButton);

      await waitFor(() => {
        expect(p2pService.joinRoom).toHaveBeenCalled();
      });

      // Should still be on room join screen
      expect(screen.getByTestId('room-join')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-room')).not.toBeInTheDocument();
    });

    it('handles message send failure gracefully', async () => {
      vi.mocked(p2pService.broadcastMessage).mockImplementation(() => {
        throw new Error('Send failed');
      });

      // Set up connected state
      act(() => {
        useP2PStore.getState().setCurrentUser('user-123', 'Test User');
        useP2PStore.getState().setConnected(true);
      });

      render(<App />);

      // Join room
      fireEvent.click(screen.getByText('Join Room'));

      const messageInput = screen.getByTestId('mock-input');
      const sendButton = screen.getByTestId('mock-button');

      fireEvent.change(messageInput, { target: { value: 'Test message' } });

      // Should not throw error
      expect(() => {
        fireEvent.click(sendButton);
      }).not.toThrow();
    });

    it('handles peer disconnection gracefully', async () => {
      // Set up connected state with peer
      act(() => {
        useP2PStore.getState().setCurrentUser('user-123', 'Test User');
        useP2PStore.getState().setConnected(true);
        
        const peer = createTestPeer({ id: 'peer-1', name: 'Peer 1' });
        useP2PStore.getState().addPeer(peer);
        useP2PStore.getState().updateConnectionState('peer-1', {
          status: 'connected',
          connection: null,
          dataChannel: null,
          lastActivity: new Date(),
        });
      });

      render(<App />);

      // Join room
      fireEvent.click(screen.getByText('Join Room'));

      expect(screen.getByText('1 peers connected')).toBeInTheDocument();

      // Simulate peer disconnection
      act(() => {
        useP2PStore.getState().removePeer('peer-1');
      });

      expect(screen.getByText('No peers connected')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('updates UI when new messages arrive', async () => {
      // Set up connected state
      act(() => {
        useP2PStore.getState().setCurrentUser('user-123', 'Test User');
        useP2PStore.getState().setConnected(true);
      });

      render(<App />);

      // Join room
      fireEvent.click(screen.getByText('Join Room'));

      // Initially no messages
      expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();

      // Add message
      act(() => {
        const message = createTestMessage({
          senderId: 'peer-1',
          content: 'Hello from peer!',
        });
        useP2PStore.getState().addMessage(message);
      });

      expect(screen.getByText('Hello from peer!')).toBeInTheDocument();
      expect(screen.queryByText('No messages yet. Start the conversation!')).not.toBeInTheDocument();
    });

    it('updates peer count when peers connect/disconnect', async () => {
      // Set up connected state
      act(() => {
        useP2PStore.getState().setCurrentUser('user-123', 'Test User');
        useP2PStore.getState().setConnected(true);
      });

      render(<App />);

      // Join room
      fireEvent.click(screen.getByText('Join Room'));

      expect(screen.getByText('No peers connected')).toBeInTheDocument();

      // Add first peer
      act(() => {
        const peer1 = createTestPeer({ id: 'peer-1', name: 'Peer 1' });
        useP2PStore.getState().addPeer(peer1);
        useP2PStore.getState().updateConnectionState('peer-1', {
          status: 'connected',
          connection: null,
          dataChannel: null,
          lastActivity: new Date(),
        });
      });

      expect(screen.getByText('1 peers connected')).toBeInTheDocument();

      // Add second peer
      act(() => {
        const peer2 = createTestPeer({ id: 'peer-2', name: 'Peer 2' });
        useP2PStore.getState().addPeer(peer2);
        useP2PStore.getState().updateConnectionState('peer-2', {
          status: 'connected',
          connection: null,
          dataChannel: null,
          lastActivity: new Date(),
        });
      });

      expect(screen.getByText('2 peers connected')).toBeInTheDocument();

      // Remove one peer
      act(() => {
        useP2PStore.getState().removePeer('peer-1');
      });

      expect(screen.getByText('1 peers connected')).toBeInTheDocument();
    });
  });
});
