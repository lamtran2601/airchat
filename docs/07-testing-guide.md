# 07 - Testing Guide

## 🧪 Comprehensive Testing Strategy

### **Testing Overview**

P2P Messenger uses a multi-layered testing approach to ensure reliability, performance, and functionality across different scenarios and environments.

### **🎯 Testing Philosophy**

#### **Core Principles**
- **Test Real P2P Functionality**: Use actual WebRTC connections, not mocks
- **Cover Critical Paths**: Focus on connection establishment and message delivery
- **Test Error Scenarios**: Network failures, connection drops, edge cases
- **Performance Testing**: Large files, multiple peers, stress conditions
- **Cross-Browser Compatibility**: Test on different browsers and devices

#### **Testing Pyramid**
```
    E2E Tests (Playwright)
         ↑
   Integration Tests
         ↑
    Unit Tests (Vitest)
```

### **🔧 Testing Tools**

#### **Unit Testing - Vitest**
- **Framework**: Vitest (fast, modern alternative to Jest)
- **Utilities**: React Testing Library for component testing
- **Coverage**: V8 coverage reporting
- **Location**: `src/test/`

#### **E2E Testing - Playwright**
- **Framework**: Playwright for cross-browser testing
- **Features**: Real browser automation, network interception
- **Browsers**: Chrome, Firefox, Safari, Edge
- **Location**: `tests/`

#### **Development Tools**
- **Test UI**: Interactive test runners
- **Debug Mode**: Step-through debugging
- **Coverage Reports**: Detailed coverage analysis

### **🚀 Running Tests**

#### **Quick Test Commands**
```bash
# Run all tests
pnpm run test:all

# Unit tests
pnpm run test:unit              # Run once
pnpm run test:unit:coverage     # With coverage
pnpm run test:unit:ui           # Interactive UI

# E2E tests
pnpm run test                   # Run E2E tests
pnpm run test:ui                # Interactive UI
pnpm run test:debug             # Debug mode
```

#### **Detailed Test Execution**
```bash
# Unit tests with specific patterns
npx vitest run --reporter=verbose
npx vitest run src/test/P2PApp.test.js
npx vitest watch                # Watch mode

# E2E tests with options
npx playwright test --headed    # Show browser
npx playwright test --debug     # Debug mode
npx playwright test --project=chromium  # Specific browser
```

### **📋 Unit Testing**

#### **Test Structure**
```javascript
// src/test/P2PApp.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { P2PApp } from '../lib/P2PApp.js';

describe('P2PApp', () => {
  let app;
  
  beforeEach(() => {
    app = new P2PApp({ signalingServer: 'http://localhost:4000' });
  });
  
  afterEach(() => {
    app?.disconnect();
  });
  
  it('should initialize with default configuration', () => {
    expect(app).toBeDefined();
    expect(app.signaling).toBeDefined();
    expect(app.connectionManager).toBeDefined();
  });
});
```

#### **Testing P2P Components**

**P2PApp Testing:**
```javascript
describe('P2PApp Connection Management', () => {
  it('should connect to signaling server', async () => {
    const peerId = await app.connect();
    expect(peerId).toBeDefined();
    expect(app.isConnected()).toBe(true);
  });
  
  it('should join room successfully', async () => {
    await app.connect();
    const roomId = 'test-room-' + Date.now();
    await app.joinRoom(roomId);
    expect(app.currentRoom).toBe(roomId);
  });
  
  it('should handle connection failures gracefully', async () => {
    const invalidApp = new P2PApp({ signalingServer: 'http://invalid:9999' });
    await expect(invalidApp.connect()).rejects.toThrow();
  });
});
```

**P2PConnectionManager Testing:**
```javascript
describe('P2PConnectionManager', () => {
  it('should create WebRTC connection', async () => {
    const manager = new P2PConnectionManager();
    const peerId = 'test-peer';
    const connection = await manager.createConnection(peerId, true);
    
    expect(connection).toBeInstanceOf(RTCPeerConnection);
    expect(manager.connections.has(peerId)).toBe(true);
  });
  
  it('should send messages reliably', async () => {
    const manager = new P2PConnectionManager();
    const peerId = 'test-peer';
    
    // Mock successful connection
    const mockConnection = createMockConnection();
    manager.connections.set(peerId, mockConnection);
    
    await manager.sendReliable(peerId, { type: 'test', content: 'hello' });
    expect(mockConnection.send).toHaveBeenCalled();
  });
});
```

#### **React Component Testing**
```javascript
// src/test/App.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../App.jsx';

describe('App Component', () => {
  it('should render connection status', () => {
    render(<App />);
    expect(screen.getByText(/Connected|Connecting|Disconnected/)).toBeInTheDocument();
  });
  
  it('should allow joining a room', async () => {
    render(<App />);
    
    const roomInput = screen.getByPlaceholderText('Enter room ID');
    const joinButton = screen.getByText('Join Room');
    
    fireEvent.change(roomInput, { target: { value: 'test-room' } });
    fireEvent.click(joinButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Joined room: test-room/)).toBeInTheDocument();
    });
  });
  
  it('should send messages when connected', async () => {
    render(<App />);
    
    // Wait for connection
    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeInTheDocument();
    });
    
    const messageInput = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');
    
    fireEvent.change(messageInput, { target: { value: 'Hello, world!' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });
  });
});
```

### **🌐 E2E Testing**

#### **Test Configuration**
```javascript
// playwright.config.js
export default {
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: 'npm run dev:full',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
};
```

#### **P2P Messaging Tests**
```javascript
// tests/p2p-messaging.spec.js
import { test, expect } from '@playwright/test';

test.describe('P2P Messaging', () => {
  test('should establish P2P connection between two peers', async ({ browser }) => {
    // Create two browser contexts (simulate two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Navigate to application
    await page1.goto('/');
    await page2.goto('/');
    
    // Wait for connection to signaling server
    await expect(page1.locator('.connection-status')).toContainText('Connected');
    await expect(page2.locator('.connection-status')).toContainText('Connected');
    
    // Join same room
    const roomId = 'test-room-' + Date.now();
    
    await page1.fill('[placeholder="Enter room ID"]', roomId);
    await page1.click('text=Join Room');
    
    await page2.fill('[placeholder="Enter room ID"]', roomId);
    await page2.click('text=Join Room');
    
    // Wait for P2P connection
    await expect(page1.locator('text=Connected Peers: 1')).toBeVisible();
    await expect(page2.locator('text=Connected Peers: 1')).toBeVisible();
    
    // Send message from peer 1
    await page1.fill('[placeholder="Type a message..."]', 'Hello from peer 1');
    await page1.click('text=Send');
    
    // Verify message appears on both sides
    await expect(page1.locator('text=Hello from peer 1')).toBeVisible();
    await expect(page2.locator('text=Hello from peer 1')).toBeVisible();
    
    // Send message from peer 2
    await page2.fill('[placeholder="Type a message..."]', 'Hello from peer 2');
    await page2.click('text=Send');
    
    // Verify bidirectional communication
    await expect(page1.locator('text=Hello from peer 2')).toBeVisible();
    await expect(page2.locator('text=Hello from peer 2')).toBeVisible();
    
    await context1.close();
    await context2.close();
  });
});
```

#### **File Transfer Tests**
```javascript
test.describe('File Transfer', () => {
  test('should transfer files between peers', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Establish P2P connection (same as above)
    await establishP2PConnection(page1, page2);
    
    // Create test file
    const testFileContent = 'This is a test file content';
    const testFile = await page1.evaluateHandle(() => {
      const file = new File(['This is a test file content'], 'test.txt', {
        type: 'text/plain'
      });
      return file;
    });
    
    // Upload file on peer 1
    await page1.setInputFiles('input[type="file"]', testFile);
    
    // Wait for file transfer completion
    await expect(page1.locator('text=File sent: test.txt')).toBeVisible();
    await expect(page2.locator('text=File received: test.txt')).toBeVisible();
    
    // Verify download button appears
    await expect(page2.locator('button:has-text("💾 Download")')).toBeVisible();
    
    await context1.close();
    await context2.close();
  });
});
```

#### **Multi-Peer Tests**
```javascript
test.describe('Multi-Peer Mesh', () => {
  test('should handle 3-peer mesh network', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );
    
    // Connect all peers to same room
    const roomId = 'mesh-test-' + Date.now();
    
    for (const page of pages) {
      await page.goto('/');
      await expect(page.locator('.connection-status')).toContainText('Connected');
      await page.fill('[placeholder="Enter room ID"]', roomId);
      await page.click('text=Join Room');
    }
    
    // Wait for full mesh (each peer connected to 2 others)
    for (const page of pages) {
      await expect(page.locator('text=Connected Peers: 2')).toBeVisible();
    }
    
    // Test message propagation
    await pages[0].fill('[placeholder="Type a message..."]', 'Message from peer 1');
    await pages[0].click('text=Send');
    
    // Verify all peers receive the message
    for (const page of pages) {
      await expect(page.locator('text=Message from peer 1')).toBeVisible();
    }
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });
});
```

### **🔍 Testing Utilities**

#### **Test Helpers**
```javascript
// tests/helpers/p2p-helpers.js
export async function establishP2PConnection(page1, page2, roomId = null) {
  const testRoomId = roomId || 'test-room-' + Date.now();
  
  // Navigate and connect
  await page1.goto('/');
  await page2.goto('/');
  
  await expect(page1.locator('.connection-status')).toContainText('Connected');
  await expect(page2.locator('.connection-status')).toContainText('Connected');
  
  // Join room
  await page1.fill('[placeholder="Enter room ID"]', testRoomId);
  await page1.click('text=Join Room');
  
  await page2.fill('[placeholder="Enter room ID"]', testRoomId);
  await page2.click('text=Join Room');
  
  // Wait for P2P connection
  await expect(page1.locator('text=Connected Peers: 1')).toBeVisible();
  await expect(page2.locator('text=Connected Peers: 1')).toBeVisible();
  
  return testRoomId;
}

export async function sendMessage(page, message) {
  await page.fill('[placeholder="Type a message..."]', message);
  await page.click('text=Send');
}

export async function waitForMessage(page, message) {
  await expect(page.locator(`text=${message}`)).toBeVisible();
}
```

#### **Mock Utilities**
```javascript
// src/test/mocks/webrtc-mock.js
export function createMockConnection() {
  return {
    connectionState: 'connected',
    createDataChannel: vi.fn(() => ({
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn()
    })),
    createOffer: vi.fn(() => Promise.resolve({})),
    createAnswer: vi.fn(() => Promise.resolve({})),
    setLocalDescription: vi.fn(() => Promise.resolve()),
    setRemoteDescription: vi.fn(() => Promise.resolve()),
    addIceCandidate: vi.fn(() => Promise.resolve()),
    close: vi.fn()
  };
}
```

### **📊 Test Coverage**

#### **Coverage Goals**
- **Unit Tests**: >80% code coverage
- **Integration Tests**: Critical P2P paths covered
- **E2E Tests**: All user workflows tested
- **Cross-Browser**: Chrome, Firefox, Safari, Edge

#### **Coverage Reports**
```bash
# Generate coverage report
pnpm run test:unit:coverage

# View coverage report
open coverage/index.html
```

#### **Coverage Analysis**
```javascript
// vitest.config.js
export default {
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        'tests/',
        '**/*.config.js'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
};
```

### **🚨 Testing Best Practices**

#### **Unit Testing Best Practices**
- **Test Behavior, Not Implementation**: Focus on what the code does
- **Use Descriptive Test Names**: Clear, specific test descriptions
- **Arrange-Act-Assert Pattern**: Structure tests consistently
- **Mock External Dependencies**: Isolate units under test
- **Test Edge Cases**: Error conditions, boundary values

#### **E2E Testing Best Practices**
- **Test Real User Workflows**: Complete user journeys
- **Use Stable Selectors**: Prefer data-testid over CSS selectors
- **Wait for Elements**: Use proper waiting strategies
- **Clean Up Resources**: Close contexts and connections
- **Test Cross-Browser**: Verify compatibility

#### **P2P Testing Considerations**
- **Real WebRTC Connections**: Don't mock WebRTC in integration tests
- **Network Conditions**: Test with different network scenarios
- **Timing Issues**: Account for connection establishment delays
- **Resource Cleanup**: Properly close connections and contexts
- **Flaky Test Prevention**: Use proper waits and retries

### **🔧 Debugging Tests**

#### **Debug Unit Tests**
```bash
# Debug specific test
npx vitest run --reporter=verbose src/test/P2PApp.test.js

# Debug with browser tools
npx vitest --ui
```

#### **Debug E2E Tests**
```bash
# Run with browser visible
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# Trace viewer
npx playwright show-trace trace.zip
```

#### **Common Issues**
- **Timing Issues**: Use proper waits instead of fixed delays
- **Resource Leaks**: Ensure proper cleanup in afterEach/afterAll
- **Flaky Tests**: Identify and fix non-deterministic behavior
- **WebRTC Failures**: Check browser permissions and network access

This comprehensive testing guide ensures robust, reliable P2P functionality across all scenarios and environments.
