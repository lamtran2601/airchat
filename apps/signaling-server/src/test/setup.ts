import { beforeEach, afterEach, vi } from 'vitest';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Mock console methods
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  vi.restoreAllMocks();
});

// Global test utilities
export const mockConsole = {
  restore: () => {
    Object.assign(console, originalConsole);
  },
  spy: () => ({
    log: vi.spyOn(console, 'log'),
    error: vi.spyOn(console, 'error'),
    warn: vi.spyOn(console, 'warn'),
    info: vi.spyOn(console, 'info'),
  }),
};

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests
process.env.FRONTEND_URL = 'http://localhost:3000';
