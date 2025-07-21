import React, { useState, useCallback, useRef } from 'react';
import clsx from 'clsx';
import { CloudArrowUpIcon, DocumentIcon } from '@heroicons/react/24/outline';

interface FileDropZoneProps {
  onFileDrop: (files: File[]) => void;
  onFileSelect?: (files: File[]) => void;
  disabled?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  acceptedTypes?: string[];
  className?: string;
  children?: React.ReactNode;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileDrop,
  onFileSelect,
  disabled = false,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  maxFiles = 10,
  acceptedTypes = [],
  className,
  children,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFiles = (files: File[]): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File size exceeds ${formatFileSize(maxFileSize)} limit`);
        continue;
      }

      // Check file type
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
        errors.push(`${file.name}: File type not supported`);
        continue;
      }

      validFiles.push(file);
    }

    // Check max files
    if (validFiles.length > maxFiles) {
      errors.push(`Too many files. Maximum ${maxFiles} files allowed.`);
      return validFiles.slice(0, maxFiles);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    return validFiles;
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragOver(false);
      }
      return newCounter;
    });
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setIsDragOver(false);
    setDragCounter(0);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onFileDrop(validFiles);
    }
  }, [disabled, onFileDrop, validateFiles]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onFileSelect?.(validFiles);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={clsx(
        'relative border-2 border-dashed rounded-lg transition-colors duration-200',
        isDragOver && !disabled
          ? 'border-primary-400 bg-primary-50'
          : 'border-gray-300 hover:border-gray-400',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={maxFiles > 1}
        onChange={handleFileInputChange}
        disabled={disabled}
        className="hidden"
        accept={acceptedTypes.join(',')}
      />
      
      {children || (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <CloudArrowUpIcon 
            className={clsx(
              'h-12 w-12 mb-4',
              isDragOver ? 'text-primary-500' : 'text-gray-400'
            )} 
          />
          <p className="text-lg font-medium text-gray-900 mb-2">
            {isDragOver ? 'Drop files here' : 'Drop files to share'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            or click to select files
          </p>
          <div className="text-xs text-gray-400 space-y-1">
            {maxFileSize && (
              <p>Maximum file size: {formatFileSize(maxFileSize)}</p>
            )}
            {maxFiles > 1 && (
              <p>Maximum {maxFiles} files</p>
            )}
            {acceptedTypes.length > 0 && (
              <p>Accepted types: {acceptedTypes.join(', ')}</p>
            )}
          </div>
        </div>
      )}
      
      {isDragOver && (
        <div className="absolute inset-0 bg-primary-500 bg-opacity-10 rounded-lg pointer-events-none" />
      )}
    </div>
  );
};

interface FileListProps {
  files: File[];
  onRemove?: (index: number) => void;
  showRemove?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onRemove,
  showRemove = true,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <DocumentIcon className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </div>
          </div>
          {showRemove && onRemove && (
            <button
              onClick={() => onRemove(index)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <span className="sr-only">Remove file</span>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
