# 🔗 P2P Messenger

A minimal, cost-effective peer-to-peer messaging application built with WebRTC, React, and Node.js. Designed for direct communication between users without relying on expensive server infrastructure for message routing.

## ✨ Key Features

- **🔒 Direct P2P Communication**: Messages sent directly between peers using WebRTC
- **💰 Cost-Effective**: Minimal server costs - only signaling server required
- **🚀 Real-time Messaging**: Instant message delivery through WebRTC data channels
- **🏠 Room-based Organization**: Join rooms to connect with specific groups
- **👥 Multi-peer Support**: Connect with multiple users simultaneously
- **🌐 Browser-based**: No installation required, works in modern browsers
- **📱 Responsive Design**: Works on desktop and mobile devices

## 🛠️ Technology Stack

### Frontend

- **React 19** - Modern UI framework
- **Vite** - Fast build tool and development server
- **WebRTC** - Peer-to-peer communication
- **Socket.IO Client** - Signaling communication

### Backend

- **Node.js** - Runtime environment
- **Express** - Web server framework
- **Socket.IO** - WebSocket signaling server
- **CORS** - Cross-origin resource sharing

### Testing

- **Vitest** - Unit testing framework
- **Playwright** - End-to-end testing
- **React Testing Library** - Component testing

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm package manager
- Modern web browser with WebRTC support

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd p2p-messenger
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start the development environment**

   ```bash
   npm run dev:full
   ```

   This starts both the signaling server (port 4000) and the React app (port 3000).

4. **Open the application**
   - Navigate to `http://localhost:3000` in your browser
   - Open another browser tab/window to test P2P communication

### Alternative: Start Components Separately

**Start the signaling server:**

```bash
npm run server
```

**Start the React development server:**

```bash
npm run dev
```

## 📖 Basic Usage

1. **Connect to Server**: The app automatically connects to the signaling server
2. **Join a Room**: Enter a room ID and click "Join Room"
3. **Wait for Peers**: Other users must join the same room
4. **Start Messaging**: Once connected, send messages directly to peers

### Example Workflow

```
User A: Joins room "test123"
User B: Joins room "test123"
System: Establishes P2P connection
Users: Can now send messages directly to each other
```

## 🏗️ Project Structure

```
p2p-messenger/
├── src/                    # React frontend source
│   ├── lib/               # Core P2P libraries
│   │   ├── P2PApp.js      # Main P2P application class
│   │   ├── P2PConnectionManager.js  # WebRTC connection management
│   │   └── MinimalSignaling.js     # Signaling client
│   ├── test/              # Frontend unit tests
│   ├── App.jsx            # Main React component
│   └── main.jsx           # React entry point
├── server/                # Node.js signaling server
│   └── index.js           # Express + Socket.IO server
├── tests/                 # E2E tests
├── docs/                  # Documentation
└── package.json           # Project configuration
```

## 🧪 Testing

### Run All Tests

```bash
npm run test:all
```

### Unit Tests (Vitest)

```bash
npm run test:unit
npm run test:unit:coverage  # With coverage report
npm run test:unit:ui        # Interactive UI
```

### E2E Tests (Playwright)

```bash
npm run test
npm run test:ui             # Interactive UI
npm run test:debug          # Debug mode
```

## 📚 Documentation

**Complete documentation is available in the [docs/](docs/) directory:**

### **Quick Start Documentation**

- **[📖 Documentation Index](docs/README.md)** - Complete documentation overview
- **[🚀 Setup & Installation](docs/02-setup-installation.md)** - Get started in 5 minutes
- **[👥 User Guide](docs/05-user-guide.md)** - How to use the application

### **Technical Documentation**

- **[🏗️ Architecture Guide](docs/03-architecture-guide.md)** - System design and P2P architecture
- **[📚 API Documentation](docs/04-api-documentation.md)** - Complete API reference
- **[🛠️ Development Guide](docs/06-development-guide.md)** - Development workflows and contribution

### **Operations Documentation**

- **[🧪 Testing Guide](docs/07-testing-guide.md)** - Testing strategies and tools
- **[🚀 Deployment Guide](docs/08-deployment-guide.md)** - Production deployment

**👉 Start with the [Project Overview](docs/01-project-overview.md) for a complete introduction.**

## 🔧 Configuration

### Environment Variables

- `PORT` - Signaling server port (default: 4000)

### Browser Requirements

- WebRTC support (Chrome 56+, Firefox 51+, Safari 11+)
- WebSocket support
- Modern JavaScript (ES2020+)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [Developer Guide](docs/DEVELOPER_GUIDE.md) for detailed contribution guidelines.

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Documentation**: Check the [docs](docs/) directory for detailed guides
- **Community**: Join discussions in GitHub Discussions

## 🎯 Use Cases

Perfect for:

- **Personal messaging** between friends and family
- **Small team communication** (2-10 people)
- **File sharing** in private groups
- **Gaming coordination** for small groups
- **Remote assistance** and screen sharing
- **Educational projects** learning WebRTC

## 🔮 Roadmap

- [ ] File transfer capabilities
- [ ] Voice and video calling
- [ ] Screen sharing
- [ ] Mobile app (React Native)
- [ ] End-to-end encryption
- [ ] Persistent message history
- [ ] User authentication
- [ ] Advanced room management
