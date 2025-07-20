import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            P2P Chat
          </h1>
          <p className="text-lg text-gray-600">
            Secure peer-to-peer messaging and file transfer
          </p>
        </header>
        
        <main className="max-w-4xl mx-auto">
          <div className="card text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Welcome to P2P Chat
            </h2>
            <p className="text-gray-600 mb-6">
              Connect directly with others for private messaging and file sharing.
              No servers, no data collection, just pure peer-to-peer communication.
            </p>
            <div className="space-x-4">
              <button className="btn-primary">
                Start Chat
              </button>
              <button className="btn-secondary">
                Join Room
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
