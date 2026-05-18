import React, { useState } from 'react';
import { Icons } from './Icons';

export const tools = [
  { id: 'notepad',   name: 'Notepad',        icon: 'notepad',   category: 'TEXT TOOLS',     hint: 'CMD+S to save' },
  { id: 'regex',     name: 'Regex Tester',   icon: 'regex',     category: 'TEXT TOOLS',     hint: 'Live match highlighting' },
  { id: 'markdown',  name: 'Markdown',       icon: 'markdown',  category: 'TEXT TOOLS',     hint: 'CMD+S to save' },
  { id: 'json',      name: 'JSON Formatter', icon: 'json',      category: 'JSON TOOLS',     hint: 'CMD+Enter to format' },
  { id: 'url',       name: 'URL Encoder',    icon: 'url',       category: 'ENCODING TOOLS', hint: 'Auto-encodes on type' },
  { id: 'jwt',       name: 'JWT Decoder',    icon: 'jwt',       category: 'ENCODING TOOLS', hint: 'Paste token to decode' },
  { id: 'diff',      name: 'Diff Tool',      icon: 'diff',      category: 'DIFF TOOLS',     hint: 'CMD+Enter to diff' },
  { id: 'color',     name: 'Color Converter',icon: 'color',     category: 'MISC',           hint: 'Auto-detects format' },
  { id: 'hash',      name: 'Hash Generator', icon: 'hash',      category: 'MISC',           hint: 'CMD+Enter to generate' },
  { id: 'timestamp', name: 'Timestamp',      icon: 'timestamp', category: 'MISC',           hint: 'Auto-detects input' },
];

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const categories = Array.from(new Set(tools.map(t => t.category)));

  if (collapsed) {
    return (
      <div style={{ width: 48, minWidth: 48, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4, height: '100vh' }}>
        <button className="icon-btn" onClick={() => setCollapsed(false)} style={{ marginBottom: 8 }}>
          <Icons.chevronRight />
        </button>
        {tools.map(t => {
          const Icon = Icons[t.icon as keyof typeof Icons];
          return (
            <button
              key={t.id}
              className="icon-btn"
              onClick={() => onSelect(t.id)}
              style={{ color: active === t.id ? 'var(--text)' : 'var(--text-muted)', background: active === t.id ? 'var(--active-bg)' : undefined }}
              title={t.name}
            >
              <Icon />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ cursor: 'pointer' }} onClick={() => onSelect('')}>
        <div className="sidebar-logo">🐙</div>
        <span className="sidebar-title">Dev Oxide</span>
        <button className="sidebar-collapse" onClick={(e) => { e.stopPropagation(); setCollapsed(true); }}>
          <Icons.chevronLeft />
        </button>
      </div>

      <nav className="sidebar-nav">
        {categories.map(cat => (
          <div key={cat}>
            <div className="sidebar-section-label">{cat}</div>
            {tools.filter(t => t.category === cat).map(t => {
              const Icon = Icons[t.icon as keyof typeof Icons];
              return (
                <div
                  key={t.id}
                  className={`sidebar-item ${active === t.id ? 'active' : ''}`}
                  onClick={() => onSelect(t.id)}
                >
                  <Icon />
                  <span>{t.name}</span>
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
