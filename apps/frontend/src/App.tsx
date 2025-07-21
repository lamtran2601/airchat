import { useState } from 'react';
import { RoomJoin } from './components/RoomJoin';
import { ChatRoom } from './components/ChatRoom';
import { useP2PStore } from './stores/useP2PStore';
import { Notification } from './components/ui';

function App() {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const { notifications, removeNotification } = useP2PStore();

  const handleRoomJoined = (roomId: string) => {
    setCurrentRoom(roomId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>

      {/* Main Content */}
      {currentRoom ? (
        <div className="h-screen flex flex-col">
          <ChatRoom roomId={currentRoom} />
        </div>
      ) : (
        <RoomJoin onRoomJoined={handleRoomJoined} />
      )}
    </div>
  );
}

export default App;
