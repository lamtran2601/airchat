import React, { useRef } from 'react';
import { Button } from './Button';
import { 
  DocumentIcon, 
  ArrowUpTrayIcon, 
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import type { FileTransfer } from '@p2p/types';
import clsx from 'clsx';

interface FileTransferProps {
  transfer: FileTransfer;
  onAccept?: (transferId: string) => void;
  onReject?: (transferId: string) => void;
  onCancel?: (transferId: string) => void;
  onRetry?: (transferId: string) => void;
}

export const FileTransferComponent: React.FC<FileTransferProps> = ({
  transfer,
  onAccept,
  onReject,
  onCancel,
  onRetry,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTransferSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const getStatusColor = (status: FileTransfer['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'accepted':
        return 'text-blue-600 bg-blue-50';
      case 'transferring':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'rejected':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: FileTransfer['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <DocumentIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const isIncoming = transfer.receiverId === 'self';
  const isPending = transfer.status === 'pending';
  const isTransferring = transfer.status === 'transferring';
  const isCompleted = transfer.status === 'completed';
  const isFailed = transfer.status === 'failed';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start space-x-3">
        {/* File Icon */}
        <div className="flex-shrink-0">
          {getStatusIcon(transfer.status)}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 truncate">
              {transfer.fileName}
            </p>
            <span
              className={clsx(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                getStatusColor(transfer.status)
              )}
            >
              {transfer.status}
            </span>
          </div>

          <div className="mt-1 flex items-center space-x-2 text-sm text-gray-500">
            <span>{formatFileSize(transfer.fileSize)}</span>
            <span>•</span>
            <span>{isIncoming ? 'from' : 'to'} {isIncoming ? transfer.senderId : transfer.receiverId}</span>
          </div>

          {/* Progress Bar */}
          {(isTransferring || isCompleted) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {Math.round(transfer.progress)}% complete
                </span>
                {transfer.startTime && transfer.endTime && (
                  <span className="text-gray-500">
                    {Math.round((transfer.endTime.getTime() - transfer.startTime.getTime()) / 1000)}s
                  </span>
                )}
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={clsx(
                    'h-2 rounded-full transition-all duration-300',
                    isCompleted ? 'bg-green-500' : 'bg-blue-500'
                  )}
                  style={{ width: `${transfer.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-3 flex items-center space-x-2">
            {isPending && isIncoming && (
              <>
                <Button
                  size="sm"
                  onClick={() => onAccept?.(transfer.id)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onReject?.(transfer.id)}
                >
                  Reject
                </Button>
              </>
            )}

            {isTransferring && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onCancel?.(transfer.id)}
              >
                Cancel
              </Button>
            )}

            {isFailed && (
              <Button
                size="sm"
                onClick={() => onRetry?.(transfer.id)}
              >
                Retry
              </Button>
            )}

            {isCompleted && (
              <Button
                size="sm"
                variant="secondary"
              >
                Download
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  maxFileSize?: number;
  acceptedTypes?: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  disabled = false,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  acceptedTypes = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize) {
      alert(`File size exceeds ${Math.round(maxFileSize / (1024 * 1024))}MB limit`);
      return;
    }

    // Validate file type
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      alert('File type not supported');
      return;
    }

    onFileSelect(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        accept={acceptedTypes.join(',')}
      />
      <Button
        onClick={handleClick}
        disabled={disabled}
        variant="secondary"
        size="sm"
      >
        <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
        Send File
      </Button>
    </div>
  );
};
