import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Editor } from '../shared/Editor';
import { CopyBtn } from '../TopBar';
import { usePersistedState } from '../../hooks/useStore';

interface Tab { id: string; name: string; content: string; }

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const newTab = (): Tab => ({
  id: generateId(),
  name: 'New Tab',
  content: '',
});

const DEFAULT_STATE = {
  tabs: [{ id: generateId(), name: 'New Tab', content: '' }] as Tab[],
  activeTabId: '',
};
DEFAULT_STATE.activeTabId = DEFAULT_STATE.tabs[0].id;

export function Notepad() {
  const [tabsData, setTabsData, loaded] = usePersistedState<{ tabs: Tab[]; activeTabId: string }>(
    'notepad_tabs',
    DEFAULT_STATE,
    500
  );

  const tabs = Array.isArray(tabsData?.tabs) && tabsData.tabs.length > 0
    ? tabsData.tabs
    : DEFAULT_STATE.tabs;
  const activeId = tabsData?.activeTabId || tabs[0].id;

  // Heal corrupt state on load
  useEffect(() => {
    if (!loaded) return;
    const seen = new Set<string>();
    const deduped = tabs.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    const safeActive = deduped.find(t => t.id === activeId)
      ? activeId
      : deduped[0]?.id ?? '';
    if (deduped.length !== (tabsData?.tabs?.length || 0) || safeActive !== tabsData?.activeTabId) {
      setTabsData({ tabs: deduped, activeTabId: safeActive });
    }
  }, [loaded]);

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];
  const text = activeTab?.content ?? '';

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const lineCount = text.split('\n').length;

  const addTab = () => {
    const tab = newTab();
    setTabsData({ tabs: [...tabs, tab], activeTabId: tab.id });
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    const newActive = activeId === id ? newTabs[Math.max(0, idx - 1)].id : activeId;
    setTabsData({ tabs: newTabs, activeTabId: newActive });
  };

  const updateContent = useCallback((val: string) => {
    setTabsData({
      tabs: tabs.map(t => t.id === activeId ? { ...t, content: val } : t),
      activeTabId: activeId,
    });
  }, [activeId, tabs]);

  const clearAll = () => updateContent('');

  // ── Pointer-based drag reorder (works in Tauri WebView2) ──
  const [dragState, setDragState] = useState<{ sourceId: string; overIdx: number } | null>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // Only start drag from the grip handle
    if (!(e.target as HTMLElement).dataset.grip) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const sourceIdx = tabs.findIndex(t => t.id === id);
    setDragState({ sourceId: id, overIdx: sourceIdx });

    const onMove = (ev: PointerEvent) => {
      // Find which tab element the pointer is over
      for (const [tabId, el] of tabRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          const idx = tabs.findIndex(t => t.id === tabId);
          setDragState(prev => prev ? { ...prev, overIdx: idx } : null);
          break;
        }
      }
    };

    const onUp = () => {
      setDragState(prev => {
        if (prev) {
          const srcIdx = tabs.findIndex(t => t.id === prev.sourceId);
          const tgtIdx = prev.overIdx;
          if (srcIdx !== -1 && tgtIdx !== -1 && srcIdx !== tgtIdx) {
            const newTabs = [...tabs];
            const [moved] = newTabs.splice(srcIdx, 1);
            newTabs.splice(tgtIdx, 0, moved);
            setTabsData({ tabs: newTabs, activeTabId: activeId });
          }
        }
        return null;
      });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Rename ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const saveEdit = () => {
    if (editingId) {
      setTabsData({
        tabs: tabs.map(t => t.id === editingId ? { ...t, name: editValue.trim() || 'Untitled' } : t),
        activeTabId: activeId,
      });
      setEditingId(null);
    }
  };

  const scrollTabs = (dir: 1 | -1) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 150, behavior: 'smooth' });
  };

  if (!loaded) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {tabs.length > 5 && (
          <button className="icon-btn" style={{ width: 24, height: 37, borderRadius: 0 }} onClick={() => scrollTabs(-1)}>‹</button>
        )}
        <div className="tab-bar" ref={scrollRef} style={{ borderBottom: 'none', background: 'transparent', flex: 1, padding: '0 4px' }}>
          {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              ref={el => { if (el) tabRefs.current.set(tab.id, el); else tabRefs.current.delete(tab.id); }}
              className={`tab-item ${tab.id === activeId ? 'active' : ''}`}
              onClick={() => setTabsData({ tabs, activeTabId: tab.id })}
              onDoubleClick={() => { setEditingId(tab.id); setEditValue(tab.name); }}
              onPointerDown={e => handlePointerDown(e, tab.id)}
              style={{
                opacity: dragState?.sourceId === tab.id ? 0.4 : 1,
                outline: dragState && dragState.sourceId !== tab.id && dragState.overIdx === idx
                  ? '2px solid var(--accent)' : 'none',
                transition: 'opacity 0.1s',
              }}
            >
              <span data-grip="true" style={{ fontSize: 13, marginRight: 2, cursor: 'grab', touchAction: 'none' }}>⠿</span>
              {editingId === tab.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--accent)',
                    borderRadius: 4, padding: '0 4px', fontSize: 12, outline: 'none',
                    width: Math.min(150, Math.max(60, editValue.length * 8)),
                  }}
                />
              ) : (
                <span className="tab-item-name" title={tab.name}>{tab.name}</span>
              )}
              {tabs.length > 1 && (
                <span
                  onClick={e => closeTab(tab.id, e)}
                  style={{ marginLeft: 4, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1, cursor: 'pointer' }}
                >×</span>
              )}
            </div>
          ))}
          <button className="tab-add" onClick={addTab}>
            <span style={{ fontSize: 14 }}>+</span> Add
          </button>
        </div>
        {tabs.length > 5 && (
          <button className="icon-btn" style={{ width: 24, height: 37, borderRadius: 0 }} onClick={() => scrollTabs(1)}>›</button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <Editor value={text} onChange={updateContent} placeholder="Start typing..." height="100%" />
      </div>

      <div className="status-bar">
        <div className="status-left">
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
          <span>{lineCount} lines</span>
        </div>
        <div className="status-right">
          <span><span className="status-dot green"></span>Saved</span>
          <CopyBtn value={text} />
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={clearAll}>Clear</button>
        </div>
      </div>
    </div>
  );
}
