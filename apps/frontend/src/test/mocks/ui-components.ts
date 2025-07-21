import { vi } from 'vitest';
import React from 'react';

// Mock UI components
const createMockComponent = (name: string) => {
  return vi.fn().mockImplementation((props: any) => {
    return React.createElement('div', {
      'data-testid': `mock-${name.toLowerCase()}`,
      ...props,
    }, props.children);
  });
};

export const mockButton = createMockComponent('Button');
export const mockInput = createMockComponent('Input');
export const mockCard = createMockComponent('Card');
export const mockModal = createMockComponent('Modal');
export const mockNotification = createMockComponent('Notification');
export const mockFileDropZone = createMockComponent('FileDropZone');
export const mockFileUpload = createMockComponent('FileUpload');
export const mockFileTransferComponent = createMockComponent('FileTransferComponent');
export const mockFileList = createMockComponent('FileList');

// Mock hooks
export const mockUseNotifications = vi.fn(() => ({
  notifications: [],
  addNotification: vi.fn(),
  removeNotification: vi.fn(),
  clearNotifications: vi.fn(),
}));

// Mock the entire UI package
vi.mock('@p2p/ui', () => ({
  Button: mockButton,
  Input: mockInput,
  Card: mockCard,
  Modal: mockModal,
  Notification: mockNotification,
  FileDropZone: mockFileDropZone,
  FileUpload: mockFileUpload,
  FileTransferComponent: mockFileTransferComponent,
  FileList: mockFileList,
  useNotifications: mockUseNotifications,
}));

// Reset all UI mocks
export const resetUIMocks = () => {
  mockButton.mockClear();
  mockInput.mockClear();
  mockCard.mockClear();
  mockModal.mockClear();
  mockNotification.mockClear();
  mockFileDropZone.mockClear();
  mockFileUpload.mockClear();
  mockFileTransferComponent.mockClear();
  mockFileList.mockClear();
  mockUseNotifications.mockClear();
};
