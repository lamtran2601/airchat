# 06 - Development Guide

## 🛠️ Developer Guide for P2P Messenger

### **Development Environment Setup**

#### **Prerequisites**
- **Node.js 18+**: JavaScript runtime
- **npm or pnpm**: Package manager (pnpm recommended for speed)
- **Git**: Version control
- **Modern Browser**: For testing WebRTC features
- **Code Editor**: VS Code recommended with extensions

#### **Recommended VS Code Extensions**
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag"
  ]
}
```

#### **Project Structure**
```
p2p-messenger/
├── src/                    # Frontend source code
│   ├── lib/               # Core P2P libraries
│   │   ├── P2PApp.js      # Main application orchestrator
│   │   ├── P2PConnectionManager.js  # WebRTC management
│   │   ├── MinimalSignaling.js     # Signaling client
│   │   └── PeerCapabilityManager.js # Capability management
│   ├── test/              # Unit tests
│   ├── App.jsx            # Main React component
│   ├── main.jsx           # React entry point
│   └── index.css          # Styles
├── server/                # Backend signaling server
│   └── index.js           # Express + Socket.IO server
├── tests/                 # E2E tests (Playwright)
├── docs/                  # Documentation
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── vitest.config.js       # Vitest configuration
└── playwright.config.js   # Playwright configuration
```

### **🚀 Development Workflow**

#### **Getting Started**
```bash
# Clone and setup
git clone <repository-url>
cd p2p-messenger
pnpm install

# Start development environment
pnpm run dev:full  # Starts both server and client

# Or start separately
pnpm run server    # Terminal 1: Signaling server
pnpm run dev       # Terminal 2: React dev server
```

#### **Development Scripts**
```bash
# Development
pnpm run dev           # Start React dev server
pnpm run server        # Start signaling server
pnpm run dev:full      # Start both simultaneously

# Building
pnpm run build         # Production build
pnpm run preview       # Preview production build

# Testing
pnpm run test:unit     # Unit tests (Vitest)
pnpm run test          # E2E tests (Playwright)
pnpm run test:all      # All tests
pnpm run test:unit:coverage  # Unit tests with coverage

# Testing with UI
pnpm run test:unit:ui  # Vitest UI
pnpm run test:ui       # Playwright UI
```

### **🏗️ Architecture Overview**

#### **Frontend Architecture**
```
React App (App.jsx)
    ↓
P2PApp (Main Orchestrator)
    ├── MinimalSignaling (Server Communication)
    ├── P2PConnectionManager (WebRTC Management)
    └── PeerCapabilityManager (Capability Management)
```

#### **Key Design Patterns**
- **Event-Driven Architecture**: Components communicate via events
- **Composition over Inheritance**: Modular component design
- **Separation of Concerns**: Clear boundaries between layers
- **Reactive State Management**: React hooks for UI state

### **🔧 Core Components Development**

#### **P2PApp Development**
The main orchestrator coordinates all P2P functionality:

```javascript
// Key responsibilities:
// 1. Manage component lifecycle
// 2. Coordinate signaling and WebRTC
// 3. Handle message routing
// 4. Manage file transfers
// 5. Emit events for React components

class P2PApp {
  constructor(config) {
    this.signaling = new MinimalSignaling(config.signalingServer);
    this.connectionManager = new P2PConnectionManager(config.webrtc);
    this.capabilityManager = null; // Initialized after connection
    this.setupEventHandlers();
  }
}
```

#### **Adding New Features**
1. **Identify Component**: Determine which component handles the feature
2. **Add Methods**: Implement core functionality
3. **Add Events**: Define events for React integration
4. **Update UI**: Add React components and handlers
5. **Write Tests**: Add unit and integration tests

#### **Event System Pattern**
```javascript
// In P2P components - emit events
this.emit('custom-event', { data: 'value' });

// In React components - listen for events
useEffect(() => {
  const handleCustomEvent = (data) => {
    // Handle event
  };
  
  p2pApp.on('custom-event', handleCustomEvent);
  return () => p2pApp.off('custom-event', handleCustomEvent);
}, [p2pApp]);
```

### **🧪 Testing Strategy**

#### **Unit Testing (Vitest)**
- **Location**: `src/test/`
- **Framework**: Vitest with React Testing Library
- **Coverage**: Aim for >80% code coverage
- **Focus**: Individual component functionality

**Example Unit Test:**
```javascript
import { describe, it, expect, vi } from 'vitest';
import { P2PApp } from '../lib/P2PApp.js';

describe('P2PApp', () => {
  it('should connect to signaling server', async () => {
    const app = new P2PApp({ signalingServer: 'http://localhost:4000' });
    const peerId = await app.connect();
    expect(peerId).toBeDefined();
  });
});
```

#### **E2E Testing (Playwright)**
- **Location**: `tests/`
- **Framework**: Playwright
- **Focus**: Full user workflows and P2P functionality

**Example E2E Test:**
```javascript
import { test, expect } from '@playwright/test';

test('P2P messaging between two peers', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // Test P2P connection and messaging
  await page1.goto('http://localhost:3000');
  await page2.goto('http://localhost:3000');
  
  // Join same room
  await page1.fill('[placeholder="Enter room ID"]', 'test-room');
  await page2.fill('[placeholder="Enter room ID"]', 'test-room');
  
  await page1.click('text=Join Room');
  await page2.click('text=Join Room');
  
  // Send message
  await page1.fill('[placeholder="Type a message..."]', 'Hello from peer 1');
  await page1.click('text=Send');
  
  // Verify message received
  await expect(page2.locator('text=Hello from peer 1')).toBeVisible();
});
```

#### **Testing Best Practices**
- **Test Real P2P Functionality**: Use actual WebRTC connections
- **Mock External Dependencies**: Mock signaling server when needed
- **Test Error Scenarios**: Network failures, connection drops
- **Performance Testing**: Large files, many peers
- **Cross-Browser Testing**: Test on different browsers

### **🔄 Code Quality Standards**

#### **Code Style**
- **ESLint**: Enforces code quality rules
- **Prettier**: Automatic code formatting
- **Consistent Naming**: camelCase for variables, PascalCase for classes
- **Clear Comments**: Document complex logic and APIs

#### **Git Workflow**
```bash
# Feature development
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create pull request

# Commit message format
feat: add new feature
fix: resolve bug
docs: update documentation
test: add tests
refactor: improve code structure
```

#### **Code Review Checklist**
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No console.log statements in production code
- [ ] Error handling is implemented
- [ ] Performance considerations addressed

### **🚀 Adding New Features**

#### **Feature Development Process**
1. **Plan**: Define requirements and design
2. **Design**: Create component interfaces
3. **Implement**: Write core functionality
4. **Test**: Add comprehensive tests
5. **Document**: Update documentation
6. **Review**: Code review and feedback
7. **Deploy**: Merge and deploy

#### **Example: Adding Voice Chat**
```javascript
// 1. Extend P2PConnectionManager
class P2PConnectionManager {
  async createAudioConnection(peerId) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const pc = this.connections.get(peerId);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }
}

// 2. Add to P2PApp
class P2PApp {
  async startVoiceChat(peerId) {
    await this.connectionManager.createAudioConnection(peerId);
    this.emit('voice-chat-started', { peerId });
  }
}

// 3. Add React UI
function VoiceChatButton({ peerId, p2pApp }) {
  const handleStartVoiceChat = () => {
    p2pApp.startVoiceChat(peerId);
  };
  
  return <button onClick={handleStartVoiceChat}>Start Voice Chat</button>;
}
```

### **🔧 Configuration Management**

#### **Environment Configuration**
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  define: {
    __SIGNALING_URL__: JSON.stringify(process.env.VITE_SIGNALING_URL || 'http://localhost:4000')
  }
});
```

#### **Feature Flags**
```javascript
// config/features.js
export const FEATURES = {
  FILE_TRANSFER: true,
  VOICE_CHAT: false,
  VIDEO_CHAT: false,
  SCREEN_SHARING: false
};

// Usage in components
if (FEATURES.VOICE_CHAT) {
  // Render voice chat UI
}
```

### **📊 Performance Optimization**

#### **Frontend Performance**
- **Code Splitting**: Lazy load components
- **Bundle Analysis**: Monitor bundle size
- **Memory Management**: Clean up WebRTC connections
- **React Optimization**: Use React.memo, useMemo, useCallback

#### **WebRTC Optimization**
```javascript
// Optimize data channel configuration
const dataChannelConfig = {
  ordered: true,           // Maintain order for messages
  maxRetransmits: 3,      // Limit retransmissions
  maxPacketLifeTime: 3000 // 3 second timeout
};

// Monitor connection quality
setInterval(() => {
  const stats = await pc.getStats();
  // Analyze and optimize based on stats
}, 10000);
```

#### **Server Performance**
```javascript
// Optimize Socket.IO server
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket'], // Prefer WebSocket
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || "http://localhost:3000"
  }
});
```

### **🔒 Security Considerations**

#### **Input Validation**
```javascript
// Validate message content
function validateMessage(message) {
  if (typeof message !== 'string') return false;
  if (message.length > 10000) return false; // Limit message size
  return true;
}

// Sanitize file uploads
function validateFile(file) {
  const allowedTypes = ['image/', 'text/', 'application/pdf'];
  return allowedTypes.some(type => file.type.startsWith(type));
}
```

#### **WebRTC Security**
- **DTLS Encryption**: Enabled by default
- **ICE Candidate Validation**: Validate ICE candidates
- **Origin Validation**: Check message origins
- **Rate Limiting**: Prevent message spam

### **🚀 Deployment**

#### **Production Build**
```bash
# Build for production
pnpm run build

# Test production build locally
pnpm run preview

# Deploy static files to CDN
# Deploy signaling server to cloud platform
```

#### **Environment Variables**
```bash
# Production environment
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### **📚 Contributing Guidelines**

#### **Before Contributing**
1. **Read Documentation**: Understand the architecture
2. **Set Up Environment**: Follow setup instructions
3. **Run Tests**: Ensure all tests pass
4. **Check Issues**: Look for existing issues or feature requests

#### **Contribution Process**
1. **Fork Repository**: Create your own fork
2. **Create Branch**: Use descriptive branch names
3. **Make Changes**: Follow code standards
4. **Add Tests**: Include comprehensive tests
5. **Update Docs**: Update relevant documentation
6. **Submit PR**: Create pull request with clear description

#### **Pull Request Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
```

This development guide provides a comprehensive foundation for contributing to and extending the P2P Messenger project.
