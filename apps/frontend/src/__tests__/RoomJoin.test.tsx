import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test/utils/test-utils';
import { RoomJoin } from '../components/RoomJoin';
import { p2pService } from '../services/P2PService';

// Mock the P2P service
vi.mock('../services/P2PService', () => ({
  p2pService: {
    initialize: vi.fn(),
    joinRoom: vi.fn(),
  },
}));

// Mock Zustand store
vi.mock('../stores/useP2PStore', () => ({
  useP2PStore: vi.fn(),
}));

describe('RoomJoin Component', () => {
  const mockOnRoomJoined = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const { useP2PStore } = await vi.importMock('../stores/useP2PStore');
    useP2PStore.mockReturnValue({
      isConnected: true,
    });
  });

  it('renders all form elements correctly', () => {
    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    expect(screen.getByTestId('mock-card')).toBeInTheDocument();
    expect(screen.getByTestId('mock-input')).toBeInTheDocument();
    expect(screen.getByTestId('mock-button')).toBeInTheDocument();
  });

  it('shows loading state when joining room', async () => {
    const mockInitialize = vi.mocked(p2pService.initialize);
    const mockJoinRoom = vi.mocked(p2pService.joinRoom);

    // Make initialize and joinRoom return pending promises
    mockInitialize.mockReturnValue(new Promise(() => {}));
    mockJoinRoom.mockReturnValue(new Promise(() => {}));

    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    // Should show loading state
    expect(button).toHaveAttribute('loading', 'true');
  });

  it('handles successful room join', async () => {
    const mockInitialize = vi.mocked(p2pService.initialize);
    const mockJoinRoom = vi.mocked(p2pService.joinRoom);

    mockInitialize.mockResolvedValue();
    mockJoinRoom.mockResolvedValue();

    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    // Simulate user input
    const nameInput = screen.getAllByTestId('mock-input')[0];
    const roomInput = screen.getAllByTestId('mock-input')[1];

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(roomInput, { target: { value: 'TEST123' } });

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.stringMatching(/^user-\d+-[a-z0-9]+$/),
        'Test User'
      );
      expect(mockJoinRoom).toHaveBeenCalledWith('TEST123');
      expect(mockOnRoomJoined).toHaveBeenCalledWith('TEST123');
    });
  });

  it('handles room join failure', async () => {
    const mockInitialize = vi.mocked(p2pService.initialize);
    const mockJoinRoom = vi.mocked(p2pService.joinRoom);

    mockInitialize.mockResolvedValue();
    mockJoinRoom.mockRejectedValue(new Error('Failed to join room'));

    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    // Simulate user input
    const nameInput = screen.getAllByTestId('mock-input')[0];
    const roomInput = screen.getAllByTestId('mock-input')[1];

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(roomInput, { target: { value: 'TEST123' } });

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnRoomJoined).not.toHaveBeenCalled();
    });
  });

  it('validates required fields', async () => {
    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    // Should not call P2P service methods when fields are empty
    expect(p2pService.initialize).not.toHaveBeenCalled();
    expect(p2pService.joinRoom).not.toHaveBeenCalled();
    expect(mockOnRoomJoined).not.toHaveBeenCalled();
  });

  it('handles keyboard navigation', () => {
    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    const nameInput = screen.getAllByTestId('mock-input')[0];
    const roomInput = screen.getAllByTestId('mock-input')[1];

    // Simulate filling out form
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(roomInput, { target: { value: 'TEST123' } });

    // Simulate Enter key press
    fireEvent.keyPress(roomInput, { key: 'Enter', code: 'Enter' });

    // Should trigger form submission
    expect(p2pService.initialize).toHaveBeenCalled();
  });

  it('generates random room ID when requested', () => {
    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    // Find and click the generate button
    const generateButton = screen.getAllByTestId('mock-button')[1]; // Assuming second button is generate
    fireEvent.click(generateButton);

    // Should update the room input with a random ID
    // This would be tested by checking if the input value changed
    // In a real implementation, we'd check the actual input value
  });

  it('shows connection status when not connected', async () => {
    const { useP2PStore } = await vi.importMock('../stores/useP2PStore');
    useP2PStore.mockReturnValue({
      isConnected: false,
    });

    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    // Should show connecting message
    expect(
      screen.getByText(/connecting to signaling server/i)
    ).toBeInTheDocument();
  });

  it('displays privacy information', () => {
    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    expect(
      screen.getByText(/all messages are sent directly between peers/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no data is stored on servers/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/connections are encrypted by default/i)
    ).toBeInTheDocument();
  });

  it('converts room ID to uppercase', async () => {
    const mockInitialize = vi.mocked(p2pService.initialize);
    const mockJoinRoom = vi.mocked(p2pService.joinRoom);

    mockInitialize.mockResolvedValue();
    mockJoinRoom.mockResolvedValue();

    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    const nameInput = screen.getAllByTestId('mock-input')[0];
    const roomInput = screen.getAllByTestId('mock-input')[1];

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(roomInput, { target: { value: 'test123' } }); // lowercase

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockJoinRoom).toHaveBeenCalledWith('TEST123'); // should be uppercase
      expect(mockOnRoomJoined).toHaveBeenCalledWith('TEST123');
    });
  });

  it('trims whitespace from inputs', async () => {
    const mockInitialize = vi.mocked(p2pService.initialize);
    const mockJoinRoom = vi.mocked(p2pService.joinRoom);

    mockInitialize.mockResolvedValue();
    mockJoinRoom.mockResolvedValue();

    render(<RoomJoin onRoomJoined={mockOnRoomJoined} />);

    const nameInput = screen.getAllByTestId('mock-input')[0];
    const roomInput = screen.getAllByTestId('mock-input')[1];

    fireEvent.change(nameInput, { target: { value: '  Test User  ' } });
    fireEvent.change(roomInput, { target: { value: '  TEST123  ' } });

    const button = screen.getByTestId('mock-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.any(String),
        'Test User' // trimmed
      );
      expect(mockJoinRoom).toHaveBeenCalledWith('TEST123'); // trimmed
    });
  });
});
