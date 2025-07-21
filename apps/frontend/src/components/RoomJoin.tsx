import React, { useState } from 'react';
import { Button, Input, Card } from './ui';
import { p2pService } from '../services/P2PService';
import { useP2PStore } from '../stores/useP2PStore';

interface RoomJoinProps {
  onRoomJoined: (roomId: string) => void;
}

export const RoomJoin: React.FC<RoomJoinProps> = ({ onRoomJoined }) => {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const { isConnected } = useP2PStore();

  const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomId(result);
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim() || !userName.trim()) {
      setError('Please enter both room ID and your name');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      // Initialize P2P service with user info
      const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      await p2pService.initialize(userId, userName.trim());

      // Join the room
      await p2pService.joinRoom(roomId.trim().toUpperCase());

      onRoomJoined(roomId.trim().toUpperCase());
    } catch (error) {
      console.error('Failed to join room:', error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (
          error.message.includes('network') ||
          error.message.includes('connect')
        ) {
          setError(
            'Network connection failed. Please check your internet connection and try again.'
          );
        } else if (error.message.includes('room')) {
          setError(
            'Failed to join room. The room may not exist or may be full.'
          );
        } else {
          setError(`Failed to join room: ${error.message}`);
        }
      } else {
        setError('Failed to join room. Please try again.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Join P2P Chat
          </h1>
          <p className="text-gray-600">
            Enter a room ID to start chatting securely with others
          </p>
        </div>

        <div className="space-y-4">
          <Input
            label="Your Name"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter your name"
            disabled={isJoining}
          />

          <div>
            <Input
              label="Room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Enter room ID"
              disabled={isJoining}
              helperText="Room IDs are case-insensitive"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={generateRoomId}
              disabled={isJoining}
              className="mt-2"
            >
              Generate Random Room ID
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleJoinRoom}
              disabled={!roomId.trim() || !userName.trim() || isJoining}
              loading={isJoining}
              className="w-full"
            >
              {isJoining ? 'Joining Room...' : 'Join Room'}
            </Button>

            {!isConnected && !isJoining && (
              <p className="text-sm text-amber-600 text-center">
                Connecting to signaling server...
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <p>• All messages are sent directly between peers</p>
            <p>• No data is stored on servers</p>
            <p>• Connections are encrypted by default</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
