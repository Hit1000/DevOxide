import React, { useState } from 'react';
import { Icons } from './Icons';

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
}

export function TopBar({ toolName, hint, theme, onToggleTheme }: TopBarProps) {
  const btnRef = React.useRef<HTMLButtonElement>(null);

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
        <span>Tools</span>
        <span className="sep">›</span>
        <span className="current">{toolName}</span>
        {hint && <span className="topbar-hint">{hint}</span>}
      </div>
      <div className="topbar-actions">
        <button ref={btnRef} className="icon-btn" onClick={handleToggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <span className="theme-icon">
            {theme === 'dark' ? <Icons.sun /> : <MoonIcon />}
          </span>
        </button>
        <button className="icon-btn" title="Settings">
          <Icons.settings />
        </button>
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

