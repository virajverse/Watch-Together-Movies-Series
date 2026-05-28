"use client";

/**
 * Media Controls Component
 * Voice/camera controls bar below video player
 */

import React from "react";

interface MediaControlsProps {
  isInVoice: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  permissionError?: string | null;
}

export const MediaControls: React.FC<MediaControlsProps> = ({
  isInVoice,
  isMicOn,
  isCameraOn,
  isSpeaking,
  onJoinVoice,
  onLeaveVoice,
  onToggleMic,
  onToggleCamera,
  permissionError,
}) => {
  return (
    <div className="glass-card rounded-xl p-3 animate-slide-up">
      <div className="flex items-center justify-center gap-3">
        {!isInVoice ? (
          /* Join Voice Button */
          <button
            onClick={onJoinVoice}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            Join Voice
          </button>
        ) : (
          <>
            {/* Mic Toggle */}
            <button
              onClick={onToggleMic}
              className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                isMicOn
                  ? "bg-dark-700 hover:bg-dark-600 text-white"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-400"
              }`}
              title={isMicOn ? "Mute mic" : "Unmute mic"}
            >
              {/* Speaking indicator ring */}
              {isMicOn && isSpeaking && (
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-pulse" />
              )}
              {isMicOn ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              )}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={onToggleCamera}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                isCameraOn
                  ? "bg-dark-700 hover:bg-dark-600 text-white"
                  : "bg-dark-700/60 hover:bg-dark-600 text-gray-400"
              }`}
              title={isCameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {isCameraOn ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.546-.546.146-1.479-.616-1.479H4.5a2.25 2.25 0 01-2.25-2.25V7.5m16.06.702a.75.75 0 00-1.28-.53l-4.72 4.72M3 3l18 18" />
                </svg>
              )}
            </button>

            {/* Leave Voice Button */}
            <button
              onClick={onLeaveVoice}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all"
              title="Leave voice"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Permission Error */}
      {permissionError && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-xs text-center">{permissionError}</p>
        </div>
      )}
    </div>
  );
};
