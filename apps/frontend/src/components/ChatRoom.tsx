import React, { useState, useEffect, useRef } from 'react';
import { useP2PStore, selectConnectedPeers } from '../stores/useP2PStore';
import { p2pService } from '../services/P2PService';
import {
  Button,
  Input,
  FileDropZone,
  FileTransferComponent,
  FileUpload,
} from './ui';
import {
  PaperAirplaneIcon,
  UserGroupIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';

interface ChatRoomProps {
  roomId: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId }) => {
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFileTransfers, setShowFileTransfers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    currentUserId,
    isConnected,
    fileTransfers,
    addNotification,
  } = useP2PStore();

  const connectedPeers = useP2PStore(selectConnectedPeers);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !isConnected) return;

    setIsLoading(true);
    try {
      p2pService.broadcastMessage(messageInput.trim());
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error notification
      addNotification({
        id: `send-message-error-${Date.now()}`,
        type: 'error',
        title: 'Message Failed',
        message:
          'Failed to send message. Please check your connection and try again.',
        timestamp: new Date(),
        autoClose: true,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleFileSelect = (file: File) => {
    if (connectedPeers.length === 0) {
      addNotification({
        id: `no-peers-${Date.now()}`,
        type: 'warning',
        title: 'No Connected Peers',
        message:
          'No connected peers to send file to. Wait for someone to join the room.',
        timestamp: new Date(),
        autoClose: true,
        duration: 5000,
      });
      return;
    }

    try {
      // For simplicity, send to the first connected peer
      // In a real app, you'd let the user choose
      const targetPeer = connectedPeers[0];
      p2pService.initiateFileTransfer(file, targetPeer.id);

      addNotification({
        id: `file-send-${Date.now()}`,
        type: 'info',
        title: 'File Transfer Started',
        message: `Sending "${file.name}" to ${targetPeer.name}`,
        timestamp: new Date(),
        autoClose: true,
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to initiate file transfer:', error);
      addNotification({
        id: `file-error-${Date.now()}`,
        type: 'error',
        title: 'File Transfer Failed',
        message: 'Failed to start file transfer. Please try again.',
        timestamp: new Date(),
        autoClose: true,
        duration: 5000,
      });
    }
  };

  const handleFileDrop = (files: File[]) => {
    if (files.length > 0) {
      handleFileSelect(files[0]); // Send first file
    }
  };

  const handleAcceptTransfer = (transferId: string) => {
    p2pService.acceptFileTransfer(transferId);
  };

  const handleRejectTransfer = (transferId: string) => {
    p2pService.rejectFileTransfer(transferId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Room: {roomId}
            </h1>
            <p className="text-sm text-gray-500">
              {connectedPeers.length} peer
              {connectedPeers.length !== 1 ? 's' : ''} connected
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {connectedPeers.length + 1} total
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <FileUpload
                onFileSelect={handleFileSelect}
                disabled={connectedPeers.length === 0}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFileTransfers(!showFileTransfers)}
              >
                <DocumentIcon className="h-5 w-5" />
                {fileTransfers.length > 0 && (
                  <span className="ml-1 bg-primary-500 text-white text-xs rounded-full px-2 py-0.5">
                    {fileTransfers.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* File Transfers Panel */}
      {showFileTransfers && (
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            File Transfers
          </h3>
          {fileTransfers.length === 0 ? (
            <p className="text-sm text-gray-500">No active file transfers</p>
          ) : (
            <div className="space-y-2">
              {fileTransfers.map(transfer => (
                <FileTransferComponent
                  key={transfer.id}
                  transfer={transfer}
                  onAccept={handleAcceptTransfer}
                  onReject={handleRejectTransfer}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <FileDropZone
        onFileDrop={handleFileDrop}
        disabled={connectedPeers.length === 0}
        className="flex-1 overflow-y-auto"
      >
        <div className="p-6 space-y-4 h-full overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderId === currentUserId
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.senderId === currentUserId
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span
                      className={`text-xs ${
                        message.senderId === currentUserId
                          ? 'text-primary-200'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </span>
                    {message.senderId === currentUserId && (
                      <span
                        className={`text-xs ml-2 ${
                          message.status === 'delivered'
                            ? 'text-primary-200'
                            : message.status === 'failed'
                              ? 'text-red-300'
                              : 'text-primary-300'
                        }`}
                      >
                        {message.status === 'sending' && '⏳'}
                        {message.status === 'sent' && '✓'}
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'failed' && '✗'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </FileDropZone>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <Input
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={!isConnected || isLoading}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isConnected || isLoading}
            loading={isLoading}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-sm text-red-600 mt-2">
            Not connected to signaling server
          </p>
        )}
      </div>
    </div>
  );
};
