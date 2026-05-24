import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '../shared/Editor';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';
import { usePersistedState } from '../../hooks/useStore';

// ── Client-side JSON repair (mirrors Tools/lib/parser/jsonParser.ts) ──────────
interface ParseResult {
  formatted: string;
  success: boolean;
  repaired: boolean;
  errorMsg?: string;
  errorLine?: number;
}

import { jsonrepair } from 'jsonrepair';

function getErrorLocation(input: string, pos: number) {
  const lines = input.substring(0, pos).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function parseAndFormat(raw: string, indent: number, sortKeys: boolean, minify: boolean): ParseResult {
  if (!raw.trim()) return { formatted: '', success: false, repaired: false };

  const formatObj = (parsed: any, isRepaired: boolean) => {
    if (sortKeys) parsed = deepSortKeys(parsed);
    const formatted = minify ? JSON.stringify(parsed, null, 0) : JSON.stringify(parsed, null, indent);
    return { formatted, success: true, repaired: isRepaired };
  };

  let repairedStr = raw;
  let parsedAST: any = null;
  let wasRepaired = false;
  let successParse = false;

  // 1. Try strict JSON
  try {
    parsedAST = JSON.parse(raw);
    successParse = true;
  } catch (e1) {
    // 2. Try single jsonrepair
    try {
      repairedStr = jsonrepair(raw);
      parsedAST = JSON.parse(repairedStr);
      successParse = true;
      wasRepaired = true;
    } catch (e2) {
      // 3. Try wrapping in array (NDJSON) and repairing
      try {
        let wrapped = raw.replace(/\}\s*,?\s*\{/g, '}, {');
        wrapped = `[${wrapped}]`;
        repairedStr = jsonrepair(wrapped);
        parsedAST = JSON.parse(repairedStr);
        successParse = true;
        wasRepaired = true;
      } catch (e3) {
        // failed all parsing
      }
    }
  }

  // If we got an AST, we can sort keys and format perfectly
  if (successParse) {
    return formatObj(parsedAST, wasRepaired);
  }

  // Fallback to token-based formatting for completely invalid/truncated JSON that even jsonrepair can't fix
  let tokenFormatted = raw;
  try {
    tokenFormatted = formatWithTokens(raw, indent);
  } catch (e) {}

  // Get accurate error location from raw parse failure
  let errorMsg = 'Could not parse JSON';
  let errorLine = undefined;
  try {
    JSON.parse(raw);
  } catch (e2: any) {
    const m = String(e2.message).match(/position (\d+)/);
    if (m) {
      const pos = parseInt(m[1]);
      const { line, col } = getErrorLocation(raw, pos);
      errorMsg = `Line ${line}:${col} — ${e2.message}`;
      errorLine = line;
    } else {
      errorMsg = e2.message;
    }
  }

  return {
    formatted: tokenFormatted,
    success: false,
    repaired: false,
    errorMsg,
    errorLine,
  };
}

// ── Fallback Tokenizer ────────────────────────────────────────────────────────

type Token = { type: string; value: string };

function formatWithTokens(input: string, indentSize: number): string {
  const tokens: Token[] = [];
  let position = 0;

  while (position < input.length) {
    const char = input[position];

    if (/\s/.test(char)) {
      let value = '';
      while (position < input.length && /\s/.test(input[position])) value += input[position++];
      tokens.push({ type: 'whitespace', value });
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = char;
      position++;
      while (position < input.length && input[position] !== quote) {
        if (input[position] === '\\') {
          value += input[position] + (input[position + 1] || '');
          position += 2;
        } else {
          value += input[position++];
        }
      }
      if (position < input.length) value += input[position++];
      tokens.push({ type: 'string', value });
      continue;
    }

    if (/[0-9\-]/.test(char)) {
      let value = '';
      while (position < input.length && /[0-9.eE\-+]/.test(input[position])) value += input[position++];
      tokens.push({ type: 'number', value });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (position < input.length && /[a-zA-Z0-9_]/.test(input[position])) value += input[position++];
      tokens.push({ type: 'key', value });
      continue;
    }

    const single = { ':': 'colon', ',': 'comma', '{': 'brace', '}': 'brace', '[': 'bracket', ']': 'bracket' } as Record<string, string>;
    if (single[char]) {
      tokens.push({ type: single[char], value: char });
      position++;
      continue;
    }

    tokens.push({ type: 'unknown', value: char });
    position++;
  }

  let result = '';
  let indentLevel = 0;
  const ind = ' '.repeat(indentSize);
  let newline = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;

    if (token.type === 'brace' || token.type === 'bracket') {
      if (token.value === '{' || token.value === '[') {
        result += token.value;
        indentLevel++;
        result += '\n' + ind.repeat(indentLevel);
        newline = true;
      } else {
        indentLevel = Math.max(0, indentLevel - 1);
        result += '\n' + ind.repeat(indentLevel) + token.value;
        newline = false;
      }
    } else if (token.type === 'comma') {
      result += ',';
      result += '\n' + ind.repeat(indentLevel);
      newline = true;
    } else if (token.type === 'colon') {
      result += ': ';
    } else {
      if (newline) result += ind.repeat(indentLevel);
      result += token.value;
      newline = false;
    }
  }

  return result;
}

function deepSortKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc: any, k) => {
      acc[k] = deepSortKeys(obj[k]);
      return acc;
    }, {});
  }
  return obj;
}

// ── Sample ────────────────────────────────────────────────────────────────────
const SAMPLE = `{
  name: 'Dev Oxide',
  version: '1.0.0',
  tools: ["JSON Formatter", "Regex Tester", "Diff Tool",],
  active: true,
  // auto-repairs trailing commas, unquoted keys, single quotes
  stats: {
    users: 1234,
    rating: 4.9
  }
}`;

type Tab = { id: string; name: string; content: string; isAutoNamed?: boolean };

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const getNextTabNumber = (tabs: Tab[]) => {
  const used = new Set<number>();
  for (const tab of tabs) {
    if (tab.isAutoNamed === false) continue;
    const m = tab.name.match(/^New Tab\s+(\d+)$/i);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n++;
  return n;
};

const migrateTabNames = (tabs: Tab[]) => {
  const result: Tab[] = [];
  for (const tab of tabs) {
    if (/^New Tab$/i.test(tab.name) && tab.isAutoNamed !== false) {
      const n = getNextTabNumber(result.concat(tabs.slice(result.length)));
      result.push({ ...tab, name: `New Tab ${n}`, isAutoNamed: true });
    } else {
      result.push(tab);
    }
  }
  return result;
};

const newTab = (tabs: Tab[]): Tab => {
  const n = getNextTabNumber(tabs);
  return { id: generateId(), name: `New Tab ${n}`, content: '', isAutoNamed: true };
};

const makeDefaultTabsState = () => {
  const id = generateId();
  return { tabs: [{ id, name: 'New Tab 1', content: '', isAutoNamed: true }] as Tab[], activeTabId: id };
};

// ── Component ─────────────────────────────────────────────────────────────────
export function JsonFormatter() {
  const [tabsData, setTabsData, tabsLoaded]  = usePersistedState<{ tabs: Tab[]; activeTabId: string }>(
    'json_formatter_tabs',
    makeDefaultTabsState(),
    500
  );
  const [output, setOutput]                  = useState('');
  const [result, setResult]                  = useState<ParseResult | null>(null);
  const [indent, setIndent, indentLoaded]    = usePersistedState<number>('json_formatter_indent', 2);
  const [sortKeys, setSortKeys, sortLoaded]  = usePersistedState<boolean>('json_formatter_sort', false);
  const [minify, setMinify, minifyLoaded]    = usePersistedState<boolean>('json_formatter_minify', false);
  const [showOptions, setShowOptions]        = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tabs = Array.isArray(tabsData?.tabs) && tabsData.tabs.length > 0
    ? tabsData.tabs
    : makeDefaultTabsState().tabs;
  const activeId = tabsData?.activeTabId || tabs[0].id;

  useEffect(() => {
    if (!tabsLoaded) return;
    const seen = new Set<string>();
    let deduped = tabs.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Migrate old "New Tab" names without numbers
    const migrated = migrateTabNames(deduped);

    const safeActive = migrated.find(t => t.id === activeId)
      ? activeId
      : migrated[0]?.id ?? '';

    const nameChanged = migrated.some((t, i) => t.name !== tabsData?.tabs?.[i]?.name);

    if (
      migrated.length !== (tabsData?.tabs?.length || 0) ||
      safeActive !== tabsData?.activeTabId ||
      nameChanged
    ) {
      setTabsData({ tabs: migrated, activeTabId: safeActive });
    }
  }, [tabsLoaded, tabsData, tabs, activeId]);

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];
  const input = activeTab?.content ?? '';

  const setInput = useCallback((val: string) => {
    setTabsData({
      tabs: tabs.map(t => t.id === activeId ? { ...t, content: val } : t),
      activeTabId: activeId,
    });
  }, [activeId, tabs]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    };
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptions]);

  // Auto-process on every keystroke (debounced 250 ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!input.trim()) { setOutput(''); setResult(null); return; }
      const r = parseAndFormat(input, indent, sortKeys, minify);
      setOutput(r.formatted);
      setResult(r);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [input, indent, sortKeys, minify]);

  const loadSample = () => setInput(SAMPLE);
  const clearAll   = () => { setInput(''); setOutput(''); setResult(null); };

  const addTab = () => {
    const tab = newTab(tabs);
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

  const [dragState, setDragState] = useState<{ sourceId: string; overIdx: number } | null>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (!(e.target as HTMLElement).dataset.grip) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const sourceIdx = tabs.findIndex(t => t.id === id);
    setDragState({ sourceId: id, overIdx: sourceIdx });

    const onMove = (ev: PointerEvent) => {
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const saveEdit = () => {
    if (editingId) {
      setTabsData({
        tabs: tabs.map(t => t.id === editingId ? { ...t, name: editValue.trim() || 'Untitled', isAutoNamed: false } : t),
        activeTabId: activeId,
      });
      setEditingId(null);
    }
  };

  const scrollTabs = (dir: 1 | -1) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 150, behavior: 'smooth' });
  };

  // Stats
  const stats = React.useMemo(() => {
    if (!output) return null;
    try {
      const parsed = JSON.parse(output);
      const countKeys = (o: any): number => {
        if (typeof o !== 'object' || !o) return 0;
        return Object.keys(o).length + Object.values(o).reduce((s: number, v) => s + countKeys(v), 0);
      };
      const depth = (o: any, d = 0): number => {
        if (typeof o !== 'object' || !o) return d;
        const ds = Object.values(o).map(v => depth(v, d + 1));
        return ds.length ? Math.max(...ds) : d;
      };
      return { keys: countKeys(parsed), depth: depth(parsed), bytes: new Blob([output]).size };
    } catch { return null; }
  }, [output]);

  if (!tabsLoaded || !indentLoaded || !sortLoaded || !minifyLoaded) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); const r = parseAndFormat(input, indent, sortKeys, minify); setOutput(r.formatted); setResult(r); } }}>
      {/* Tabs */}
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
      {/* Toolbar */}
      <div className="toolbar" style={{ position: 'relative' }}>
        <button className="btn btn-primary" onClick={() => { const r = parseAndFormat(input, indent, sortKeys, minify); setOutput(r.formatted); setResult(r); }}>
          <Icons.json /> Format
        </button>
        <button className="btn btn-secondary" onClick={loadSample}>Load Sample</button>

        <div className="toolbar-right" style={{ position: 'relative' }} ref={optionsRef}>
          <button className="btn btn-secondary" onClick={() => setShowOptions(v => !v)}>
            ⚙ Options {showOptions ? '▲' : '▼'}
          </button>
          <button className="icon-btn" onClick={clearAll}><Icons.trash /></button>

          {showOptions && (
            <div style={{ position: 'absolute', top: 36, right: 32, background: 'var(--card)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 14, zIndex: 100, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Indent:</span>
                <select value={indent} onChange={e => setIndent(Number(e.target.value))}>
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                </select>
              </div>
              <label className="check-label" style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
                <input type="checkbox" checked={sortKeys} onChange={e => setSortKeys(e.target.checked)} />
                Sort keys
              </label>
              <label className="check-label" style={{ display: 'flex', gap: 8 }}>
                <input type="checkbox" checked={minify} onChange={e => setMinify(e.target.checked)} />
                Minify
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Split panels */}
      <div className="split-pane">
        {/* Input */}
        <div className="split-panel">
          <div className="panel-header">
            <span className="panel-label">
              Input
              {result?.success && <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 99, padding: '1px 7px', marginLeft: 6 }}>Valid</span>}
              {result && !result.success && !result.repaired && <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 99, padding: '1px 7px', marginLeft: 6 }}>Invalid</span>}
              {result?.repaired && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 99, padding: '1px 7px', marginLeft: 6 }}>Fixed</span>}
              <span className="badge" style={{ marginLeft: 6 }}>{input.length} chars</span>
            </span>
            <div className="panel-actions">
              <button className="icon-btn" title="Paste" onClick={() => navigator.clipboard.readText().then(t => setInput(t))}>
                <Icons.paste />
              </button>
            </div>
          </div>
          <Editor value={input} onChange={v => setInput(v)} language="json" placeholder='Paste or type JSON here... (supports invalid JSON, trailing commas, unquoted keys, comments)' height="100%" />
        </div>

        {/* Output */}
        <div className="split-panel">
          <div className="panel-header">
            <span className="panel-label">Output</span>
            <div className="panel-actions">
              <CopyBtn value={output} />
              <button className="icon-btn" title="Download" onClick={() => {
                const blob = new Blob([output], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'formatted.json';
                a.click();
              }}><Icons.download /></button>
            </div>
          </div>
          <Editor value={output} language="json" readOnly height="100%" />
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="status-left">
          {result?.success && (
            <span><span className="status-dot green" />Valid JSON ✓</span>
          )}
          {result && !result.success && !result.repaired && (
            <span style={{ color: '#ef4444' }}><span className="status-dot" style={{ background: '#ef4444' }} />Invalid — {result.errorMsg}</span>
          )}
          {result?.repaired && (
            <span style={{ color: '#f59e0b' }}><span className="status-dot orange" />Auto-repaired ✓</span>
          )}
        </div>
        <div className="status-right">
          {stats && (
            <>
              <span>{stats.keys} keys</span>
              <span>depth: {stats.depth}</span>
              <span>{stats.bytes} bytes</span>
            </>
          )}
          <span>{input.split('\n').length} lines</span>
        </div>
      </div>
    </div>
  );
}
