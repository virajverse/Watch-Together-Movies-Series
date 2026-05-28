/**
 * Quality Selector Component
 * Floating dropdown with glass effect for HLS quality selection
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
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-500/30 rounded-lg transition-all duration-200"
        title="Video Quality"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
        <span className="font-medium">{currentQuality === "auto" ? "Auto" : currentQuality}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 glass-card rounded-xl overflow-hidden min-w-[140px] z-50 animate-slide-down shadow-glass-lg">
          <div className="p-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium px-3 py-1.5">
              Quality
            </p>
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
                  className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-all duration-150 flex items-center justify-between ${
                    isActive
                      ? "bg-primary-500/20 text-primary-300"
                      : "text-gray-300 hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{quality}</span>
                  {isActive && (
                    <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default QualitySelector;
