import type { Message, P2PEvent, EventHandler } from '@p2p/types';
import { EventBus } from '../utils/EventBus.js';
import { generateId } from '../utils/index.js';

interface MessageQueue {
  [peerId: string]: Message[];
}

interface DeliveryTracker {
  [messageId: string]: {
    message: Message;
    attempts: number;
    lastAttempt: Date;
    delivered: boolean;
  };
}

export class MessageHandler {
  private eventBus = new EventBus();
  private messageQueue: MessageQueue = {};
  private deliveryTracker: DeliveryTracker = {};
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private connectionManager?: any; // Optional connection manager for frontend compatibility

  constructor(connectionManager?: any) {
    this.connectionManager = connectionManager;
    this.startDeliveryRetryLoop();
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

  // Send a text message (overloaded for frontend compatibility)
  sendMessage(
    peerId: string,
    content: string,
    replyToOrSendFunction?:
      | string
      | ((peerId: string, data: string) => boolean),
    replyTo?: string
  ): Message {
    // Handle overloaded parameters
    let sendFunction: (peerId: string, data: string) => boolean;
    let actualReplyTo: string | undefined;

    if (typeof replyToOrSendFunction === 'function') {
      // Original signature: sendMessage(peerId, content, sendFunction, replyTo?)
      sendFunction = replyToOrSendFunction;
      actualReplyTo = replyTo;
    } else {
      // Frontend signature: sendMessage(peerId, content, replyTo?)
      actualReplyTo = replyToOrSendFunction;
      // Use connection manager if available, otherwise provide a default
      sendFunction =
        this.connectionManager?.sendData?.bind(this.connectionManager) ||
        (() => {
          console.warn('No send function available for message delivery');
          return false;
        });
    }
    const message: Message = {
      id: generateId(),
      senderId: 'self', // This will be set by the calling code
      content,
      timestamp: new Date(),
      type: 'text',
      status: 'sending',
      replyTo: actualReplyTo,
    };

    // Add to queue
    if (!this.messageQueue[peerId]) {
      this.messageQueue[peerId] = [];
    }
    this.messageQueue[peerId].push(message);

    // Try to send immediately
    this.attemptMessageDelivery(peerId, message, sendFunction);

    return message;
  }

  // Handle received message
  handleReceivedMessage(peerId: string, data: string): void {
    try {
      const messageData = JSON.parse(data);

      if (messageData.type === 'message') {
        const message: Message = {
          id: messageData.id,
          senderId: peerId,
          content: messageData.content,
          timestamp: new Date(messageData.timestamp),
          type: messageData.messageType || 'text',
          status: 'delivered',
          replyTo: messageData.replyTo,
        };

        // Send delivery confirmation
        this.sendDeliveryConfirmation(peerId, message.id);

        // Emit message received event
        this.eventBus.emit({
          type: 'message-received',
          message,
        });
      } else if (messageData.type === 'delivery-confirmation') {
        this.handleDeliveryConfirmation(messageData.messageId);
      }
    } catch (error) {
      console.error('Failed to parse received message:', error);
    }
  }

  // Get message history for a peer
  getMessageHistory(peerId: string): Message[] {
    return this.messageQueue[peerId] || [];
  }

  // Get all messages
  getAllMessages(): Message[] {
    const allMessages: Message[] = [];
    Object.values(this.messageQueue).forEach(messages => {
      allMessages.push(...messages);
    });
    return allMessages.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  // Mark message as read
  markMessageAsRead(messageId: string): void {
    for (const messages of Object.values(this.messageQueue)) {
      const message = messages.find(m => m.id === messageId);
      if (message && message.status === 'delivered') {
        // In a full implementation, this would update the message status
        console.log(`Message ${messageId} marked as read`);
        break;
      }
    }
  }

  // Clear message history for a peer
  clearMessageHistory(peerId: string): void {
    delete this.messageQueue[peerId];
  }

  // Clear all message history
  clearAllMessageHistory(): void {
    this.messageQueue = {};
    this.deliveryTracker = {};
  }

  private attemptMessageDelivery(
    peerId: string,
    message: Message,
    sendFunction: (peerId: string, data: string) => boolean
  ): void {
    const messageData = {
      type: 'message',
      id: message.id,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      messageType: message.type,
      replyTo: message.replyTo,
    };

    const success = sendFunction(peerId, JSON.stringify(messageData));

    if (success) {
      message.status = 'sent';

      // Track for delivery confirmation
      this.deliveryTracker[message.id] = {
        message,
        attempts: 1,
        lastAttempt: new Date(),
        delivered: false,
      };
    } else {
      message.status = 'failed';

      // Add to retry queue
      this.deliveryTracker[message.id] = {
        message,
        attempts: 1,
        lastAttempt: new Date(),
        delivered: false,
      };
    }
  }

  private sendDeliveryConfirmation(peerId: string, messageId: string): void {
    const confirmationData = {
      type: 'delivery-confirmation',
      messageId,
      timestamp: new Date().toISOString(),
    };

    // This would use the same send function, but we don't have access to it here
    // In a real implementation, this would be handled by the connection manager
    console.log(
      `Sending delivery confirmation for message ${messageId} to peer ${peerId}`
    );
  }

  private handleDeliveryConfirmation(messageId: string): void {
    const tracker = this.deliveryTracker[messageId];
    if (tracker) {
      tracker.delivered = true;
      tracker.message.status = 'delivered';

      // Remove from tracking
      delete this.deliveryTracker[messageId];

      console.log(`Message ${messageId} delivered successfully`);
    }
  }

  private startDeliveryRetryLoop(): void {
    setInterval(() => {
      const now = new Date();

      for (const [messageId, tracker] of Object.entries(this.deliveryTracker)) {
        if (tracker.delivered) continue;

        const timeSinceLastAttempt =
          now.getTime() - tracker.lastAttempt.getTime();
        const shouldRetry =
          timeSinceLastAttempt >= this.retryDelay &&
          tracker.attempts < this.maxRetries;

        if (shouldRetry) {
          tracker.attempts++;
          tracker.lastAttempt = now;

          // In a real implementation, this would retry sending the message
          console.log(
            `Retrying message ${messageId} (attempt ${tracker.attempts})`
          );

          if (tracker.attempts >= this.maxRetries) {
            tracker.message.status = 'failed';
            console.log(
              `Message ${messageId} failed after ${this.maxRetries} attempts`
            );
          }
        }
      }
    }, this.retryDelay);
  }
}
