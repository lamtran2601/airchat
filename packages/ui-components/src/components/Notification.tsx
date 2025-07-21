import React from 'react';
import clsx from 'clsx';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  XCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import type { Notification as NotificationType } from '@p2p/types';

interface NotificationProps {
  notification: NotificationType;
  onClose?: (id: string) => void;
}

export const Notification: React.FC<NotificationProps> = ({
  notification,
  onClose,
}) => {
  const { id, type, title, message } = notification;

  const typeConfig = {
    success: {
      icon: CheckCircleIcon,
      bgColor: 'bg-success-50',
      iconColor: 'text-success-400',
      titleColor: 'text-success-800',
      messageColor: 'text-success-700',
    },
    error: {
      icon: XCircleIcon,
      bgColor: 'bg-error-50',
      iconColor: 'text-error-400',
      titleColor: 'text-error-800',
      messageColor: 'text-error-700',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-warning-50',
      iconColor: 'text-warning-400',
      titleColor: 'text-warning-800',
      messageColor: 'text-warning-700',
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-primary-50',
      iconColor: 'text-primary-400',
      titleColor: 'text-primary-800',
      messageColor: 'text-primary-700',
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={clsx('rounded-md p-4', config.bgColor)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={clsx('h-5 w-5', config.iconColor)} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={clsx('text-sm font-medium', config.titleColor)}>
            {title}
          </h3>
          <div className={clsx('mt-1 text-sm', config.messageColor)}>
            <p>{message}</p>
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                className={clsx(
                  'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  config.iconColor,
                  'hover:' + config.bgColor,
                  'focus:ring-offset-' + config.bgColor.split('-')[1] + '-50',
                  'focus:ring-' + config.iconColor.split('-')[1] + '-600'
                )}
                onClick={() => onClose(id)}
              >
                <span className="sr-only">Dismiss</span>
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
