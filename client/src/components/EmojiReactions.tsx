"use client";

/**
 * Emoji Reactions Overlay
 * Floating emojis that animate upward and fade out over the video player
 */

import React, { useEffect, useState } from "react";
import type { EmojiReaction } from "../../shared/types";

interface EmojiReactionsProps {
  reactions: EmojiReaction[];
}

interface AnimatedEmoji {
  id: string;
  emoji: string;
  x: number; // random horizontal position (%)
  startTime: number;
}

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({ reactions }) => {
  const [animatedEmojis, setAnimatedEmojis] = useState<AnimatedEmoji[]>([]);

  // When new reactions come in, add them to animated list
  useEffect(() => {
    if (reactions.length === 0) return;

    const latest = reactions[reactions.length - 1];
    if (!latest) return;

    // Check if we already have this reaction animating
    setAnimatedEmojis((prev) => {
      if (prev.find((e) => e.id === latest.id)) return prev;

      const newEmoji: AnimatedEmoji = {
        id: latest.id,
        emoji: latest.emoji,
        x: 10 + Math.random() * 80, // Random x between 10-90%
        startTime: Date.now(),
      };

      // Keep max 10
      const updated = [...prev, newEmoji].slice(-10);
      return updated;
    });

    // Remove after animation completes (2.5s)
    const timeout = setTimeout(() => {
      setAnimatedEmojis((prev) => prev.filter((e) => e.id !== latest.id));
    }, 2500);

    return () => clearTimeout(timeout);
  }, [reactions]);

  if (animatedEmojis.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {animatedEmojis.map((emoji) => (
        <div
          key={emoji.id}
          className="absolute bottom-0 animate-emoji-float"
          style={{
            left: `${emoji.x}%`,
            animationDuration: "2s",
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
          }}
        >
          <span className="text-3xl md:text-4xl drop-shadow-lg">{emoji.emoji}</span>
        </div>
      ))}
    </div>
  );
};
