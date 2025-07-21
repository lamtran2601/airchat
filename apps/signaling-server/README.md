# Signaling Server Tests

This document describes the comprehensive test suite for the signaling server, which verifies all core functionality including WebRTC signaling, API endpoints, middleware configuration, and graceful shutdown handling.

## Test Framework

The test suite uses **Vitest** with the following configuration:
- **Test Environment**: Node.js
- **Coverage Provider**: V8
- **Timeout**: 10 seconds for tests and hooks
- **Setup**: Automatic console mocking and environment configuration

## Test Structure

### 1. Unit Tests (`SignalingService.test.ts`)
Tests the core `SignalingService` class functionality:

- **Constructor & Setup**: Verifies proper initialization and event handler registration
- **Room Management**: Tests joining/leaving rooms, peer notifications, and room cleanup
- **Message Relaying**: Validates WebRTC signaling message forwarding (offer/answer/ICE candidates)
- **Statistics**: Ensures accurate tracking of connections, rooms, and message counts
- **Disconnect Handling**: Verifies proper cleanup when clients disconnect

**Coverage**: 100% of SignalingService class

### 2. Integration Tests (`api.test.ts`)
Tests the Express API endpoints:

- **Health Endpoint** (`/health`): Response format, status codes, and data validation
- **Stats Endpoint** (`/api/stats`): Real-time statistics accuracy and structure
- **Error Handling**: 404 responses and malformed request handling
- **CORS Headers**: Cross-origin request handling and preflight responses

### 3. Socket.IO Integration Tests (`socket.test.ts`)
Tests real WebRTC signaling functionality:

- **Connection Management**: Client connections, disconnections, and statistics updates
- **Room Operations**: Multi-peer room joining, leaving, and peer notifications
- **WebRTC Signaling**: End-to-end offer/answer/ICE candidate message relay
- **Message Sequencing**: Multiple message types in correct order

### 4. Middleware Tests (`middleware.test.ts`)
Verifies security and performance middleware:

- **CORS Configuration**: Origin validation, preflight handling, and security headers
- **Helmet Security**: Security headers (X-Frame-Options, CSP, etc.)
- **Compression**: Gzip compression for large responses
- **JSON Parsing**: Request body parsing and error handling
- **Integration**: Middleware order and error handling

### 5. Graceful Shutdown Tests (`shutdown.test.ts`)
Tests server lifecycle management:

- **Signal Handling**: SIGTERM and SIGINT signal registration and processing
- **Graceful Shutdown**: Proper server closure and client disconnection
- **Cleanup**: Resource cleanup and state preservation during shutdown
- **Timeout Handling**: Behavior when shutdown takes too long

## Running Tests

### From Signaling Server Directory
```bash
cd apps/signaling-server

# Run all tests once
pnpm test:run

# Run tests in watch mode
pnpm test

# Run tests with coverage report
pnpm test:coverage
```

### From Project Root
```bash
# Run signaling server tests
pnpm test:server

# Run with coverage
pnpm test:server:coverage

# Run in watch mode
pnpm test:server:watch
```

## Test Coverage

Current coverage metrics:
- **SignalingService**: 100% (statements, branches, functions, lines)
- **Overall**: 65.46% (main index.ts excluded as it contains server startup code)

## Test Environment

Tests run with:
- **Node.js environment**: Server-side testing
- **Mocked console**: Reduced noise during test execution
- **Random ports**: Prevents port conflicts during parallel test execution
- **Isolated state**: Each test starts with clean SignalingService state

## Key Test Features

### Realistic WebRTC Simulation
- Uses actual Socket.IO client connections
- Tests real message relay between multiple clients
- Validates WebRTC signaling protocol compliance

### Comprehensive Error Scenarios
- Network disconnections
- Malformed requests
- Invalid origins
- Server shutdown during active connections

### Performance Validation
- Compression middleware effectiveness
- Concurrent connection handling
- Message relay performance

### Security Testing
- CORS policy enforcement
- Security header validation
- Input sanitization

## Continuous Integration

Tests are automatically run in CI/CD pipeline:
- **GitHub Actions**: Runs on Node.js 18.x and 20.x
- **Pre-commit hooks**: Ensures tests pass before commits
- **Coverage reporting**: Tracks test coverage over time

## Adding New Tests

When adding new functionality:

1. **Unit Tests**: Add to `SignalingService.test.ts` for core logic
2. **API Tests**: Add to `api.test.ts` for new endpoints
3. **Integration Tests**: Add to `socket.test.ts` for Socket.IO features
4. **Middleware Tests**: Add to `middleware.test.ts` for new middleware

Follow the existing patterns:
- Use descriptive test names
- Group related tests in `describe` blocks
- Clean up resources in `afterEach` hooks
- Mock external dependencies appropriately

## Debugging Tests

For debugging failing tests:
```bash
# Run specific test file
pnpm test src/test/SignalingService.test.ts

# Run with verbose output
pnpm test --reporter=verbose

# Run single test
pnpm test -t "should handle room joining"
```
