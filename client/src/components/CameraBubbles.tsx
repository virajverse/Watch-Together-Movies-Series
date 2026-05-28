"use client";

/**
 * Camera Bubbles Component
 * Small floating video bubbles showing peer webcams
 */

import React, { useEffect, useRef } from "react";

interface PeerBubble {
  peerId: string;
  stream?: MediaStream;
  isMicOn: boolean;
  isCameraOn: boolean;
}

interface CameraBubblesProps {
  peers: PeerBubble[];
  localStream: MediaStream | null;
  isCameraOn: boolean;
  currentUserId: string;
}

const MAX_VISIBLE = 4;

const VideoBubble: React.FC<{
  stream: MediaStream;
  label: string;
  isMuted: boolean;
  isLocal?: boolean;
}> = ({ stream, label, isMuted, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative ${isLocal ? "w-16 h-16" : "w-20 h-20"} rounded-full overflow-hidden border-2 ${isMuted ? "border-red-500/50" : "border-emerald-500/50"} shadow-lg`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />
      {/* Name label */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5">
        <span className="text-[8px] text-white font-medium truncate px-1">
          {label}
        </span>
      </div>
      {/* Muted indicator */}
      {isMuted && (
        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const CameraBubbles: React.FC<CameraBubblesProps> = ({
  peers,
  localStream,
  isCameraOn,
  currentUserId,
}) => {
  // Filter peers with active camera streams
  const activePeers = peers.filter((p) => p.stream && p.isCameraOn);
  const visiblePeers = activePeers.slice(0, MAX_VISIBLE);
  const extraCount = activePeers.length - MAX_VISIBLE;

  // Don't render if no one has camera on
  if (!isCameraOn && activePeers.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
      {/* Peer camera bubbles */}
      {visiblePeers.map((peer) => (
        <VideoBubble
          key={peer.peerId}
          stream={peer.stream!}
          label={`User ${peer.peerId.substring(0, 4)}`}
          isMuted={!peer.isMicOn}
        />
      ))}

      {/* Extra count badge */}
      {extraCount > 0 && (
        <div className="w-10 h-10 rounded-full bg-dark-700/80 border border-surface-glass-border flex items-center justify-center">
          <span className="text-xs text-gray-300 font-medium">+{extraCount}</span>
        </div>
      )}

      {/* Local camera preview (smaller, at bottom) */}
      {isCameraOn && localStream && (
        <VideoBubble
          stream={localStream}
          label="You"
          isMuted={false}
          isLocal
        />
      )}
    </div>
  );
};
