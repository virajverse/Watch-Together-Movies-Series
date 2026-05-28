"use client";

/**
 * Chat Hook
 * Manages room chat messages and emoji reactions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { socketClient } from "../lib/socket";
import { SOCKET_EVENTS } from "../../shared/constants";
import type { ChatMessage, EmojiReaction } from "../../shared/types";

interface UseChatOptions {
  roomId: string;
  userId: string;
}

const MAX_MESSAGES = 100;
const MAX_REACTIONS = 10;

export function useChat({ roomId, userId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const reactionsTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !roomId || !userId) return;

      socketClient.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
        roomId,
        userId,
        text: text.trim(),
      });
    },
    [roomId, userId]
  );

  /**
   * Send an emoji reaction (floating)
   */
  const sendReaction = useCallback(
    (emoji: string) => {
      if (!roomId || !userId) return;

      socketClient.emit(SOCKET_EVENTS.EMOJI_REACTION, {
        roomId,
        userId,
        emoji,
      });
    },
    [roomId, userId]
  );

  /**
   * Socket event listeners
   */
  useEffect(() => {
    if (!roomId || !userId) return;

    // Receive chat message
    const handleMessage = (message: ChatMessage) => {
      setMessages((prev) => {
        const updated = [...prev, message];
        // Keep only last MAX_MESSAGES
        if (updated.length > MAX_MESSAGES) {
          return updated.slice(-MAX_MESSAGES);
        }
        return updated;
      });
    };

    // Receive emoji reaction
    const handleReaction = (reaction: EmojiReaction) => {
      setReactions((prev) => {
        const updated = [...prev, reaction];
        // Keep only MAX_REACTIONS at a time
        if (updated.length > MAX_REACTIONS) {
          return updated.slice(-MAX_REACTIONS);
        }
        return updated;
      });

      // Auto-remove reaction after 2.5 seconds (animation duration)
      const timeout = setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        reactionsTimeoutRef.current.delete(reaction.id);
      }, 2500);

      reactionsTimeoutRef.current.set(reaction.id, timeout);
    };

    socketClient.on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
    socketClient.on(SOCKET_EVENTS.EMOJI_REACTION, handleReaction);

    return () => {
      socketClient.off(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
      socketClient.off(SOCKET_EVENTS.EMOJI_REACTION, handleReaction);
    };
  }, [roomId, userId]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      reactionsTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
      reactionsTimeoutRef.current.clear();
    };
  }, []);

  return {
    messages,
    sendMessage,
    sendReaction,
    reactions,
  };
}
