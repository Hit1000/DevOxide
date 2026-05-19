import React, { useCallback, useEffect, useRef } from 'react';
import { Editor } from '../shared/Editor';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';
import { usePersistedState } from '../../hooks/useStore';

interface Tab { id: string; name: string; content: string; }

const DEFAULT_TAB: Tab = { id: 't1', name: 'New Tab', content: '' };

export function Notepad() {
  const [tabsData, setTabsData, loaded] = usePersistedState<{ tabs: Tab[]; activeTabId: string }>(
    'notepad_tabs',
    { tabs: [DEFAULT_TAB], activeTabId: 't1' },
    500 // debounce 500ms for content changes
  );

  const tabs     = tabsData.tabs;
  const activeId = tabsData.activeTabId;

  const setTabs     = (newTabs: Tab[]) => setTabsData({ tabs: newTabs, activeTabId: activeId });
  const setActiveId = (newId: string)  => setTabsData({ tabs, activeTabId: newId });

  // Generate unique IDs
  const counterRef = useRef(Math.max(...(tabsData.tabs.map(t => parseInt(t.id.slice(1)) || 0)), 1));

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];
  const text = activeTab?.content ?? '';

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const lineCount = text.split('\n').length;

  const addTab = () => {
    counterRef.current++;
    const id = `t${counterRef.current}`;
    const newTabs = [...tabs, { id, name: 'New Tab', content: '' }];
    setTabsData({ tabs: newTabs, activeTabId: id });
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const idx    = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    const newActiveId = activeId === id ? newTabs[Math.max(0, idx - 1)].id : activeId;
    setTabsData({ tabs: newTabs, activeTabId: newActiveId });
  };

  const updateContent = useCallback((val: string) => {
    setTabsData({
      tabs: tabs.map(t => t.id === activeId ? { ...t, content: val } : t),
      activeTabId: activeId,
    });
  }, [activeId, tabs]);

  const clearAll = () => updateContent('');

  if (!loaded) return null; // Don't flash empty state before store loads

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            <span style={{ fontSize: 13, marginRight: 2 }}>⠿</span>
            {tab.name}
            {tabs.length > 1 && (
              <span
                onClick={e => closeTab(tab.id, e)}
                style={{ marginLeft: 4, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1 }}
              >×</span>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={addTab}>
          <span style={{ fontSize: 14 }}>+</span> Add
        </button>
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
