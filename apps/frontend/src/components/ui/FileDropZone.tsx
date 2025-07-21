import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';

interface FileDropZoneProps {
  onFileDrop: (files: File[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileDrop,
  disabled = false,
  children,
  className,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileDrop(files);
    }
  }, [disabled, onFileDrop]);

  return (
    <div
      className={clsx(
        'relative',
        isDragOver && !disabled && 'bg-blue-50',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragOver && !disabled && (
        <div className="absolute inset-0 bg-blue-100 bg-opacity-75 flex items-center justify-center z-10 border-2 border-dashed border-blue-400 rounded-lg">
          <div className="text-center">
            <div className="text-blue-600 text-lg font-medium">
              Drop files here to send
            </div>
            <div className="text-blue-500 text-sm mt-1">
              Release to upload
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
