# 🚀 P2P Chat Application

A secure, peer-to-peer chat application with real-time messaging and file transfer capabilities. Built with React, TypeScript, WebRTC, and Socket.IO.

## ✨ Features

- **🔒 Secure P2P Communication**: Direct peer-to-peer messaging with WebRTC encryption
- **💬 Real-time Chat**: Instant messaging with delivery confirmations
- **📁 File Transfer**: Drag-and-drop file sharing with progress tracking
- **🌐 No Data Storage**: Messages and files are never stored on servers
- **📱 Progressive Web App**: Installable on mobile and desktop
- **🎨 Modern UI**: Clean, responsive interface with Tailwind CSS
- **⚡ Fast & Lightweight**: Minimal server dependency after connection

## 🏗️ Architecture

### System Overview

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────┐
│   Client A  │    │ Signaling Server│    │   Client B  │
│             │◄──►│   (Socket.IO)   │◄──►│             │
│  React App  │    │                 │    │  React App  │
└─────────────┘    └─────────────────┘    └─────────────┘
       │                                           │
       │            WebRTC P2P Connection         │
       └───────────────────────────────────────────┘
              (Direct Data Transfer)
```

### Technology Stack

**Frontend:**

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Zustand for state management
- WebRTC for P2P connections

**Backend:**

- Node.js with Express
- Socket.IO for signaling
- TypeScript
- Minimal server footprint

**Development:**

- pnpm workspaces (monorepo)
- ESLint + Prettier
- Jest for testing
- GitHub Actions CI/CD

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/lamtran2601/airchat.git
   cd airchat
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start development servers**

   ```bash
   # Start both frontend and signaling server
   pnpm dev

   # Or start individually
   pnpm dev:frontend  # Frontend on http://localhost:3000
   pnpm dev:server    # Signaling server on http://localhost:4000
   ```

4. **Open the application**
   - Navigate to `http://localhost:3000`
   - Enter your name and a room ID
   - Share the room ID with others to start chatting!

## 📁 Project Structure

```
p2p-app/
├── apps/
│   ├── frontend/          # React application
│   └── signaling-server/  # Node.js signaling server
├── packages/
│   ├── p2p-core/         # Core P2P functionality
│   ├── ui-components/    # Reusable UI components
│   └── types/            # TypeScript type definitions
├── docs/                 # Documentation
└── .github/workflows/    # CI/CD pipelines
```

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev                 # Start all services
pnpm dev:frontend        # Start frontend only
pnpm dev:server         # Start signaling server only

# Building
pnpm build              # Build all packages
pnpm build:frontend     # Build frontend only
pnpm build:server       # Build server only

# Testing
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm type-check         # TypeScript type checking

# Utilities
pnpm clean              # Clean all build outputs
```

### Environment Variables

**Frontend (.env)**

```env
VITE_SIGNALING_URL=http://localhost:4000
```

**Signaling Server (.env)**

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 🚀 Deployment

### Frontend (Vercel/Netlify)

1. **Build the frontend**

   ```bash
   pnpm build:frontend
   ```

2. **Deploy to Vercel**

   ```bash
   cd apps/frontend
   vercel --prod
   ```

3. **Set environment variables**
   - `VITE_SIGNALING_URL`: Your deployed signaling server URL

### Signaling Server (Railway/DigitalOcean)

1. **Build the server**

   ```bash
   pnpm build:server
   ```

2. **Deploy to Railway**

   ```bash
   cd apps/signaling-server
   railway deploy
   ```

3. **Set environment variables**
   - `PORT`: Server port (usually auto-set)
   - `FRONTEND_URL`: Your deployed frontend URL
   - `NODE_ENV`: production

## 🔒 Security & Privacy

- **End-to-End Encryption**: All P2P data is encrypted by WebRTC's DTLS
- **No Data Storage**: Messages and files never touch the server
- **Minimal Server**: Server only facilitates initial connection
- **Room-based Access**: Simple room codes for access control
- **Ephemeral Rooms**: Rooms auto-delete when empty

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WebRTC for enabling peer-to-peer communication
- Socket.IO for reliable signaling
- The open-source community for amazing tools and libraries

## 📞 Support

If you have any questions or need help:

1. Check the [documentation](./docs/)
2. Open an [issue](https://github.com/lamtran2601/airchat/issues)
3. Join our [discussions](https://github.com/lamtran2601/airchat/discussions)

---

**Built with ❤️ for secure, private communication**
