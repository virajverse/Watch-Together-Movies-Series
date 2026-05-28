/**
 * Upload Page (MVP2 - R2 Presigned URL Upload)
 * Premium upload experience with animated states
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

  // Circular progress for processing
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (uploadProgress / 100) * circumference;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-3">Upload Video</h1>
          <p className="text-gray-400 text-base">
            Upload a video to convert it for streaming with friends
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card rounded-2xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 group ${
            isDragging
              ? "border-primary-500/50 bg-primary-500/5 shadow-glow-sm scale-[1.01]"
              : "hover:border-primary-500/30 hover:bg-surface-glass-hover"
          }`}
        >
          {/* Upload Icon */}
          <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            isDragging
              ? "bg-primary-500/20 scale-110"
              : "bg-dark-700/50 group-hover:bg-primary-500/10 group-hover:scale-105"
          }`}>
            <svg className={`w-10 h-10 transition-colors duration-300 ${isDragging ? "text-primary-400" : "text-gray-400 group-hover:text-primary-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </div>

          <p className="text-lg font-medium text-white mb-2">
            {isDragging ? "Drop your video here" : "Drag & drop a video file"}
          </p>
          <p className="text-gray-500 text-sm mb-4">or click to browse</p>

          {/* Format pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["MP4", "MKV", "WebM", "AVI", "MOV"].map((fmt) => (
              <span key={fmt} className="text-[10px] font-medium text-gray-500 bg-dark-700/50 px-2.5 py-1 rounded-full border border-surface-glass-border">
                {fmt}
              </span>
            ))}
            <span className="text-[10px] text-gray-600">• Max 5GB</span>
          </div>
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
          <div className="mt-6 glass-card rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white text-sm truncate max-w-[200px] md:max-w-[300px]">{selectedFile.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{formatSize(selectedFile.size)}</p>
                </div>
              </div>
              <button
                onClick={handleUpload}
                className="btn-primary text-sm px-5 py-2.5"
              >
                Upload
              </button>
            </div>
          </div>
        )}

        {/* Progress - Upload or Processing */}
        {(stage === "uploading" || stage === "processing") && (
          <div className="mt-6 glass-card rounded-2xl p-6 animate-slide-up">
            <div className="flex items-center gap-5">
              {/* Circular Progress */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke={stage === "uploading" ? "#6366f1" : "#8b5cf6"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{uploadProgress}%</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="text-white font-semibold text-sm mb-1">
                  {stage === "uploading" ? "Uploading to Cloud" : "Processing Video"}
                </p>
                <p className="text-gray-400 text-xs mb-3">{message}</p>
                {/* Linear progress bar */}
                <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stage === "uploading"
                        ? "bg-gradient-to-r from-primary-600 to-primary-400"
                        : "bg-gradient-to-r from-purple-600 to-purple-400"
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {stage === "processing" && (
              <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs">
                <svg className="w-3.5 h-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L6.75 2.906m12.058 14.96l-1.149-.964M5.106 6.214l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514" />
                </svg>
                Transcoding to multiple qualities...
              </div>
            )}
          </div>
        )}

        {/* Complete */}
        {stage === "complete" && (
          <div className="mt-6 glass-card rounded-2xl p-6 border-emerald-500/20 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-emerald-300">Video ready!</p>
                  <p className="text-gray-400 text-xs mt-0.5">Available for streaming in rooms</p>
                </div>
              </div>
              <button
                onClick={() => router.push("/library")}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-colors shadow-glow-green"
              >
                View Library
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div className="mt-6 glass-card rounded-2xl p-5 border-red-500/20 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-red-300 text-sm font-medium">{message}</p>
              </div>
              <button
                onClick={() => {
                  setStage("idle");
                  setSelectedFile(null);
                  setMessage("");
                  setVideoId(null);
                }}
                className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-center gap-6">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Home
          </button>
          <span className="text-dark-600">•</span>
          <button
            onClick={() => router.push("/library")}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5" />
            </svg>
            Library
          </button>
        </div>
      </div>
    </div>
  );
}
