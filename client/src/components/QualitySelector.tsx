/**
 * Quality Selector Component
 * Dropdown for selecting HLS stream quality
 */

"use client";

import React, { useState, useRef, useEffect } from "react";

interface QualitySelectorProps {
  qualities: string[];
  currentQuality: string;
  onQualityChange: (quality: string) => void;
}

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  qualities,
  currentQuality,
  onQualityChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allQualities = ["Auto", ...qualities];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-sm text-white bg-white/10 hover:bg-white/20 rounded transition"
        title="Video Quality"
      >
        <span className="text-xs">⚙</span>
        <span>{currentQuality === "auto" ? "Auto" : currentQuality}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[120px] z-50">
          {allQualities.map((quality) => {
            const value = quality === "Auto" ? "auto" : quality;
            const isActive = currentQuality === value;

            return (
              <button
                key={quality}
                onClick={() => {
                  onQualityChange(value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                {quality}
                {isActive && <span className="ml-2">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QualitySelector;
