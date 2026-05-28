/**
 * Upload Page (MVP2 - R2 Presigned URL Upload)
 * 
 * Flow:
 * 1. User selects file
 * 2. Call POST /api/upload/presign to get presigned URL
 * 3. Upload file directly to R2 using PUT
 * 4. Call POST /api/upload/complete when done
 * 5. Show processing progress via Socket.IO
 */

"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { socketClient } from "../../lib/socket";
import { VIDEO_UPLOAD_CONFIG, SOCKET_EVENTS } from "../../../shared/constants";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing" | "complete" | "error">("idle");
  const [message, setMessage] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

  // Listen for Socket.IO progress events
  useEffect(() => {
    socketClient.connect();

    const handleProcessingProgress = (data: any) => {
      if (videoId && data.videoId === videoId) {
        setUploadProgress(data.progress);
        setStage("processing");
        setMessage(`Processing: ${data.progress}%`);
      }
    };

    const handleProcessingComplete = (data: any) => {
      if (videoId && data.videoId === videoId) {
        setStage("complete");
        setUploadProgress(100);
        setMessage("Video ready for streaming!");
      }
    };

    const handleProcessingFailed = (data: any) => {
      if (videoId && data.videoId === videoId) {
        setStage("error");
        setMessage(data.error || "Processing failed");
      }
    };

    socketClient.on(SOCKET_EVENTS.PROCESSING_PROGRESS, handleProcessingProgress);
    socketClient.on(SOCKET_EVENTS.PROCESSING_COMPLETE, handleProcessingComplete);
    socketClient.on(SOCKET_EVENTS.PROCESSING_FAILED, handleProcessingFailed);

    return () => {
      socketClient.off(SOCKET_EVENTS.PROCESSING_PROGRESS, handleProcessingProgress);
      socketClient.off(SOCKET_EVENTS.PROCESSING_COMPLETE, handleProcessingComplete);
      socketClient.off(SOCKET_EVENTS.PROCESSING_FAILED, handleProcessingFailed);
    };
  }, [videoId]);

  /**
   * Validate file type and size
   */
  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid file type. Allowed: ${VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${(VIDEO_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(0)}GB`;
    }
    return null;
  };

  /**
   * Handle file selection
   */
  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setMessage(error);
      setStage("error");
      return;
    }
    setSelectedFile(file);
    setStage("idle");
    setMessage("");
  };

  /**
   * Handle drag events
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  /**
   * Upload the file using presigned URL flow
   */
  const handleUpload = async () => {
    if (!selectedFile) return;

    setStage("uploading");
    setUploadProgress(0);
    setMessage("Getting upload URL...");

    try {
      // Step 1: Get presigned URL from backend
      const presignRes = await fetch(`${API_URL}/api/upload/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type || "video/mp4",
          fileSize: selectedFile.size,
        }),
      });

      const presignData = await presignRes.json();

      if (!presignData.success) {
        setStage("error");
        setMessage(presignData.error || "Failed to get upload URL");
        return;
      }

      const { videoId: newVideoId, uploadUrl } = presignData.data;
      setVideoId(newVideoId);
      setMessage("Uploading to cloud...");

      // Step 2: Upload file directly to R2 using XMLHttpRequest for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
            setMessage(`Uploading: ${percent}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during upload"));
        };

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", selectedFile.type || "video/mp4");
        xhr.send(selectedFile);
      });

      // Step 3: Notify backend that upload is complete
      setMessage("Upload complete. Starting processing...");
      setStage("processing");
      setUploadProgress(0);

      const completeRes = await fetch(`${API_URL}/api/upload/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: newVideoId }),
      });

      const completeData = await completeRes.json();

      if (!completeData.success) {
        setStage("error");
        setMessage(completeData.error || "Failed to start processing");
        return;
      }

      setMessage("Processing video... This may take a few minutes.");
    } catch (error: any) {
      setStage("error");
      setMessage(error.message || "Upload failed");
    }
  };

  /**
   * Format file size
   */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload Video</h1>
          <p className="text-gray-400">
            Upload a video to convert it for streaming. Files upload directly to cloud storage.
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Supported formats: MP4, MKV, WebM, AVI, MOV (max 5GB)
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-700 hover:border-gray-500 hover:bg-gray-900/50"
          }`}
        >
          <div className="text-5xl mb-4">📁</div>
          <p className="text-lg font-medium mb-2">
            {isDragging ? "Drop your video here" : "Drag & drop a video file"}
          </p>
          <p className="text-gray-500 text-sm">or click to browse</p>
          <p className="text-gray-600 text-xs mt-2">
            Max size: 5GB • MP4, MKV, WebM, AVI, MOV
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={VIDEO_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
          className="hidden"
        />

        {/* Selected File Info */}
        {selectedFile && stage === "idle" && (
          <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">{formatSize(selectedFile.size)}</p>
              </div>
              <button
                onClick={handleUpload}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
              >
                Upload
              </button>
            </div>
          </div>
        )}

        {/* Progress */}
        {(stage === "uploading" || stage === "processing") && (
          <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {stage === "uploading" ? "Uploading to R2" : "Processing"}
              </span>
              <span className="text-sm text-gray-400">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  stage === "uploading" ? "bg-blue-500" : "bg-purple-500"
                }`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            {message && <p className="text-gray-400 text-sm mt-2">{message}</p>}
          </div>
        )}

        {/* Complete */}
        {stage === "complete" && (
          <div className="mt-6 p-4 bg-green-900/30 rounded-lg border border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xl">✓</span>
                <span className="font-medium text-green-300">Video ready for streaming!</span>
              </div>
              <button
                onClick={() => router.push("/library")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition"
              >
                Go to Library
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div className="mt-6 p-4 bg-red-900/30 rounded-lg border border-red-800">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-xl">✗</span>
              <span className="text-red-300">{message}</span>
            </div>
            <button
              onClick={() => {
                setStage("idle");
                setSelectedFile(null);
                setMessage("");
                setVideoId(null);
              }}
              className="mt-3 px-4 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            ← Back to Home
          </button>
          <button
            onClick={() => router.push("/library")}
            className="px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Video Library →
          </button>
        </div>
      </div>
    </div>
  );
}
