import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { compareText, generateUnifiedDiffText } from '../../lib/diffEngine';
import type { UnifiedRow, WordSegment, DiffResult } from '../../lib/diffEngine';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';

// ── Word segment renderer ─────────────────────────────────────────────────────
function Segments({ segs, side }: { segs: WordSegment[]; side: 'old' | 'new' }) {
  return (
    <>
      {segs.map((s, i) => {
        if (s.type === 'equal') return <span key={i}>{s.value}</span>;
        if (s.type === 'removed' && side === 'old')
          return <span key={i} style={{ background: 'rgba(239,68,68,0.35)', borderRadius: 2 }}>{s.value}</span>;
        if (s.type === 'added' && side === 'new')
          return <span key={i} style={{ background: 'rgba(34,197,94,0.35)', borderRadius: 2 }}>{s.value}</span>;
        return null;
      })}
    </>
  );
}

// ── Hunk grouping ─────────────────────────────────────────────────────────────
interface Hunk { type: 'context' | 'changed' | 'collapsed'; rows: UnifiedRow[]; id: number; }

function groupIntoHunks(rows: UnifiedRow[], ctx = 3): Hunk[] {
  const hunks: Hunk[] = [];
  let id = 0;
  let i = 0;
  while (i < rows.length) {
    if (rows[i].type === 'context') {
      const start = i;
      while (i < rows.length && rows[i].type === 'context') i++;
      const ctxRows = rows.slice(start, i);
      if (ctxRows.length > ctx * 2 + 1) {
        hunks.push({ type: 'context',   rows: ctxRows.slice(0, ctx),    id: id++ });
        hunks.push({ type: 'collapsed', rows: ctxRows.slice(ctx, -ctx), id: id++ });
        hunks.push({ type: 'context',   rows: ctxRows.slice(-ctx),      id: id++ });
      } else {
        hunks.push({ type: 'context', rows: ctxRows, id: id++ });
      }
    } else {
      const start = i;
      while (i < rows.length && rows[i].type !== 'context') i++;
      hunks.push({ type: 'changed', rows: rows.slice(start, i), id: id++ });
    }
  }
  return hunks;
}

// ── Split-view paired rows ────────────────────────────────────────────────────
interface SplitRow { left?: UnifiedRow; right?: UnifiedRow; }
function buildSplitRows(rows: UnifiedRow[]): SplitRow[] {
  const result: SplitRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.type === 'context') { result.push({ left: row, right: row }); i++; }
    else {
      const removed: UnifiedRow[] = [], added: UnifiedRow[] = [];
      while (i < rows.length && rows[i].type !== 'context') {
        if (rows[i].type === 'removed') removed.push(rows[i]);
        else added.push(rows[i]);
        i++;
      }
      for (let j = 0; j < Math.max(removed.length, added.length); j++)
        result.push({ left: removed[j], right: added[j] });
    }
  }
  return result;
}

// ── Split cell ────────────────────────────────────────────────────────────────
function SplitCell({ row, side }: { row?: UnifiedRow; side: 'old' | 'new' }) {
  if (!row) return (
    <div style={{ display: 'flex', minHeight: 24, background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 6px)' }}>
      <div style={{ width: 40, flexShrink: 0, borderRight: '1px solid var(--border)' }} />
      <div style={{ flex: 1 }} />
    </div>
  );

  const lineNum = side === 'old' ? row.oldLine : row.newLine;
  const bg = row.type === 'removed' ? 'rgba(239,68,68,0.1)' : row.type === 'added' ? 'rgba(34,197,94,0.1)' : 'transparent';
  const gutterBg = row.type === 'removed' ? 'rgba(239,68,68,0.2)' : row.type === 'added' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.02)';

  return (
    <div style={{ display: 'flex', minHeight: 24, background: bg }}>
      <div style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingRight: 8, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', lineHeight: '24px', borderRight: '1px solid var(--border)', background: gutterBg, userSelect: 'none' }}>
        {lineNum ?? ''}
      </div>
      <div style={{ flex: 1, padding: '0 8px', fontFamily: 'Fira Code, monospace', fontSize: 13, lineHeight: '24px', whiteSpace: 'pre' }}>
        {row.segments ? <Segments segs={row.segments} side={side} /> : (row.content || ' ')}
      </div>
    </div>
  );
}

// ── Unified row ───────────────────────────────────────────────────────────────
function UnifiedRowEl({ row }: { row: UnifiedRow }) {
  const bg = row.type === 'removed' ? 'rgba(239,68,68,0.1)' : row.type === 'added' ? 'rgba(34,197,94,0.1)' : 'transparent';
  const gutterBg = row.type === 'removed' ? 'rgba(239,68,68,0.2)' : row.type === 'added' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.02)';
  const prefix = row.type === 'removed' ? '−' : row.type === 'added' ? '+' : ' ';
  const prefixColor = row.type === 'removed' ? '#f87171' : row.type === 'added' ? '#4ade80' : 'var(--text-dim)';
  const side = row.type === 'removed' ? 'old' : 'new';
  return (
    <div style={{ display: 'flex', minHeight: 24, background: bg }}>
      <div style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingRight: 6, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', lineHeight: '24px', borderRight: '1px solid var(--border)', background: gutterBg, userSelect: 'none' }}>{row.oldLine ?? ''}</div>
      <div style={{ width: 40, flexShrink: 0, textAlign: 'right', paddingRight: 6, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', lineHeight: '24px', borderRight: '1px solid var(--border)', background: gutterBg, userSelect: 'none' }}>{row.newLine ?? ''}</div>
      <div style={{ width: 20, flexShrink: 0, textAlign: 'center', fontFamily: 'monospace', fontSize: 13, lineHeight: '24px', color: prefixColor, userSelect: 'none' }}>{prefix}</div>
      <div style={{ flex: 1, padding: '0 8px', fontFamily: 'Fira Code, monospace', fontSize: 13, lineHeight: '24px', whiteSpace: 'pre' }}>
        {row.segments ? <Segments segs={row.segments} side={side} /> : (row.content || ' ')}
      </div>
    </div>
  );
}

// ── Collapsed row ─────────────────────────────────────────────────────────────
function CollapsedRow({ count, isOpen, onToggle }: { count: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ display: 'block', width: '100%', padding: '3px 0', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
    >
      {isOpen ? `⊖ Hide ${count} unchanged lines` : `⊕ Show ${count} unchanged lines`}
    </button>
  );
}

// ── Split view ────────────────────────────────────────────────────────────────
function SplitView({ hunks, collapsed, toggleCollapse }: { hunks: Hunk[]; collapsed: Set<number>; toggleCollapse: (id: number) => void }) {
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing  = useRef(false);
  const syncScroll = (from: 'left' | 'right') => {
    if (syncing.current) return;
    syncing.current = true;
    const a = from === 'left' ? leftRef.current : rightRef.current;
    const b = from === 'left' ? rightRef.current : leftRef.current;
    if (a && b) { b.scrollTop = a.scrollTop; b.scrollLeft = a.scrollLeft; }
    requestAnimationFrame(() => { syncing.current = false; });
  };

  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flex: 1, minHeight: 0 }}>
      {/* Left */}
      <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 12px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>Original</div>
        <div ref={leftRef} style={{ overflow: 'auto', flex: 1 }} onScroll={() => syncScroll('left')}>
          <div style={{ minWidth: 'max-content' }}>
            {hunks.map(hunk => {
              if (hunk.type === 'collapsed') {
                const open = collapsed.has(hunk.id);
                return (
                  <div key={hunk.id}>
                    <CollapsedRow count={hunk.rows.length} isOpen={open} onToggle={() => toggleCollapse(hunk.id)} />
                    {open && buildSplitRows(hunk.rows).map((sr, i) => <SplitCell key={i} row={sr.left} side="old" />)}
                  </div>
                );
              }
              return buildSplitRows(hunk.rows).map((sr, i) => <SplitCell key={`${hunk.id}-${i}`} row={sr.left} side="old" />);
            })}
          </div>
        </div>
      </div>
      {/* Right */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 12px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>Modified</div>
        <div ref={rightRef} style={{ overflow: 'auto', flex: 1 }} onScroll={() => syncScroll('right')}>
          <div style={{ minWidth: 'max-content' }}>
            {hunks.map(hunk => {
              if (hunk.type === 'collapsed') {
                const open = collapsed.has(hunk.id);
                return (
                  <div key={hunk.id}>
                    <CollapsedRow count={hunk.rows.length} isOpen={open} onToggle={() => toggleCollapse(hunk.id)} />
                    {open && buildSplitRows(hunk.rows).map((sr, i) => <SplitCell key={i} row={sr.right} side="new" />)}
                  </div>
                );
              }
              return buildSplitRows(hunk.rows).map((sr, i) => <SplitCell key={`${hunk.id}-${i}`} row={sr.right} side="new" />);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Unified view ──────────────────────────────────────────────────────────────
function UnifiedView({ hunks, collapsed, toggleCollapse }: { hunks: Hunk[]; collapsed: Set<number>; toggleCollapse: (id: number) => void }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ minWidth: 'max-content' }}>
          {hunks.map(hunk => {
            if (hunk.type === 'collapsed') {
              const open = collapsed.has(hunk.id);
              return (
                <div key={hunk.id}>
                  <CollapsedRow count={hunk.rows.length} isOpen={open} onToggle={() => toggleCollapse(hunk.id)} />
                  {open && hunk.rows.map((r, i) => <UnifiedRowEl key={i} row={r} />)}
                </div>
              );
            }
            const rows = hunk.type === 'changed'
              ? [...hunk.rows.filter(r => r.type === 'removed'), ...hunk.rows.filter(r => r.type === 'added')]
              : hunk.rows;
            return rows.map((r, i) => <UnifiedRowEl key={`${hunk.id}-${i}`} row={r} />);
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main DiffTool ─────────────────────────────────────────────────────────────
export function DiffTool() {
  const [left,        setLeft]        = useState('');
  const [right,       setRight]       = useState('');
  const [ignoreCase,  setIgnoreCase]  = useState(false);
  const [viewMode,    setViewMode]    = useState<'split' | 'unified'>('split');
  const [result,      setResult]      = useState<DiffResult | null>(null);
  const [collapsed,   setCollapsed]   = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-diff with 300ms debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!left && !right) { setResult(null); return; }
    debounceRef.current = setTimeout(() => {
      setResult(compareText(left, right, ignoreCase));
      setCollapsed(new Set());
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [left, right, ignoreCase]);

  const hunks = useMemo(() => result ? groupIntoHunks(result.unifiedRows, 3) : [], [result]);

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const swap  = () => { const t = left; setLeft(right); setRight(t); };
  const clear = () => { setLeft(''); setRight(''); setResult(null); };
  const paste = (fn: (v: string) => void) => navigator.clipboard.readText().then(fn);
  const copyDiff = () => result ? navigator.clipboard.writeText(generateUnifiedDiffText(result.leftLines, result.rightLines)) : undefined;

  const stats = result?.stats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <label className="check-label" style={{ gap: 8 }}>
          <div
            onClick={() => setIgnoreCase(v => !v)}
            style={{ width: 32, height: 18, borderRadius: 9, background: ignoreCase ? 'var(--btn-primary-bg)' : 'var(--btn-secondary-bg)', border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
          >
            <div style={{ position: 'absolute', top: 2, left: ignoreCase ? 14 : 2, width: 12, height: 12, borderRadius: 6, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
          Ignore case
        </label>

        <div style={{ width: 1, height: 20, background: 'var(--border-light)', margin: '0 4px' }} />

        <div className="toggle-group">
          <button className={`toggle-opt ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')}>Split</button>
          <button className={`toggle-opt ${viewMode === 'unified' ? 'active' : ''}`} onClick={() => setViewMode('unified')}>Unified</button>
        </div>

        <div className="toolbar-right">
          {stats && (
            <div style={{ display: 'flex', gap: 8, fontSize: 11, marginRight: 8 }}>
              {stats.added     > 0 && <span style={{ color: '#4ade80' }}>+{stats.added + stats.modified} added</span>}
              {stats.removed   > 0 && <span style={{ color: '#f87171' }}>−{stats.removed + stats.modified} removed</span>}
              {stats.unchanged > 0 && <span style={{ color: 'var(--text-muted)' }}>{stats.unchanged} unchanged</span>}
            </div>
          )}
          {result && <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={copyDiff}><Icons.copy /> Copy Diff</button>}
          <button className="btn btn-secondary" onClick={swap}><Icons.swap /> Swap</button>
          <button className="icon-btn" onClick={clear}><Icons.trash /></button>
        </div>
      </div>

      {/* Input panels */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {/* Left input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', padding: '1px 8px', border: '1px solid var(--border-light)', borderRadius: 4 }}>Original</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{left.length} chars · {left.split('\n').length} lines</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              <button className="icon-btn" onClick={() => paste(setLeft)}><Icons.paste /></button>
              <button className="icon-btn" onClick={() => setLeft('')}><Icons.trash /></button>
            </div>
          </div>
          <textarea
            value={left}
            onChange={e => setLeft(e.target.value)}
            placeholder="Paste or type original text here..."
            style={{ height: 160, border: 'none', borderRadius: 0, background: 'var(--bg)', resize: 'none', padding: '8px 12px', fontFamily: 'Fira Code, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }}
          />
        </div>
        {/* Right input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', padding: '1px 8px', border: '1px solid var(--border-light)', borderRadius: 4 }}>Modified</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{right.length} chars · {right.split('\n').length} lines</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
              <button className="icon-btn" onClick={() => paste(setRight)}><Icons.paste /></button>
              <button className="icon-btn" onClick={() => setRight('')}><Icons.trash /></button>
            </div>
          </div>
          <textarea
            value={right}
            onChange={e => setRight(e.target.value)}
            placeholder="Paste or type modified text here..."
            style={{ height: 160, border: 'none', borderRadius: 0, background: 'var(--bg)', resize: 'none', padding: '8px 12px', fontFamily: 'Fira Code, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }}
          />
        </div>
      </div>

      {/* Result */}
      {result && hunks.length > 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px' }}>
          {viewMode === 'split'
            ? <SplitView   hunks={hunks} collapsed={collapsed} toggleCollapse={toggleCollapse} />
            : <UnifiedView hunks={hunks} collapsed={collapsed} toggleCollapse={toggleCollapse} />
          }
        </div>
      )}

      {!result && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Enter text in both panels to see differences
        </div>
      )}
    </div>
  );
}
