# 🧪 Testing Documentation

## Testing Philosophy

The P2P Messenger follows a comprehensive testing strategy that ensures reliability, performance, and user experience across different scenarios and environments.

### Testing Pyramid
```
    /\
   /  \     E2E Tests (Playwright)
  /____\    - User workflows
 /      \   - Cross-browser testing
/________\  - P2P communication

Integration Tests
- Component interactions
- API integration
- WebRTC connections

Unit Tests (Vitest)
- Individual functions
- Component logic
- Business rules
```

## Unit Testing with Vitest

### Setup and Configuration

#### Test Configuration (`vitest.config.js`)
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}'
      ]
    }
  }
});
```

#### Test Setup (`src/test/setup.js`)
```javascript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock WebRTC APIs
global.RTCPeerConnection = class MockRTCPeerConnection {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
    this.connectionState = 'new';
  }
  
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'mock-sdp' });
  }
  
  createAnswer() {
    return Promise.resolve({ type: 'answer', sdp: 'mock-sdp' });
  }
  
  setLocalDescription() {
    return Promise.resolve();
  }
  
  setRemoteDescription() {
    return Promise.resolve();
  }
  
  createDataChannel() {
    return {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn()
    };
  }
};
```

### Unit Test Examples

#### Testing P2P Components
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
    expect(p2pApp.currentRoom).toBeNull();
  });
  
  it('should handle connection events', async () => {
    const mockCallback = vi.fn();
    p2pApp.on('connected', mockCallback);
    
    // Simulate connection
    p2pApp.signaling.emit('connect');
    
    expect(mockCallback).toHaveBeenCalled();
  });
  
  it('should send messages to connected peers', async () => {
    // Mock connected peer
    p2pApp.connectionManager.connections.set('peer1', {
      dataChannel: { send: vi.fn() }
    });
    
    const result = await p2pApp.sendMessage('Hello World');
    
    expect(result).toHaveLength(1);
    expect(result[0].success).toBe(true);
  });
});
```

#### Testing React Components
```javascript
// src/test/App.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.jsx';

// Mock P2PApp
vi.mock('./lib/P2PApp.js', () => ({
  P2PApp: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(),
    joinRoom: vi.fn().mockResolvedValue(),
    sendMessage: vi.fn().mockResolvedValue([]),
    isConnected: vi.fn().mockReturnValue(true),
    getPeerId: vi.fn().mockReturnValue('test-peer'),
    on: vi.fn(),
    off: vi.fn()
  }))
}));

describe('App Component', () => {
  it('renders main interface elements', () => {
    render(<App />);
    
    expect(screen.getByText('🔗 P2P Messenger')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter room ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });
  
  it('handles room joining', async () => {
    render(<App />);
    
    const roomInput = screen.getByPlaceholderText('Enter room ID');
    const joinButton = screen.getByText('Join Room');
    
    fireEvent.change(roomInput, { target: { value: 'test-room' } });
    fireEvent.click(joinButton);
    
    await waitFor(() => {
      expect(roomInput.value).toBe('');
    });
  });
  
  it('handles message sending', async () => {
    render(<App />);
    
    const messageInput = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');
    
    fireEvent.change(messageInput, { target: { value: 'Hello' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(messageInput.value).toBe('');
    });
  });
});
```

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:unit:coverage

# Run in watch mode
npm run test:unit -- --watch

# Run specific test file
npm run test:unit -- P2PApp.test.js

# Run with UI
npm run test:unit:ui
```

## End-to-End Testing with Playwright

### E2E Test Configuration (`playwright.config.js`)
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev:full',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Examples

#### P2P Communication Test
```javascript
// tests/p2p-messaging.spec.js
import { test, expect } from '@playwright/test';

test.describe('P2P Messaging', () => {
  test('two users can connect and exchange messages', async ({ browser }) => {
    // Create two browser contexts for different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both users navigate to the app
    await page1.goto('/');
    await page2.goto('/');
    
    // Wait for connection
    await expect(page1.locator('.connection-status')).toContainText('Connected');
    await expect(page2.locator('.connection-status')).toContainText('Connected');
    
    // Both users join the same room
    const roomId = 'test-room-' + Date.now();
    
    await page1.fill('[placeholder="Enter room ID"]', roomId);
    await page1.click('text=Join Room');
    
    await page2.fill('[placeholder="Enter room ID"]', roomId);
    await page2.click('text=Join Room');
    
    // Wait for peer connection
    await expect(page1.locator('text=Connected Peers: 1')).toBeVisible();
    await expect(page2.locator('text=Connected Peers: 1')).toBeVisible();
    
    // User 1 sends a message
    await page1.fill('[placeholder="Type a message..."]', 'Hello from User 1');
    await page1.click('text=Send');
    
    // Verify message appears on both sides
    await expect(page1.locator('text=Hello from User 1')).toBeVisible();
    await expect(page2.locator('text=Hello from User 1')).toBeVisible();
    
    // User 2 responds
    await page2.fill('[placeholder="Type a message..."]', 'Hello from User 2');
    await page2.click('text=Send');
    
    // Verify response appears on both sides
    await expect(page1.locator('text=Hello from User 2')).toBeVisible();
    await expect(page2.locator('text=Hello from User 2')).toBeVisible();
    
    await context1.close();
    await context2.close();
  });
  
  test('handles connection failures gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Simulate server disconnection
    await page.evaluate(() => {
      window.p2pApp?.signaling?.socket?.disconnect();
    });
    
    // Should show disconnected status
    await expect(page.locator('.connection-status')).toContainText('Disconnected');
    
    // Should disable room controls
    await expect(page.locator('[placeholder="Enter room ID"]')).toBeDisabled();
    await expect(page.locator('text=Join Room')).toBeDisabled();
  });
});
```

#### Cross-Browser Compatibility Test
```javascript
// tests/cross-browser.spec.js
import { test, expect, devices } from '@playwright/test';

const browsers = ['chromium', 'firefox', 'webkit'];

browsers.forEach(browserName => {
  test.describe(`${browserName} compatibility`, () => {
    test(`basic functionality works in ${browserName}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto('/');
      
      // Test basic UI elements
      await expect(page.locator('h1')).toContainText('P2P Messenger');
      await expect(page.locator('[placeholder="Enter room ID"]')).toBeVisible();
      await expect(page.locator('[placeholder="Type a message..."]')).toBeVisible();
      
      // Test connection
      await expect(page.locator('.connection-status')).toContainText('Connected');
      
      await context.close();
    });
  });
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test

# Run with UI
npm run test:ui

# Run in debug mode
npm run test:debug

# Run specific browser
npx playwright test --project=chromium

# Run specific test file
npx playwright test p2p-messaging.spec.js
```

## Performance Testing

### Load Testing Script
```javascript
// tests/performance/load-test.js
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('handles multiple concurrent connections', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    const numUsers = 5;
    
    // Create multiple users
    for (let i = 0; i < numUsers; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }
    
    // All users join the same room
    const roomId = 'load-test-room';
    
    await Promise.all(pages.map(async (page, index) => {
      await page.goto('/');
      await expect(page.locator('.connection-status')).toContainText('Connected');
      await page.fill('[placeholder="Enter room ID"]', roomId);
      await page.click('text=Join Room');
    }));
    
    // Wait for all connections
    await Promise.all(pages.map(async (page) => {
      await expect(page.locator(`text=Connected Peers: ${numUsers - 1}`)).toBeVisible();
    }));
    
    // Measure message delivery time
    const startTime = Date.now();
    
    await pages[0].fill('[placeholder="Type a message..."]', 'Performance test message');
    await pages[0].click('text=Send');
    
    // Wait for message to appear on all other pages
    await Promise.all(pages.slice(1).map(async (page) => {
      await expect(page.locator('text=Performance test message')).toBeVisible();
    }));
    
    const endTime = Date.now();
    const deliveryTime = endTime - startTime;
    
    console.log(`Message delivery time for ${numUsers} users: ${deliveryTime}ms`);
    expect(deliveryTime).toBeLessThan(5000); // Should be under 5 seconds
    
    // Cleanup
    await Promise.all(contexts.map(context => context.close()));
  });
});
```

## Test Coverage Requirements

### Coverage Targets
- **Overall Coverage**: 80% minimum
- **Statements**: 85% minimum
- **Branches**: 75% minimum
- **Functions**: 90% minimum
- **Lines**: 85% minimum

### Coverage Reports
```bash
# Generate coverage report
npm run test:unit:coverage

# View HTML report
open coverage/index.html
```

### Critical Path Coverage
Ensure 100% coverage for:
- P2P connection establishment
- Message sending/receiving
- Error handling
- Security validations

## Manual Testing Procedures

### Pre-Release Testing Checklist

#### Functional Testing
- [ ] User can connect to signaling server
- [ ] User can join rooms successfully
- [ ] P2P connections establish correctly
- [ ] Messages send and receive properly
- [ ] Multiple users can communicate
- [ ] Connection errors handled gracefully
- [ ] UI responds correctly to all states

#### Browser Testing
- [ ] Chrome (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Edge (latest 2 versions)
- [ ] Mobile Chrome (latest version)
- [ ] Mobile Safari (latest version)

#### Network Testing
- [ ] Works on different network types (WiFi, cellular)
- [ ] Handles network interruptions
- [ ] Works behind corporate firewalls
- [ ] Functions with VPN connections

#### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] Connection establishment < 5 seconds
- [ ] Message delivery < 1 second
- [ ] Memory usage remains stable
- [ ] No memory leaks during extended use

### Bug Reporting Template
```markdown
## Bug Report

**Environment:**
- Browser: [Chrome 91.0.4472.124]
- OS: [macOS 11.4]
- Network: [WiFi/Cellular/Corporate]

**Steps to Reproduce:**
1. Navigate to application
2. Join room "test-room"
3. Send message "Hello"
4. Observe behavior

**Expected Behavior:**
Message should appear in chat

**Actual Behavior:**
Message does not send, error in console

**Screenshots/Logs:**
[Attach relevant screenshots and console logs]

**Additional Context:**
Any other relevant information
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install
      - run: npm run test
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Data Management

### Test Data Setup
```javascript
// tests/fixtures/testData.js
export const testRooms = {
  basic: 'test-room-basic',
  multiUser: 'test-room-multi',
  performance: 'test-room-perf'
};

export const testMessages = {
  simple: 'Hello World',
  long: 'A'.repeat(1000),
  special: '🚀 Special characters: @#$%^&*()',
  empty: ''
};

export const testUsers = {
  user1: { id: 'user1', name: 'Test User 1' },
  user2: { id: 'user2', name: 'Test User 2' }
};
```

### Test Environment Cleanup
```javascript
// tests/helpers/cleanup.js
export async function cleanupTestData(page) {
  // Clear local storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Disconnect from signaling server
  await page.evaluate(() => {
    if (window.p2pApp) {
      window.p2pApp.disconnect();
    }
  });
}
```
