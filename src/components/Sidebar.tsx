import React, { useMemo, useRef, useState } from 'react';
import { Icons } from './Icons';

export const tools = [
  { id: 'notepad',   name: 'Notepad',        icon: 'notepad',   category: 'TEXT TOOLS',     hint: 'CMD+S to save' },
  { id: 'regex',     name: 'Regex Tester',   icon: 'regex',     category: 'TEXT TOOLS',     hint: 'Live match highlighting' },
  { id: 'markdown',  name: 'Markdown',       icon: 'markdown',  category: 'TEXT TOOLS',     hint: 'CMD+S to save' },
  { id: 'json',      name: 'JSON Formatter', icon: 'json',      category: 'JSON TOOLS',     hint: 'CMD+Enter to format' },
  { id: 'url',       name: 'URL Encoder',    icon: 'url',       category: 'ENCODING TOOLS', hint: 'Auto-encodes on type' },
  { id: 'jwt',       name: 'JWT Decoder',    icon: 'jwt',       category: 'ENCODING TOOLS', hint: 'Paste token to decode' },
  { id: 'diff',      name: 'Diff Tool',      icon: 'diff',      category: 'DIFF TOOLS',     hint: 'CMD+Enter to diff' },
  { id: 'zipdiff',   name: 'Zip Diff',       icon: 'diff',      category: 'DIFF TOOLS',     hint: 'Compare ZIPs and folders' },
  { id: 'color',     name: 'Color Converter',icon: 'color',     category: 'MISC',           hint: 'Auto-detects format' },
  { id: 'hash',      name: 'Hash Generator', icon: 'hash',      category: 'MISC',           hint: 'CMD+Enter to generate' },
  { id: 'timestamp', name: 'Timestamp',      icon: 'timestamp', category: 'MISC',           hint: 'Auto-detects input' },
];

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  theme?: 'dark' | 'light';
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ active, onSelect, theme = 'dark', collapsed, onToggleCollapsed }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categories = Array.from(new Set(tools.map(t => t.category)));
  const logoUrl = theme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg';
  const normalizedQuery = search.trim().toLowerCase();
  const searchActive = normalizedQuery.length > 0;

  const filteredTools = useMemo(() => {
    if (!normalizedQuery) return tools;
    return tools.filter(tool => {
      return (
        tool.name.toLowerCase().includes(normalizedQuery) ||
        tool.hint.toLowerCase().includes(normalizedQuery) ||
        tool.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery]);

  const handleSelect = (id: string) => {
    setSearch('');
    setFocused(false);
    setHovered(false);
    onSelect(id);
  };

  const searchBackground = focused
    ? (theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#ffffff')
    : hovered
      ? (theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)')
      : (theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)');

  const searchBorder = focused
    ? '1.5px solid var(--accent, #3b82f6)'
    : '1.5px solid transparent';

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="sidebar-header"
        style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '0' : '8px 10px', gap: collapsed ? 0 : 6 }}
      >
        {!collapsed ? (
          <div
            className="sidebar-search-wrap"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: 1,
              height: 34,
              borderRadius: 7,
              padding: '0 10px',
              cursor: 'text',
              transition: 'background 0.15s, border 0.15s',
              background: searchBackground,
              border: searchBorder,
              boxSizing: 'border-box',
            }}
            onClick={() => searchInputRef.current?.focus()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              style={{ flexShrink: 0, color: 'var(--text-muted)', opacity: focused ? 0.6 : 0.45 }}
              aria-hidden="true"
            >
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            <input
              ref={searchInputRef}
              id="sidebar-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={focused ? '' : 'Search tools...'}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12.5,
                color: 'var(--text)',
                caretColor: 'var(--accent, #3b82f6)',
                minWidth: 0,
              }}
              aria-label="Search tools"
            />

            {search && (
              <button
                onMouseDown={e => { e.preventDefault(); setSearch(''); searchInputRef.current?.focus(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: 0,
                  opacity: 0.5,
                  flexShrink: 0,
                }}
                aria-label="Clear search"
                title="Clear search"
                type="button"
              >×</button>
            )}
          </div>
        ) : null}
        <button 
          className="icon-btn" 
          onClick={(e) => { e.stopPropagation(); onToggleCollapsed(); }}
          style={{ margin: collapsed ? '8px auto' : 0 }}
        >
          {collapsed ? <Icons.chevronRight /> : <Icons.chevronLeft />}
        </button>
      </div>

      <nav className="sidebar-nav" style={{ padding: collapsed ? '8px 0' : undefined }}>
        {collapsed ? (
          categories.map(cat => {
            const categoryTools = filteredTools.filter(t => t.category === cat);
            if (categoryTools.length === 0) return null;

            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {categoryTools.map(t => {
                  const Icon = Icons[t.icon as keyof typeof Icons];
                  return (
                    <button
                      key={t.id}
                      className="icon-btn"
                      onClick={() => handleSelect(t.id)}
                      style={{ 
                        color: active === t.id ? 'var(--text)' : 'var(--text-muted)', 
                        background: active === t.id ? 'var(--active-bg)' : undefined,
                        marginBottom: 4
                      }}
                      title={t.name}
                    >
                      <Icon />
                    </button>
                  );
                })}
              </div>
            );
          })
        ) : searchActive ? (
          filteredTools.length > 0 ? (
            filteredTools.map(t => {
              const Icon = Icons[t.icon as keyof typeof Icons];
              return (
                <div
                  key={t.id}
                  className={`sidebar-item ${active === t.id ? 'active' : ''}`}
                  onClick={() => handleSelect(t.id)}
                >
                  <Icon />
                  <span>{t.name}</span>
                </div>
              );
            })
          ) : (
            <div className="sidebar-empty-state">No tools found</div>
          )
        ) : (
          categories.map(cat => {
            const categoryTools = tools.filter(t => t.category === cat);
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="sidebar-section-label">{cat}</div>
                {categoryTools.map(t => {
                  const Icon = Icons[t.icon as keyof typeof Icons];
                  return (
                    <div
                      key={t.id}
                      className={`sidebar-item ${active === t.id ? 'active' : ''}`}
                      onClick={() => handleSelect(t.id)}
                    >
                      <Icon />
                      <span>{t.name}</span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
