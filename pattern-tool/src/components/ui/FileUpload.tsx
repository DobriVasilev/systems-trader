"use client";

import { useState, useRef, useCallback } from "react";

interface UploadedFile {
  id: string;
  url: string;
  type: string;
  name: string;
  size: number;
}

interface FileUploadProps {
  onUpload: (files: UploadedFile[]) => void;
  context?: string;
  contextId?: string;
  maxFiles?: number;
  accept?: string;
  disabled?: boolean;
}

export function FileUpload({
  onUpload,
  context,
  contextId,
  maxFiles = 5,
  accept = "image/*,application/pdf",
  disabled = false,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;

      const fileArray = Array.from(files);
      if (uploadedFiles.length + fileArray.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      setIsUploading(true);
      setError(null);

      const newFiles: UploadedFile[] = [];

      for (const file of fileArray) {
        const formData = new FormData();
        formData.append("file", file);
        if (context) formData.append("context", context);
        if (contextId) formData.append("contextId", contextId);

        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (data.success) {
            newFiles.push(data.data);
          } else {
            setError(data.error);
          }
        } catch (err) {
          console.error("Upload error:", err);
          setError("Failed to upload file");
        }
      }

      if (newFiles.length > 0) {
        const updated = [...uploadedFiles, ...newFiles];
        setUploadedFiles(updated);
        onUpload(updated);
      }

      setIsUploading(false);
    },
    [disabled, uploadedFiles, maxFiles, context, contextId, onUpload]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  const removeFile = useCallback(
    (id: string) => {
      const updated = uploadedFiles.filter((f) => f.id !== id);
      setUploadedFiles(updated);
      onUpload(updated);
    },
    [uploadedFiles, onUpload]
  );

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                   transition-colors ${
                     dragActive
                       ? "border-blue-500 bg-blue-500/10"
                       : disabled
                       ? "border-gray-700 bg-gray-800/50 cursor-not-allowed"
                       : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
                   }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          disabled={disabled || isUploading}
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : (
          <div className="text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm">
              Drop files here or <span className="text-blue-400">browse</span>
            </p>
            <p className="text-xs mt-1">Max 5MB per file. Images and PDFs.</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg"
            >
              {/* Preview */}
              {file.type.startsWith("image/") ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-10 h-10 rounded object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
              </div>

              {/* Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
