# 🤖 AI Assistant Guide - P2P Chat Application

This document serves as a comprehensive reference for AI assistants working on this P2P chat and file transfer application. It provides essential context, architecture overview, and development guidelines to enable effective collaboration.

## 📋 Project Overview

**Project Name**: P2P Chat & File Transfer Application  
**Repository**: https://github.com/lamtran2601/airchat.git  
**Vision**: Cost-effective, privacy-focused peer-to-peer application for real-time messaging and direct file transfers  
**Architecture**: Hybrid P2P with minimal signaling server  
**Target**: Telegram-like chat + AirDrop-style file sharing  

### Key Benefits
- 🔒 **Privacy First**: Direct P2P connections, no data stored on servers
- 💰 **Cost Effective**: ~$5/month operational costs regardless of usage
- ⚡ **Real-Time**: Sub-500ms message latency, full bandwidth file transfers
- 📱 **Cross-Platform**: Works on desktop and mobile browsers
- 🛡️ **Secure**: WebRTC DTLS encryption for all P2P data

## 🏗️ Architecture & Technology Stack

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Headless UI + Heroicons
- **P2P Communication**: WebRTC native APIs

### Backend Stack (Signaling Server)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Language**: TypeScript
- **Deployment**: Railway/DigitalOcean

### Development Tools
- **Package Manager**: pnpm workspaces (monorepo)
- **Linting**: ESLint + Prettier
- **Testing**: Vitest + React Testing Library
- **CI/CD**: GitHub Actions
- **Type Safety**: Full TypeScript coverage

## 📁 Project Structure

```
p2p-app/
├── apps/
│   ├── frontend/          # React application (main UI)
│   └── signaling-server/  # Node.js signaling server (minimal)
├── packages/
│   ├── p2p-core/         # Core P2P functionality & WebRTC logic
│   ├── ui-components/    # Reusable UI components
│   └── types/            # Shared TypeScript type definitions
├── docs/                 # Comprehensive documentation
├── tools/                # Build and development tools
└── .github/workflows/    # CI/CD pipelines
```

### Package Dependencies
- **@p2p/core**: Core P2P functionality (WebRTC, connections, messaging, file transfer)
- **@p2p/types**: Shared TypeScript types across all packages
- **@p2p/ui**: Reusable UI components with Tailwind CSS
- **frontend**: Main React application consuming all packages
- **signaling-server**: Minimal server for WebRTC signaling only

## 🔧 Key Components & Features

### Core P2P Features
1. **Connection Management** (`P2PConnectionManager`)
   - WebRTC peer connection establishment
   - Auto-reconnection and error recovery
   - Connection state tracking

2. **Messaging System** (`MessageHandler`)
   - Direct peer-to-peer messaging
   - Broadcast messaging to all connected peers
   - Message ordering and delivery status

3. **File Transfer** (`FileTransferManager`)
   - Chunked binary file transfer over WebRTC data channels
   - Progress tracking and cancellation
   - Multiple concurrent transfers

4. **Signaling** (`SignalingClient`)
   - WebRTC offer/answer exchange
   - ICE candidate relay
   - Room-based peer discovery

### UI Components
- **ChatRoom**: Main chat interface with message display and input
- **RoomJoin**: Room creation and joining interface
- **FileUpload/FileDropZone**: Drag-and-drop file sharing
- **Notification**: Real-time status and error notifications

## 🧪 Development Guidelines

### Testing Approach
- **Frontend**: Vitest + React Testing Library + jsdom
- **Backend**: Vitest + Supertest + Socket.IO testing
- **Coverage Target**: 90%+ overall, 95%+ for P2P core
- **Mocking**: Comprehensive WebRTC and Socket.IO mocks

### Code Quality Standards
- **TypeScript**: Strict mode enabled, full type coverage
- **ESLint**: Standard rules + TypeScript extensions
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit validation

### Build & Development
```bash
# Development
pnpm dev                 # Start all services
pnpm dev:frontend        # Start frontend only
pnpm dev:server         # Start signaling server only

# Testing
pnpm test               # Run all tests
pnpm test:frontend      # Frontend tests only
pnpm test:server        # Server tests only

# Building
pnpm build              # Build all packages
pnpm lint               # Lint all packages
pnpm type-check         # TypeScript validation
```

## 🤖 AI Assistant Guidelines

### Common Tasks & Workflows

1. **Adding New Features**
   - Always check existing P2P core functionality first
   - Use codebase-retrieval to understand current implementation
   - Follow the established patterns in packages/p2p-core
   - Update types in packages/types when needed

2. **UI Development**
   - Use existing components from packages/ui-components
   - Follow Tailwind CSS patterns established in the codebase
   - Ensure responsive design for mobile and desktop
   - Add proper accessibility attributes

3. **Testing New Code**
   - Write tests using Vitest + React Testing Library
   - Use existing mocks in src/test/mocks/
   - Aim for high coverage, especially P2P functionality
   - Test both success and error scenarios

### Areas Requiring Special Attention

1. **P2P Functionality**
   - WebRTC connections are complex - understand existing patterns
   - File transfers use chunked binary data - be careful with memory
   - Connection state management is critical for UX
   - Always handle connection failures gracefully

2. **Security Considerations**
   - No data should be stored on servers
   - All P2P communication is encrypted by WebRTC
   - Validate all incoming messages and file transfers
   - Be cautious with file handling and memory usage

3. **Performance**
   - Large file transfers need progress tracking
   - Multiple peer connections can be resource-intensive
   - Optimize for mobile browsers with limited resources

### Preferred Tools & Approaches

1. **Package Management**: Always use pnpm, never edit package.json manually
2. **State Management**: Use Zustand store patterns established in useP2PStore
3. **Error Handling**: Use the notification system for user feedback
4. **File Operations**: Follow existing FileTransferManager patterns
5. **Testing**: Prioritize Vitest over Jest for consistency

### Memory: P2P Messaging & Contact Discovery
- For P2P messaging systems, implement contact discovery using network scanning/broadcasting with WebRTC data channels
- Include security measures to prevent spoofing
- Integrate discovery UI with visual status indicators for scanning and found contacts
- When implementing P2P features, prioritize fixing real functionality issues in the actual codebase over achieving test coverage - ensure the application works in practice with actual peer connections and data exchange

### Memory: Frontend Testing
- For frontend testing, prefer Vitest over Jest for consistency across the project
- Use React Testing Library for component testing
- Ensure comprehensive coverage of UI interactions and file transfer capabilities

## 📚 Key Documentation

- `README.md`: Quick start and basic usage
- `docs/`: Comprehensive technical documentation
- `TESTING_PLAN.md`: Detailed testing strategy and current status
- `apps/frontend/README.md`: Frontend-specific testing documentation
- `apps/signaling-server/README.md`: Server testing and API documentation

## 🚨 Important Notes

1. **Simple First**: Follow the principle "simple first, avoid over engineering"
2. **Work First**: "work first, enhance later" - prioritize functionality over perfection
3. **Real P2P**: Focus on actual peer-to-peer functionality, not just test coverage
4. **Cost Optimization**: Maintain the $5/month operational cost target
5. **Privacy**: Never store user data on servers - everything is P2P

This guide should be referenced at the start of any development session to understand the project context and follow established patterns.
