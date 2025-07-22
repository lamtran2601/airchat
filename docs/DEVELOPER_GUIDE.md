# 🛠️ Developer Guide

## Development Environment Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (or pnpm 7.0+)
- **Git**: For version control
- **Modern Browser**: Chrome, Firefox, Safari, or Edge with WebRTC support

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd p2p-messenger
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or if using pnpm
   pnpm install
   ```

3. **Verify Installation**
   ```bash
   npm run dev:full
   ```
   This should start both the signaling server (port 4000) and React app (port 3000).

## Project Structure

```
p2p-messenger/
├── src/                          # Frontend source code
│   ├── lib/                      # Core P2P libraries
│   │   ├── P2PApp.js            # Main P2P orchestrator
│   │   ├── P2PConnectionManager.js  # WebRTC management
│   │   └── MinimalSignaling.js  # Signaling client
│   ├── test/                    # Frontend unit tests
│   ├── App.jsx                  # Main React component
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── server/                      # Backend signaling server
│   └── index.js                 # Express + Socket.IO server
├── tests/                       # E2E tests (Playwright)
├── docs/                        # Documentation
├── coverage/                    # Test coverage reports
├── playwright-report/           # E2E test reports
├── package.json                 # Project configuration
├── vite.config.js              # Vite build configuration
├── vitest.config.js            # Unit test configuration
└── playwright.config.js        # E2E test configuration
```

## Development Workflow

### Starting Development

1. **Start Full Development Environment**
   ```bash
   npm run dev:full
   ```
   This runs both server and client concurrently.

2. **Start Components Separately**
   ```bash
   # Terminal 1: Start signaling server
   npm run server
   
   # Terminal 2: Start React dev server
   npm run dev
   ```

### Available Scripts

```bash
# Development
npm run dev              # Start React dev server (port 3000)
npm run server          # Start signaling server (port 4000)
npm run dev:full        # Start both server and client

# Building
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run test:unit       # Run unit tests (Vitest)
npm run test:unit:ui    # Run unit tests with UI
npm run test:unit:coverage  # Run with coverage report
npm run test            # Run E2E tests (Playwright)
npm run test:ui         # Run E2E tests with UI
npm run test:debug      # Debug E2E tests
npm run test:all        # Run all tests
```

## Code Architecture

### Frontend Architecture

#### Core Classes

**P2PApp.js** - Main orchestrator
- Manages signaling and WebRTC connections
- Provides high-level API for P2P communication
- Handles event coordination between components

**P2PConnectionManager.js** - WebRTC management
- Creates and manages RTCPeerConnection instances
- Handles data channel creation and management
- Manages connection state and cleanup

**MinimalSignaling.js** - Signaling client
- Socket.IO client wrapper
- Handles room management
- Relays WebRTC signaling messages

#### React Component Structure

```javascript
App.jsx
├── Connection Status Display
├── Room Controls (join/leave)
├── Message Display Area
├── Message Input Component
└── Connected Peers List
```

### Backend Architecture

**server/index.js** - Signaling server
- Express HTTP server
- Socket.IO WebSocket server
- Room-based message relay
- Peer connection management

## Coding Standards

### JavaScript Style Guide

#### General Principles
- Use ES6+ features (modules, arrow functions, destructuring)
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex logic

#### Code Formatting
```javascript
// Good: Clear, descriptive naming
const handlePeerConnection = async (peerId) => {
  const connection = await createConnection(peerId);
  return connection;
};

// Good: Destructuring and modern syntax
const { peerId, roomId } = connectionData;
const peers = [...existingPeers, newPeer];

// Good: Error handling
try {
  await p2pApp.connect();
} catch (error) {
  console.error('Connection failed:', error);
  handleConnectionError(error);
}
```

#### React Best Practices
```javascript
// Use functional components with hooks
const MessageComponent = ({ message, onReply }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    // Cleanup on unmount
    return () => cleanup();
  }, []);
  
  return (
    <div className="message">
      {message.content}
    </div>
  );
};

// Proper prop validation (if using PropTypes)
MessageComponent.propTypes = {
  message: PropTypes.object.isRequired,
  onReply: PropTypes.func
};
```

### File Organization

#### Naming Conventions
- **Components**: PascalCase (`MessageList.jsx`)
- **Utilities**: camelCase (`connectionUtils.js`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS.js`)
- **CSS Classes**: kebab-case (`message-container`)

#### Import Organization
```javascript
// 1. External libraries
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// 2. Internal utilities/components
import { P2PApp } from './lib/P2PApp.js';
import { formatMessage } from './utils/messageUtils.js';

// 3. Styles
import './App.css';
```

## Testing Strategy

### Unit Testing (Vitest)

#### Test Structure
```javascript
// src/test/P2PApp.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { P2PApp } from '../lib/P2PApp.js';

describe('P2PApp', () => {
  let p2pApp;
  
  beforeEach(() => {
    p2pApp = new P2PApp({
      signalingServer: 'http://localhost:4000'
    });
  });
  
  it('should initialize with correct configuration', () => {
    expect(p2pApp.signaling).toBeDefined();
    expect(p2pApp.connectionManager).toBeDefined();
  });
  
  it('should handle connection events', async () => {
    const mockCallback = vi.fn();
    p2pApp.on('connected', mockCallback);
    
    // Simulate connection
    await p2pApp.connect();
    
    expect(mockCallback).toHaveBeenCalled();
  });
});
```

#### Testing Guidelines
- Test public API methods
- Mock external dependencies (Socket.IO, WebRTC)
- Test error conditions
- Verify event handling
- Aim for 80%+ code coverage

### E2E Testing (Playwright)

#### Test Structure
```javascript
// tests/p2p-messaging.spec.js
import { test, expect } from '@playwright/test';

test('users can connect and send messages', async ({ page, context }) => {
  // Open two browser contexts for P2P testing
  const page1 = page;
  const page2 = await context.newPage();
  
  // Both users join the same room
  await page1.goto('http://localhost:3000');
  await page2.goto('http://localhost:3000');
  
  await page1.fill('[placeholder="Enter room ID"]', 'test-room');
  await page1.click('text=Join Room');
  
  await page2.fill('[placeholder="Enter room ID"]', 'test-room');
  await page2.click('text=Join Room');
  
  // Send message from page1 to page2
  await page1.fill('[placeholder="Type a message..."]', 'Hello from user 1');
  await page1.click('text=Send');
  
  // Verify message received on page2
  await expect(page2.locator('text=Hello from user 1')).toBeVisible();
});
```

## Debugging

### Browser Developer Tools

#### Console Debugging
```javascript
// Add debug logging
console.log('🔍 Debug: Connection state:', connectionState);
console.log('📊 Peers:', connectedPeers);
console.log('💬 Message sent:', message);
```

#### WebRTC Debugging
```javascript
// Monitor WebRTC connection state
peerConnection.addEventListener('connectionstatechange', () => {
  console.log('WebRTC state:', peerConnection.connectionState);
});

// Log ICE candidates
peerConnection.addEventListener('icecandidate', (event) => {
  console.log('ICE candidate:', event.candidate);
});
```

### Common Issues

#### WebRTC Connection Failures
```javascript
// Check ICE connection state
peerConnection.addEventListener('iceconnectionstatechange', () => {
  if (peerConnection.iceConnectionState === 'failed') {
    console.error('ICE connection failed, attempting restart');
    // Implement connection restart logic
  }
});
```

#### Signaling Issues
```javascript
// Monitor Socket.IO connection
socket.on('connect_error', (error) => {
  console.error('Signaling connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Signaling disconnected:', reason);
});
```

## Git Workflow

### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **hotfix/**: Critical bug fixes

### Commit Messages
```bash
# Format: type(scope): description
feat(p2p): add file transfer capability
fix(signaling): resolve connection timeout issue
docs(api): update WebRTC documentation
test(unit): add P2PApp connection tests
```

### Pull Request Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Create pull request to `develop`
6. Code review and approval
7. Merge to `develop`

## Performance Optimization

### Frontend Performance
- Use React.memo for expensive components
- Implement virtual scrolling for large message lists
- Debounce user input events
- Optimize re-renders with useCallback/useMemo

### WebRTC Optimization
```javascript
// Optimize data channel settings
const dataChannel = peerConnection.createDataChannel('messages', {
  ordered: true,           // Ensure message order
  maxRetransmits: 3,      // Limit retransmission attempts
  maxPacketLifeTime: 3000 // 3 second timeout
});
```

### Bundle Optimization
```javascript
// vite.config.js - Code splitting
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          p2p: ['./src/lib/P2PApp.js', './src/lib/P2PConnectionManager.js']
        }
      }
    }
  }
});
```

## Contributing Guidelines

### Before Contributing
1. Read this developer guide
2. Set up development environment
3. Run existing tests to ensure everything works
4. Check open issues for contribution opportunities

### Contribution Process
1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** changes with tests
4. **Document** new features
5. **Submit** pull request
6. **Respond** to code review feedback

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Deployment Preparation

### Production Build
```bash
npm run build
```

### Environment Variables
```bash
# .env.production
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

### Build Verification
```bash
npm run preview  # Test production build locally
npm run test:all # Run all tests before deployment
```
