import React from "react";

/**
 * TQI Logo — Talent Quest for India
 * Exact recreation of the official logo:
 * - White circle with teal border
 * - Orange lowercase "t"
 * - Dark navy circular magnifier "Q" with colorful tree inside
 * - Green lowercase "i"
 */
export function TqiLogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      className={className}
      alt="TQI logo"
      aria-label="TQI Logo"
    />
  );
}

// Larger version for login page hero
export function TqiLogo({ size = 56, className = "" }: { size?: number; className?: string }) {
  return <TqiLogoMark size={size} className={className} />;
}
