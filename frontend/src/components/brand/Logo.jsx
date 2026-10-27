/**
 * AIDRS Logo — Minimal SVG symbol
 * Professional geospatial/emergency-response identity.
 * A shield with a satellite-scan crosshair motif.
 */
import React from 'react';

const SIZE_MAP = { small: 20, medium: 28, large: 48, xl: 64 };

const Logo = ({ size = 28, color = 'currentColor', className = '' }) => {
  const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 28);
  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="AIDRS Logo"
  >
    {/* Shield outline */}
    <path
      d="M16 2L4 8v8c0 7.18 5.12 13.88 12 16 6.88-2.12 12-8.82 12-16V8L16 2z"
      stroke={color}
      strokeWidth="1.8"
      fill="none"
      opacity="0.3"
    />
    {/* Inner shield fill */}
    <path
      d="M16 4L6 9v7c0 6.08 4.27 11.74 10 13.55C21.73 27.74 26 22.08 26 16V9L16 4z"
      fill={color}
      opacity="0.12"
    />
    {/* Crosshair - horizontal */}
    <line x1="9" y1="16" x2="23" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    {/* Crosshair - vertical */}
    <line x1="16" y1="9" x2="16" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    {/* Center target circle */}
    <circle cx="16" cy="16" r="3.5" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Scan pulse */}
    <circle cx="16" cy="16" r="6.5" stroke={color} strokeWidth="1" fill="none" opacity="0.35" strokeDasharray="3 2" />
    </svg>
  );
};

export default Logo;
