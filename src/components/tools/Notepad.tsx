import React, { useState, useCallback } from 'react';
import { Editor } from '../shared/Editor';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';

interface Tab { id: string; name: string; content: string; }

let tabCounter = 1;

export function Notepad() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 't1', name: 'New Tab', content: '' }]);
  const [activeId, setActiveId] = useState('t1');

  const activeTab = tabs.find(t => t.id === activeId)!;
  const text = activeTab?.content ?? '';

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const lineCount = text.split('\n').length;

  const addTab = () => {
    tabCounter++;
    const id = `t${tabCounter}`;
    setTabs(prev => [...prev, { id, name: 'New Tab', content: '' }]);
    setActiveId(id);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeId === id) {
      setActiveId(newTabs[Math.max(0, idx - 1)].id);
    }
  };

  const updateContent = useCallback((val: string) => {
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, content: val } : t));
  }, [activeId]);

  const clearAll = () => {
    setTabs(prev => prev.map(t => t.id === activeId ? { ...t, content: '' } : t));
  };

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
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={clearAll}>Clear</button>
        </div>
      </div>
    </div>
  );
}
