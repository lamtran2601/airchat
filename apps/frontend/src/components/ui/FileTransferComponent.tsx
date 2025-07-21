import React from 'react';
import {
  DocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { FileTransfer } from '../../types/p2p';
import { Button } from './Button';

interface FileTransferComponentProps {
  transfer: FileTransfer;
  onAccept?: (transferId: string) => void;
  onReject?: (transferId: string) => void;
  onCancel?: (transferId: string) => void;
}

export const FileTransferComponent: React.FC<FileTransferComponentProps> = ({
  transfer,
  onAccept,
  onReject,
  onCancel,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (transfer.status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'accepted':
      case 'transferring':
      case 'in-progress':
        return <ArrowDownTrayIcon className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
      case 'rejected':
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <DocumentIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (transfer.status) {
      case 'pending':
        return 'Waiting for response';
      case 'accepted':
        return 'Starting transfer...';
      case 'transferring':
      case 'in-progress':
        return `${transfer.progress}% complete`;
      case 'completed':
        return 'Transfer complete';
      case 'failed':
        return 'Transfer failed';
      case 'rejected':
        return 'Transfer rejected';
      case 'cancelled':
        return 'Transfer cancelled';
      default:
        return 'Unknown status';
    }
  };

  const showActions = transfer.status === 'pending';
  const showProgress =
    transfer.status === 'transferring' || transfer.status === 'in-progress';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <DocumentIcon className="h-8 w-8 text-gray-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 truncate">
                {transfer.fileName}
              </p>
              <p className="text-sm text-gray-500">
                {formatFileSize(transfer.fileSize)}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              {onCancel &&
                (transfer.status === 'pending' ||
                  transfer.status === 'transferring' ||
                  transfer.status === 'in-progress') && (
                  <button
                    onClick={() => onCancel(transfer.id)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Cancel transfer"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
            </div>
          </div>

          <div className="mt-2">
            <p className="text-xs text-gray-500">{getStatusText()}</p>

            {showProgress && (
              <div className="mt-2">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${transfer.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {showActions && (
            <div className="mt-3 flex space-x-2">
              {onAccept && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onAccept(transfer.id)}
                >
                  Accept
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onReject(transfer.id)}
                >
                  Reject
                </Button>
              )}
            </div>
          )}

          {transfer.error && (
            <div className="mt-2 text-xs text-red-600">
              Error: {transfer.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
