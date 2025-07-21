import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useP2PStore, selectConnectedPeers } from '../stores/useP2PStore';
import {
  createTestPeer,
  createTestMessage,
  createTestFileTransfer,
  createTestNotification,
} from '../test/utils/test-utils';

describe('useP2PStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useP2PStore.getState().reset();
    });
  });

  describe('initial state', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useP2PStore());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.peers).toEqual(new Map());
      expect(result.current.connectionStates).toEqual(new Map());
      expect(result.current.messages).toEqual([]);
      expect(result.current.fileTransfers).toEqual([]);
      expect(result.current.selectedPeerId).toBeNull();
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.showFileTransfer).toBe(false);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.currentUserId).toBeNull();
      expect(result.current.currentUserName).toBeNull();
    });
  });

  describe('connection management', () => {
    it('sets connected state', () => {
      const { result } = renderHook(() => useP2PStore());

      act(() => {
        result.current.setConnected(true);
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('sets connecting state', () => {
      const { result } = renderHook(() => useP2PStore());

      act(() => {
        result.current.setConnecting(true);
      });

      expect(result.current.isConnecting).toBe(true);
    });

    it('sets current room ID', () => {
      const { result } = renderHook(() => useP2PStore());

      act(() => {
        result.current.setCurrentRoomId('TEST123');
      });

      expect(result.current.currentRoomId).toBe('TEST123');
    });

    it('sets current user', () => {
      const { result } = renderHook(() => useP2PStore());

      act(() => {
        result.current.setCurrentUser('user-123', 'Test User');
      });

      expect(result.current.currentUserId).toBe('user-123');
      expect(result.current.currentUserName).toBe('Test User');
    });
  });

  describe('peer management', () => {
    it('adds a peer', () => {
      const { result } = renderHook(() => useP2PStore());
      const peer = createTestPeer({ id: 'peer-1', name: 'Test Peer' });

      act(() => {
        result.current.addPeer(peer);
      });

      expect(result.current.peers.get('peer-1')).toEqual(peer);
    });

    it('removes a peer', () => {
      const { result } = renderHook(() => useP2PStore());
      const peer = createTestPeer({ id: 'peer-1', name: 'Test Peer' });

      act(() => {
        result.current.addPeer(peer);
        result.current.removePeer('peer-1');
      });

      expect(result.current.peers.has('peer-1')).toBe(false);
    });

    it('updates connection state', () => {
      const { result } = renderHook(() => useP2PStore());
      const connectionState = {
        status: 'connected' as const,
        connection: null,
        dataChannel: null,
        lastActivity: new Date(),
      };

      act(() => {
        result.current.updateConnectionState('peer-1', connectionState);
      });

      expect(result.current.connectionStates.get('peer-1')).toEqual(
        connectionState
      );
    });

    it('sets selected peer', () => {
      const { result } = renderHook(() => useP2PStore());

      act(() => {
        result.current.setSelectedPeer('peer-1');
      });

      expect(result.current.selectedPeerId).toBe('peer-1');
    });
  });

  describe('message management', () => {
    it('adds a message', () => {
      const { result } = renderHook(() => useP2PStore());
      const message = createTestMessage({ content: 'Test message' });

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toContain(message);
    });

    it('updates a message', () => {
      const { result } = renderHook(() => useP2PStore());
      const message = createTestMessage({
        id: 'msg-1',
        content: 'Test message',
      });

      act(() => {
        result.current.addMessage(message);
        result.current.updateMessage('msg-1', { content: 'Updated message' });
      });

      const updatedMessage = result.current.messages.find(
        m => m.id === 'msg-1'
      );
      expect(updatedMessage?.content).toBe('Updated message');
    });

    it('clears all messages', () => {
      const { result } = renderHook(() => useP2PStore());
      const message1 = createTestMessage({ content: 'Message 1' });
      const message2 = createTestMessage({ content: 'Message 2' });

      act(() => {
        result.current.addMessage(message1);
        result.current.addMessage(message2);
        result.current.clearMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    it('maintains message order by timestamp', () => {
      const { result } = renderHook(() => useP2PStore());
      const now = new Date();
      const message1 = createTestMessage({
        id: 'msg-1',
        content: 'First message',
        timestamp: new Date(now.getTime() - 1000),
      });
      const message2 = createTestMessage({
        id: 'msg-2',
        content: 'Second message',
        timestamp: now,
      });

      act(() => {
        result.current.addMessage(message2);
        result.current.addMessage(message1);
      });

      expect(result.current.messages[0]).toEqual(message1);
      expect(result.current.messages[1]).toEqual(message2);
    });
  });

  describe('file transfer management', () => {
    it('adds a file transfer', () => {
      const { result } = renderHook(() => useP2PStore());
      const transfer = createTestFileTransfer({ fileName: 'test.txt' });

      act(() => {
        result.current.addFileTransfer(transfer);
      });

      expect(result.current.fileTransfers).toContain(transfer);
    });

    it('updates a file transfer', () => {
      const { result } = renderHook(() => useP2PStore());
      const transfer = createTestFileTransfer({
        id: 'transfer-1',
        progress: 0,
      });

      act(() => {
        result.current.addFileTransfer(transfer);
        result.current.updateFileTransfer('transfer-1', { progress: 50 });
      });

      const updatedTransfer = result.current.fileTransfers.find(
        t => t.id === 'transfer-1'
      );
      expect(updatedTransfer?.progress).toBe(50);
    });

    it('removes a file transfer', () => {
      const { result } = renderHook(() => useP2PStore());
      const transfer = createTestFileTransfer({ id: 'transfer-1' });

      act(() => {
        result.current.addFileTransfer(transfer);
        result.current.removeFileTransfer('transfer-1');
      });

      expect(result.current.fileTransfers).not.toContain(transfer);
    });

    it('removes individual file transfers', () => {
      const { result } = renderHook(() => useP2PStore());
      const transfer1 = createTestFileTransfer({
        id: 'transfer-1',
        fileName: 'file1.txt',
      });
      const transfer2 = createTestFileTransfer({
        id: 'transfer-2',
        fileName: 'file2.txt',
      });

      act(() => {
        result.current.addFileTransfer(transfer1);
        result.current.addFileTransfer(transfer2);
        result.current.removeFileTransfer('transfer-1');
      });

      expect(result.current.fileTransfers).toHaveLength(1);
      expect(result.current.fileTransfers[0].id).toBe('transfer-2');
    });

    it('toggles file transfer panel visibility', () => {
      const { result } = renderHook(() => useP2PStore());

      act(() => {
        result.current.setShowFileTransfer(true);
      });

      expect(result.current.showFileTransfer).toBe(true);

      act(() => {
        result.current.setShowFileTransfer(false);
      });

      expect(result.current.showFileTransfer).toBe(false);
    });
  });

  describe('notification management', () => {
    it('adds a notification', () => {
      const { result } = renderHook(() => useP2PStore());
      const notification = createTestNotification({
        title: 'Test Notification',
      });

      act(() => {
        result.current.addNotification(notification);
      });

      expect(result.current.notifications).toContain(notification);
    });

    it('removes a notification', () => {
      const { result } = renderHook(() => useP2PStore());
      const notification = createTestNotification({ id: 'notif-1' });

      act(() => {
        result.current.addNotification(notification);
        result.current.removeNotification('notif-1');
      });

      expect(result.current.notifications).not.toContain(notification);
    });

    it('clears all notifications', () => {
      const { result } = renderHook(() => useP2PStore());
      const notification1 = createTestNotification({ title: 'Notification 1' });
      const notification2 = createTestNotification({ title: 'Notification 2' });

      act(() => {
        result.current.addNotification(notification1);
        result.current.addNotification(notification2);
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toEqual([]);
    });

    it('handles multiple notifications', () => {
      const { result } = renderHook(() => useP2PStore());
      const notification1 = createTestNotification({
        id: 'notif-1',
        title: 'Notification 1',
      });
      const notification2 = createTestNotification({
        id: 'notif-2',
        title: 'Notification 2',
      });

      act(() => {
        result.current.addNotification(notification1);
        result.current.addNotification(notification2);
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications).toContain(notification1);
      expect(result.current.notifications).toContain(notification2);
    });
  });

  describe('reset functionality', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useP2PStore());

      // Set up some state
      act(() => {
        result.current.setConnected(true);
        result.current.setCurrentRoomId('TEST123');
        result.current.setCurrentUser('user-123', 'Test User');
        result.current.addPeer(createTestPeer());
        result.current.addMessage(createTestMessage());
        result.current.addFileTransfer(createTestFileTransfer());
        result.current.addNotification(createTestNotification());
      });

      // Verify state is set
      expect(result.current.isConnected).toBe(true);
      expect(result.current.currentRoomId).toBe('TEST123');
      expect(result.current.peers.size).toBe(1);
      expect(result.current.messages.length).toBe(1);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify reset to initial state
      expect(result.current.isConnected).toBe(false);
      expect(result.current.currentRoomId).toBeNull();
      expect(result.current.peers.size).toBe(0);
      expect(result.current.connectionStates.size).toBe(0);
      expect(result.current.messages.length).toBe(0);
      expect(result.current.fileTransfers.length).toBe(0);
      expect(result.current.notifications.length).toBe(0);
      expect(result.current.currentUserId).toBeNull();
      expect(result.current.currentUserName).toBeNull();
      expect(result.current.selectedPeerId).toBeNull();
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.showFileTransfer).toBe(false);
    });
  });

  describe('complex state interactions', () => {
    it('handles multiple peers and connection states', () => {
      const { result } = renderHook(() => useP2PStore());

      const peer1 = createTestPeer({ id: 'peer-1', name: 'Peer 1' });
      const peer2 = createTestPeer({ id: 'peer-2', name: 'Peer 2' });

      const connectionState1 = {
        status: 'connected' as const,
        connection: null,
        dataChannel: null,
        lastActivity: new Date(),
      };
      const connectionState2 = {
        status: 'connecting' as const,
        connection: null,
        dataChannel: null,
        lastActivity: new Date(),
      };

      act(() => {
        result.current.addPeer(peer1);
        result.current.addPeer(peer2);
        result.current.updateConnectionState('peer-1', connectionState1);
        result.current.updateConnectionState('peer-2', connectionState2);
      });

      expect(result.current.peers.size).toBe(2);
      expect(result.current.connectionStates.size).toBe(2);
      expect(result.current.connectionStates.get('peer-1')?.status).toBe(
        'connected'
      );
      expect(result.current.connectionStates.get('peer-2')?.status).toBe(
        'connecting'
      );
    });

    it('handles message threading and replies', () => {
      const { result } = renderHook(() => useP2PStore());

      const originalMessage = createTestMessage({
        id: 'msg-1',
        content: 'Original message',
      });

      const replyMessage = createTestMessage({
        id: 'msg-2',
        content: 'Reply message',
        replyTo: 'msg-1',
      });

      act(() => {
        result.current.addMessage(originalMessage);
        result.current.addMessage(replyMessage);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages.find(m => m.id === 'msg-2')?.replyTo).toBe(
        'msg-1'
      );
    });

    it('handles file transfer state transitions', () => {
      const { result } = renderHook(() => useP2PStore());

      const transfer = createTestFileTransfer({
        id: 'transfer-1',
        status: 'pending',
        progress: 0,
      });

      act(() => {
        result.current.addFileTransfer(transfer);
      });

      // Accept transfer
      act(() => {
        result.current.updateFileTransfer('transfer-1', { status: 'accepted' });
      });

      // Update progress
      act(() => {
        result.current.updateFileTransfer('transfer-1', { progress: 50 });
      });

      // Complete transfer
      act(() => {
        result.current.updateFileTransfer('transfer-1', {
          status: 'completed',
          progress: 100,
        });
      });

      const finalTransfer = result.current.fileTransfers.find(
        t => t.id === 'transfer-1'
      );
      expect(finalTransfer?.status).toBe('completed');
      expect(finalTransfer?.progress).toBe(100);
    });
  });
});

describe('selectConnectedPeers selector', () => {
  beforeEach(() => {
    act(() => {
      useP2PStore.getState().reset();
    });
  });

  it('returns only connected peers', () => {
    const peer1 = createTestPeer({ id: 'peer-1', status: 'connected' });
    const peer2 = createTestPeer({ id: 'peer-2', status: 'connecting' });
    const peer3 = createTestPeer({ id: 'peer-3', status: 'connected' });

    const connectionState1 = {
      status: 'connected' as const,
      connection: null,
      dataChannel: null,
      lastActivity: new Date(),
    };
    const connectionState2 = {
      status: 'connecting' as const,
      connection: null,
      dataChannel: null,
      lastActivity: new Date(),
    };
    const connectionState3 = {
      status: 'connected' as const,
      connection: null,
      dataChannel: null,
      lastActivity: new Date(),
    };

    act(() => {
      const store = useP2PStore.getState();
      store.addPeer(peer1);
      store.addPeer(peer2);
      store.addPeer(peer3);
      store.updateConnectionState('peer-1', connectionState1);
      store.updateConnectionState('peer-2', connectionState2);
      store.updateConnectionState('peer-3', connectionState3);
    });

    const connectedPeers = selectConnectedPeers(useP2PStore.getState());

    expect(connectedPeers).toHaveLength(2);
    expect(connectedPeers.map(p => p.id)).toEqual(['peer-1', 'peer-3']);
  });

  it('returns empty array when no peers are connected', () => {
    const peer1 = createTestPeer({ id: 'peer-1', status: 'connecting' });
    const connectionState1 = {
      status: 'connecting' as const,
      connection: null,
      dataChannel: null,
      lastActivity: new Date(),
    };

    act(() => {
      const store = useP2PStore.getState();
      store.addPeer(peer1);
      store.updateConnectionState('peer-1', connectionState1);
    });

    const connectedPeers = selectConnectedPeers(useP2PStore.getState());

    expect(connectedPeers).toHaveLength(0);
  });

  it('handles peers without connection states', () => {
    const peer1 = createTestPeer({ id: 'peer-1', status: 'connected' });

    act(() => {
      const store = useP2PStore.getState();
      store.addPeer(peer1);
      // Don't add connection state
    });

    const connectedPeers = selectConnectedPeers(useP2PStore.getState());

    expect(connectedPeers).toHaveLength(0);
  });
});
