import React from 'react';

interface StatusBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function StatusBar({ left, right }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-secondary border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-4">{left}</div>
      <div className="flex items-center gap-4">{right}</div>
    </div>
  );
}
