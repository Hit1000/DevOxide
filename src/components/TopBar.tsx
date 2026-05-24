import React, { useState } from 'react';
import { Icons } from './Icons';
import { usePersistedState } from '../hooks/useStore';

// Moon icon
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

interface TopBarProps {
  toolName: string;
  hint: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onGoHome?: () => void;
}

export function TopBar({ toolName, hint, theme, onToggleTheme, onGoHome }: TopBarProps) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const settingsRef = React.useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [textSize, setTextSize, textSizeLoaded] = usePersistedState<number>('devkit_text_size', 13);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  // Apply CSS var when text size changes and migrate legacy localStorage value
  React.useEffect(() => {
    // Always ensure there's a sensible default while store loads
    if (!textSizeLoaded) {
      document.documentElement.style.setProperty('--base-font-size', '13px');
      return;
    }

    // If store already has a non-default value, prefer it and remove legacy localStorage.
    const savedLocal = localStorage.getItem('devkit_text_size');
    if (savedLocal) {
      const localVal = parseInt(savedLocal, 10);
      if (textSize === 13) {
        // migrate to store
        setTextSize(localVal);
      }
      // cleanup legacy localStorage either way
      try { localStorage.removeItem('devkit_text_size'); } catch {}
    }

    document.documentElement.style.setProperty('--base-font-size', `${textSize}px`);
  }, [textSize, textSizeLoaded, setTextSize]);

  const changeTextSize = (delta: number) => {
    const newSize = Math.max(10, Math.min(24, textSize + delta));
    document.documentElement.style.setProperty('--base-font-size', `${newSize}px`);
    setTextSize(newSize);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          changeTextSize(1);
        } else if (e.key === '-') {
          e.preventDefault();
          changeTextSize(-1);
        }
      }
      if (e.altKey && e.key === '`') {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [textSize, onToggleTheme]);

  const handleToggle = async () => {
    if ('startViewTransition' in document && btnRef.current) {
      const btn = btnRef.current;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const halfW = Math.max(cx, window.innerWidth - cx);
      const halfH = Math.max(cy, window.innerHeight - cy);
      const endClip = `polygon(${cx - halfW}px ${cy - halfH}px, ${cx + halfW}px ${cy - halfH}px, ${cx + halfW}px ${cy + halfH}px, ${cx - halfW}px ${cy + halfH}px)`;
      const startClip = `polygon(${cx}px ${cy}px, ${cx}px ${cy}px, ${cx}px ${cy}px, ${cx}px ${cy}px)`;

      const transition = (document as any).startViewTransition(() => {
        onToggleTheme();
      });
      await transition.ready;
      document.documentElement.animate(
        { clipPath: [startClip, endClip] },
        { duration: 400, easing: 'ease-in-out', fill: 'forwards', pseudoElement: '::view-transition-new(root)' }
      );
    } else {
      onToggleTheme();
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-breadcrumb">
        <span onClick={onGoHome} style={{ cursor: 'pointer', transition: 'color 0.2s' }} className="hover:text-white">Tools</span>
        <span className="sep">›</span>
        <span className="current">{toolName}</span>
        {hint && <span className="topbar-hint">{hint}</span>}
      </div>
      <div className="topbar-actions" style={{ position: 'relative' }} ref={settingsRef}>
        <button ref={btnRef} className="icon-btn" onClick={handleToggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <span className="theme-icon">
            {theme === 'dark' ? <Icons.sun /> : <MoonIcon />}
          </span>
        </button>
        <button className="icon-btn" title="Settings" onClick={() => setShowSettings(!showSettings)}>
          <Icons.settings />
        </button>
        {showSettings && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
            padding: 8, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Text Size</span>
            <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => changeTextSize(-1)}>-</button>
            <span style={{ fontSize: 12, width: 20, textAlign: 'center' }}>{Math.round((textSize / 13) * 100)}%</span>
            <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => changeTextSize(1)}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}


// Reusable CopyButton
export function CopyBtn({ value, className = '' }: { value: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <button className={`icon-btn ${className}`} onClick={copy} title="Copy">
      {done ? <Icons.check /> : <Icons.copy />}
    </button>
  );
}

