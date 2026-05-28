"use client";

/**
 * Chat Panel Component
 * Real-time chat with emoji reactions
 */

import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../../shared/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

const QUICK_EMOJIS = ["😂", "❤️", "😱", "🔥", "👍"];

// Color palette for user messages
const USER_COLORS = [
  "text-blue-400",
  "text-purple-400",
  "text-emerald-400",
  "text-orange-400",
  "text-cyan-400",
  "text-pink-400",
  "text-amber-400",
  "text-violet-400",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentUserId,
  onSendMessage,
  onSendReaction,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userColorMap = useRef<Map<string, string>>(new Map());
  let colorIndex = 0;

  // Get consistent color for a user
  const getUserColor = (userId: string) => {
    if (!userColorMap.current.has(userId)) {
      userColorMap.current.set(userId, USER_COLORS[colorIndex % USER_COLORS.length]);
      colorIndex++;
    }
    return userColorMap.current.get(userId)!;
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput("");
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="glass-card rounded-2xl flex flex-col h-[400px] animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-glass-border">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          Chat
        </h3>
        <span className="text-[10px] text-gray-500">{messages.length} msgs</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-xs text-center">
              No messages yet.<br />Say hi! 👋
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] ${isMe ? "bg-primary-600/20 border-primary-500/20" : "bg-dark-700/60 border-surface-glass-border"} border rounded-xl px-3 py-2`}>
                {!isMe && (
                  <p className={`text-[10px] font-semibold mb-0.5 ${getUserColor(msg.userId)}`}>
                    User {msg.userId.substring(0, 6)}
                  </p>
                )}
                <p className="text-gray-200 text-sm leading-relaxed break-words">{msg.text}</p>
              </div>
              <span className="text-[9px] text-gray-600 mt-0.5 px-1">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Quick Reactions */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-surface-glass-border/50">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSendReaction(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-glass-hover transition-colors text-base hover:scale-125 active:scale-95"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-surface-glass-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 bg-dark-900/80 border border-surface-glass-border text-white text-sm px-3 py-2 rounded-xl placeholder-gray-500 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
    </div>
  );
};
