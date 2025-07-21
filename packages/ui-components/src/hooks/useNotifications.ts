import { useState, useCallback } from 'react';
import type { Notification } from '@p2p/types';

const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((
    type: Notification['type'],
    title: string,
    message: string,
    options?: {
      autoClose?: boolean;
      duration?: number;
    }
  ) => {
    const notification: Notification = {
      id: generateId(),
      type,
      title,
      message,
      timestamp: new Date(),
      autoClose: options?.autoClose ?? true,
      duration: options?.duration ?? 5000,
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove notification if autoClose is enabled
    if (notification.autoClose) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration);
    }

    return notification.id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message: string, options?: { autoClose?: boolean; duration?: number }) => {
    return addNotification('success', title, message, options);
  }, [addNotification]);

  const error = useCallback((title: string, message: string, options?: { autoClose?: boolean; duration?: number }) => {
    return addNotification('error', title, message, options);
  }, [addNotification]);

  const warning = useCallback((title: string, message: string, options?: { autoClose?: boolean; duration?: number }) => {
    return addNotification('warning', title, message, options);
  }, [addNotification]);

  const info = useCallback((title: string, message: string, options?: { autoClose?: boolean; duration?: number }) => {
    return addNotification('info', title, message, options);
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    success,
    error,
    warning,
    info,
  };
};
