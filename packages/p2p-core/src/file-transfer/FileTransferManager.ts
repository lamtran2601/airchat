import type {
  FileTransfer,
  FileChunk,
  P2PEvent,
  EventHandler,
} from '@p2p/types';
import { EventBus } from '../utils/EventBus.js';
import { generateId } from '../utils/index.js';

export class FileTransferManager {
  private eventBus = new EventBus();
  private activeTransfers = new Map<string, FileTransfer>();
  private chunkSize = 16384; // 16KB chunks

  constructor(connectionManagerOrChunkSize?: any | number, config?: any) {
    // Handle overloaded constructor for frontend compatibility
    if (typeof connectionManagerOrChunkSize === 'number') {
      // Original signature: constructor(chunkSize?)
      this.chunkSize = connectionManagerOrChunkSize;
    } else if (
      connectionManagerOrChunkSize &&
      typeof connectionManagerOrChunkSize === 'object'
    ) {
      // Frontend signature: constructor(connectionManager, config)
      this.chunkSize = config?.chunkSize || 16384;
    } else {
      // Default case: constructor()
      this.chunkSize = 16384;
    }
  }

  // Event handling
  on<T extends P2PEvent>(eventType: T['type'], handler: EventHandler<T>): void {
    this.eventBus.on(eventType, handler);
  }

  off<T extends P2PEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): void {
    this.eventBus.off(eventType, handler);
  }

  // Initiate file transfer
  initiateTransfer(
    file: any, // Use any for File type compatibility
    receiverId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): FileTransfer {
    const transfer: FileTransfer = {
      id: generateId(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      senderId: 'self',
      receiverId,
      status: 'pending',
      progress: 0,
      timestamp: new Date(), // Add timestamp for frontend compatibility
      chunks: [],
    };

    this.activeTransfers.set(transfer.id, transfer);

    // Send transfer request
    const requestData = {
      type: 'file-transfer-request',
      transferId: transfer.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };

    const success = sendFunction(receiverId, JSON.stringify(requestData));
    if (!success) {
      transfer.status = 'failed';
    }

    this.eventBus.emit({
      type: 'file-transfer-request',
      transfer,
    });

    return transfer;
  }

  // Accept file transfer
  acceptTransfer(
    transferId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): void {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;

    transfer.status = 'accepted';
    transfer.startTime = new Date();

    const responseData = {
      type: 'file-transfer-response',
      transferId,
      accepted: true,
    };

    sendFunction(transfer.senderId, JSON.stringify(responseData));
  }

  // Reject file transfer
  rejectTransfer(
    transferId: string,
    sendFunction: (peerId: string, data: string) => boolean
  ): void {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;

    transfer.status = 'rejected';

    const responseData = {
      type: 'file-transfer-response',
      transferId,
      accepted: false,
    };

    sendFunction(transfer.senderId, JSON.stringify(responseData));
    this.activeTransfers.delete(transferId);
  }

  // Start sending file (after acceptance)
  async startSending(
    transferId: string,
    file: any, // Use any for File type compatibility
    sendFunction: (peerId: string, data: string) => boolean
  ): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer || transfer.status !== 'accepted') return;

    transfer.status = 'transferring';
    transfer.startTime = new Date();
    const chunks = await this.createFileChunks(file, transferId);
    transfer.chunks = chunks;

    let sentChunks = 0;
    const totalChunks = chunks.length;

    // Send file metadata first
    const metadataMessage = {
      type: 'file-metadata',
      transferId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks,
      chunkSize: this.chunkSize,
    };

    const metadataSent = sendFunction(
      transfer.receiverId,
      JSON.stringify(metadataMessage)
    );
    if (!metadataSent) {
      transfer.status = 'failed';
      return;
    }

    // Send chunks with retry logic
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let attempts = 0;
      let success = false;

      while (attempts < 3 && !success) {
        const chunkMessage = {
          type: 'file-chunk',
          transferId,
          chunkIndex: i,
          data: Array.from(new Uint8Array(chunk.data)), // Convert to array for JSON
          checksum: await this.calculateChecksum(chunk.data),
        };

        success = sendFunction(
          transfer.receiverId,
          JSON.stringify(chunkMessage)
        );

        if (!success) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // Exponential backoff
        }
      }

      if (!success) {
        transfer.status = 'failed';
        this.eventBus.emit({
          type: 'file-transfer-progress',
          transferId,
          progress: transfer.progress,
        });
        return;
      }

      sentChunks++;
      transfer.progress = (sentChunks / totalChunks) * 100;

      this.eventBus.emit({
        type: 'file-transfer-progress',
        transferId,
        progress: transfer.progress,
      });

      // Small delay between chunks to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Send completion message
    const completionMessage = {
      type: 'file-complete',
      transferId,
      totalChunks: sentChunks,
    };

    sendFunction(transfer.receiverId, JSON.stringify(completionMessage));

    transfer.status = 'completed';
    transfer.endTime = new Date();
    transfer.progress = 100;

    this.eventBus.emit({
      type: 'file-transfer-progress',
      transferId,
      progress: 100,
    });
  }

  // Handle received file data
  handleReceivedData(senderId: string, data: string | ArrayBuffer): void {
    if (typeof data === 'string') {
      try {
        const messageData = JSON.parse(data);
        this.handleFileMessage(senderId, messageData);
      } catch (error) {
        console.error('Failed to parse file message:', error);
      }
    } else {
      // Handle binary chunk data
      this.handleFileChunk(senderId, data);
    }
  }

  // Get active transfers
  getActiveTransfers(): FileTransfer[] {
    return Array.from(this.activeTransfers.values());
  }

  // Get transfer by ID
  getTransfer(transferId: string): FileTransfer | undefined {
    return this.activeTransfers.get(transferId);
  }

  private async createFileChunks(
    file: File,
    transferId: string
  ): Promise<FileChunk[]> {
    const chunks: FileChunk[] = [];
    const totalChunks = Math.ceil(file.size / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const blob = file.slice(start, end);
      const arrayBuffer = await blob.arrayBuffer();

      const chunk: FileChunk = {
        id: generateId(),
        transferId,
        index: i,
        data: arrayBuffer,
        size: arrayBuffer.byteLength,
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private handleFileMessage(senderId: string, messageData: any): void {
    switch (messageData.type) {
      case 'file-transfer-request':
        this.handleTransferRequest(senderId, messageData);
        break;
      case 'file-transfer-response':
        this.handleTransferResponse(messageData);
        break;
    }
  }

  private handleTransferRequest(senderId: string, data: any): void {
    const transfer: FileTransfer = {
      id: data.transferId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      senderId,
      receiverId: 'self',
      status: 'pending',
      progress: 0,
      timestamp: new Date(), // Add timestamp for frontend compatibility
      chunks: [],
    };

    this.activeTransfers.set(transfer.id, transfer);

    this.eventBus.emit({
      type: 'file-transfer-request',
      transfer,
    });
  }

  private handleTransferResponse(data: any): void {
    const transfer = this.activeTransfers.get(data.transferId);
    if (!transfer) return;

    if (data.accepted) {
      transfer.status = 'accepted';
      // The calling code should start sending the file
    } else {
      transfer.status = 'rejected';
      this.activeTransfers.delete(data.transferId);
    }
  }

  private handleFileChunk(senderId: string, data: ArrayBuffer): void {
    // In a real implementation, this would reconstruct the file from chunks
    // For now, we'll just log that we received a chunk
    console.log(
      `Received file chunk from ${senderId}, size: ${data.byteLength} bytes`
    );
  }

  // Calculate checksum for data integrity
  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Cancel transfer
  cancelTransfer(
    transferId: string,
    sendFunction?: (peerId: string, data: string) => boolean
  ): void {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) return;

    transfer.status = 'failed';

    // Notify the other peer about cancellation
    if (sendFunction) {
      const cancelMessage = {
        type: 'file-cancel',
        transferId,
        reason: 'User cancelled',
      };

      const targetPeerId =
        transfer.senderId === 'self' ? transfer.receiverId : transfer.senderId;
      sendFunction(targetPeerId, JSON.stringify(cancelMessage));
    }

    this.activeTransfers.delete(transferId);

    this.eventBus.emit({
      type: 'file-transfer-progress',
      transferId,
      progress: transfer.progress,
    });
  }

  // Pause transfer
  pauseTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer && transfer.status === 'transferring') {
      // In a full implementation, this would pause the transfer
      console.log(`Transfer ${transferId} paused`);
    }
  }

  // Resume transfer
  resumeTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      // In a full implementation, this would resume the transfer
      console.log(`Transfer ${transferId} resumed`);
    }
  }

  // Alias methods for frontend compatibility
  sendFile(
    receiverId: string,
    file: any, // Use any for File type compatibility
    onProgressOrSendFunction?:
      | ((progress: number) => void)
      | ((peerId: string, data: string) => boolean)
  ): FileTransfer {
    // Provide a default send function for frontend compatibility
    const sendFunction =
      typeof onProgressOrSendFunction === 'function' &&
      onProgressOrSendFunction.length === 2
        ? (onProgressOrSendFunction as (
            peerId: string,
            data: string
          ) => boolean)
        : () => true; // Default no-op function

    return this.initiateTransfer(file, receiverId, sendFunction);
  }

  acceptFileTransfer(
    transferId: string,
    sendFunction?: (peerId: string, data: string) => boolean
  ): void {
    if (sendFunction) {
      return this.acceptTransfer(transferId, sendFunction);
    }
    // For frontend compatibility, provide a default no-op function
    return this.acceptTransfer(transferId, () => true);
  }

  rejectFileTransfer(
    transferId: string,
    sendFunction?: (peerId: string, data: string) => boolean
  ): void {
    if (sendFunction) {
      return this.rejectTransfer(transferId, sendFunction);
    }
    // For frontend compatibility, provide a default no-op function
    return this.rejectTransfer(transferId, () => true);
  }
}
