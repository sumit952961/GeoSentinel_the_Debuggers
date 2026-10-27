/**
 * AIDRS — Loading Spinner (Redesigned)
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const LoadingSpinner = ({ size = 'medium', message = 'Loading...', fullPage = false }) => {
  const { tokens, isDark } = useTheme();
  const sizeMap = { small: 18, medium: 28, large: 40 };
  const iconSize = sizeMap[size] || sizeMap.medium;

  const containerStyle = fullPage
    ? {
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: isDark ? 'rgba(12, 17, 29, 0.85)' : 'rgba(255,255,255,0.85)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, backdropFilter: 'blur(4px)',
      }
    : {
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '32px',
      };

  return (
    <div style={containerStyle}>
      <style>{`@keyframes aidrs-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <Loader2
        size={iconSize}
        color={tokens.accent}
        strokeWidth={2}
        style={{ animation: 'aidrs-spin 1s linear infinite' }}
      />
      {message && (
        <p style={{
          marginTop: '12px', color: tokens.textSec, fontWeight: 500,
          fontSize: '13px', letterSpacing: '0.01em',
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
