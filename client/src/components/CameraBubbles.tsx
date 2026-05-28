"use client";

/**
 * Camera Bubbles Component
 * Shows peer webcams as bubbles - supports floating (desktop) and horizontal row (mobile)
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
  layout?: "floating" | "horizontal";
}

const MAX_VISIBLE = 4;

const VideoBubble: React.FC<{
  stream: MediaStream;
  label: string;
  isMuted: boolean;
  isLocal?: boolean;
  size?: "sm" | "md";
}> = ({ stream, label, isMuted, isLocal, size = "md" }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const sizeClasses = size === "sm" ? "w-14 h-14" : "w-16 h-16";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${sizeClasses} rounded-2xl overflow-hidden border-2 ${
        isMuted ? "border-red-500/50" : "border-emerald-500/50"
      } shadow-lg`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
        {/* Mic indicator */}
        {isMuted && (
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </svg>
          </div>
        )}
        {!isMuted && (
          <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-dark-900" />
        )}
      </div>
      {/* Name label below */}
      <span className="text-[10px] text-gray-400 font-medium truncate max-w-[60px] text-center">
        {label}
      </span>
    </div>
  );
};

// Placeholder bubble (no camera, just initial)
const PlaceholderBubble: React.FC<{
  label: string;
  isMuted: boolean;
  isLocal?: boolean;
  isSpeaking?: boolean;
}> = ({ label, isMuted, isLocal, isSpeaking }) => {
  const initial = label.substring(0, 1).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative w-14 h-14 rounded-2xl overflow-hidden border-2 ${
        isSpeaking ? "border-emerald-400 animate-pulse" : isMuted ? "border-red-500/30" : "border-surface-glass-border"
      } bg-dark-700 flex items-center justify-center shadow-lg`}>
        <span className="text-white text-sm font-bold">{initial}</span>
        {/* Mic indicator */}
        {isMuted && (
          <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/80 rounded-full flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </svg>
          </div>
        )}
        {!isMuted && (
          <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-dark-900" />
        )}
      </div>
      <span className="text-[10px] text-gray-400 font-medium truncate max-w-[60px] text-center">
        {isLocal ? "You" : label}
      </span>
    </div>
  );
};

export const CameraBubbles: React.FC<CameraBubblesProps> = ({
  peers,
  localStream,
  isCameraOn,
  currentUserId,
  layout = "floating",
}) => {
  const activePeers = peers.filter((p) => p.stream && p.isCameraOn);
  const allPeers = peers;
  const visiblePeers = activePeers.slice(0, MAX_VISIBLE);
  const extraCount = activePeers.length - MAX_VISIBLE;

  // ===== HORIZONTAL LAYOUT (Mobile) =====
  if (layout === "horizontal") {
    // Show all connected peers (with or without camera) as bubbles
    const displayPeers = allPeers.slice(0, MAX_VISIBLE);
    const overflow = allPeers.length - MAX_VISIBLE;

    return (
      <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto border-b border-surface-glass-border bg-dark-900/40">
        {/* Local user bubble */}
        {isCameraOn && localStream ? (
          <VideoBubble
            stream={localStream}
            label="You"
            isMuted={false}
            isLocal
            size="sm"
          />
        ) : (
          <PlaceholderBubble
            label={currentUserId.substring(0, 1)}
            isMuted={false}
            isLocal
          />
        )}

        {/* Peer bubbles */}
        {displayPeers.map((peer) => (
          peer.stream && peer.isCameraOn ? (
            <VideoBubble
              key={peer.peerId}
              stream={peer.stream}
              label={peer.peerId.substring(0, 4)}
              isMuted={!peer.isMicOn}
              size="sm"
            />
          ) : (
            <PlaceholderBubble
              key={peer.peerId}
              label={peer.peerId.substring(0, 4)}
              isMuted={!peer.isMicOn}
            />
          )
        ))}

        {/* Overflow indicator */}
        {overflow > 0 && (
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-2xl bg-dark-700/80 border border-surface-glass-border flex items-center justify-center">
              <span className="text-xs text-gray-300 font-medium">+{overflow}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== FLOATING LAYOUT (Desktop - original) =====
  if (!isCameraOn && activePeers.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
      {/* Peer camera bubbles */}
      {visiblePeers.map((peer) => (
        <div key={peer.peerId} className="flex flex-col items-center">
          <div className={`relative w-20 h-20 rounded-full overflow-hidden border-2 ${!peer.isMicOn ? "border-red-500/50" : "border-emerald-500/50"} shadow-lg`}>
            <video
              autoPlay
              playsInline
              ref={(el) => {
                if (el && peer.stream) el.srcObject = peer.stream;
              }}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5">
              <span className="text-[8px] text-white font-medium truncate px-1">
                {`User ${peer.peerId.substring(0, 4)}`}
              </span>
            </div>
            {!peer.isMicOn && (
              <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Extra count badge */}
      {extraCount > 0 && (
        <div className="w-10 h-10 rounded-full bg-dark-700/80 border border-surface-glass-border flex items-center justify-center">
          <span className="text-xs text-gray-300 font-medium">+{extraCount}</span>
        </div>
      )}

      {/* Local camera preview */}
      {isCameraOn && localStream && (
        <VideoBubble
          stream={localStream}
          label="You"
          isMuted={false}
          isLocal
          size="sm"
        />
      )}
    </div>
  );
};
