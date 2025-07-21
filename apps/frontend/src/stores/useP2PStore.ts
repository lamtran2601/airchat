import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { P2PStore, P2PStoreState } from '../types/p2p';

// Using imported types from ../types/p2p.ts
// Local interfaces removed in favor of imported P2PStoreState, P2PStoreActions, and P2PStore

const initialState: P2PStoreState = {
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
};

export const useP2PStore = create<P2PStore>()(
  subscribeWithSelector(set => ({
    ...initialState,

    // Connection actions
    setConnected: connected => set({ isConnected: connected }),
    setConnecting: connecting => set({ isConnecting: connecting }),
    setCurrentRoomId: roomId => set({ currentRoomId: roomId }),
    setCurrentUser: (userId, userName) =>
      set({ currentUserId: userId, currentUserName: userName }),

    addPeer: peer =>
      set(state => {
        const newPeers = new Map(state.peers);
        newPeers.set(peer.id, peer);
        return { peers: newPeers };
      }),

    removePeer: peerId =>
      set(state => {
        const newPeers = new Map(state.peers);
        const newConnectionStates = new Map(state.connectionStates);
        newPeers.delete(peerId);
        newConnectionStates.delete(peerId);
        return {
          peers: newPeers,
          connectionStates: newConnectionStates,
          selectedPeerId:
            state.selectedPeerId === peerId ? null : state.selectedPeerId,
        };
      }),

    updateConnectionState: (peerId, connectionState) =>
      set(state => {
        const newConnectionStates = new Map(state.connectionStates);
        newConnectionStates.set(peerId, connectionState);
        return { connectionStates: newConnectionStates };
      }),

    // Message actions
    addMessage: message =>
      set(state => ({
        messages: [...state.messages, message].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        ),
      })),

    updateMessage: (messageId, updates) =>
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ),
      })),

    clearMessages: () => set({ messages: [] }),

    // File transfer actions
    addFileTransfer: transfer =>
      set(state => ({
        fileTransfers: [...state.fileTransfers, transfer],
      })),

    updateFileTransfer: (transferId, updates) =>
      set(state => ({
        fileTransfers: state.fileTransfers.map(transfer =>
          transfer.id === transferId ? { ...transfer, ...updates } : transfer
        ),
      })),

    removeFileTransfer: transferId =>
      set(state => ({
        fileTransfers: state.fileTransfers.filter(
          transfer => transfer.id !== transferId
        ),
      })),

    // UI actions
    setSelectedPeer: peerId => set({ selectedPeerId: peerId }),
    setShowFileTransfer: show => set({ showFileTransfer: show }),

    addNotification: notification =>
      set(state => ({
        notifications: [...state.notifications, notification],
      })),

    removeNotification: notificationId =>
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== notificationId),
      })),

    clearNotifications: () => set({ notifications: [] }),

    // Reset
    reset: () => set(initialState),
  }))
);

// Selectors
export const selectPeers = (state: P2PStore) =>
  Array.from(state.peers.values());
export const selectConnectedPeers = (state: P2PStore) =>
  Array.from(state.peers.values()).filter(
    peer => state.connectionStates.get(peer.id)?.status === 'connected'
  );
export const selectMessagesForPeer = (peerId: string) => (state: P2PStore) =>
  state.messages.filter(
    msg =>
      msg.senderId === peerId ||
      (msg.senderId === state.currentUserId && peerId === state.selectedPeerId)
  );
export const selectActiveFileTransfers = (state: P2PStore) =>
  state.fileTransfers.filter(
    transfer =>
      transfer.status === 'pending' ||
      transfer.status === 'transferring' ||
      transfer.status === 'in-progress'
  );
