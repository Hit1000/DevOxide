import React, { useState, useEffect, useRef } from 'react';
import { useTauri } from '../../hooks/useTauri';
import { CopyBtn } from '../TopBar';

const QUICK_PATTERNS = [
  { label: 'Email', icon: '✉', pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}' },
  { label: 'URL', icon: '🔗', pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)' },
  { label: 'Phone', icon: '📞', pattern: '[+]?[(]?[0-9]{3}[)]?[-\\s.]?[0-9]{3}[-\\s.]?[0-9]{4,6}' },
  { label: 'Date', icon: '📅', pattern: '\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])' },
  { label: 'IPv4', icon: '🌐', pattern: '(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)' },
];

export function RegexTester() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testStr, setTestStr] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tauri = useTauri();

  useEffect(() => {
    const run = async () => {
      if (!pattern.trim()) { setMatches([]); setError(null); return; }
      try {
        const res = await tauri.testRegex(pattern, testStr, flags);
        setError(res.error ?? null);
        setMatches(res.error ? [] : res.matches);
      } catch (e: any) { setError(String(e)); setMatches([]); }
    };
    run();
  }, [pattern, flags, testStr]);

  const toggleFlag = (f: string) =>
    setFlags(prev => prev.includes(f) ? prev.replace(f, '') : prev + f);

  // Highlight matches in test string
  const highlighted = React.useMemo(() => {
    if (!matches.length || !testStr) return [{ text: testStr, match: false }];
    const parts: { text: string; match: boolean }[] = [];
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) parts.push({ text: testStr.slice(cursor, m.start), match: false });
      parts.push({ text: testStr.slice(m.start, m.end), match: true });
      cursor = m.end;
    }
    if (cursor < testStr.length) parts.push({ text: testStr.slice(cursor), match: false });
    return parts;
  }, [matches, testStr]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Pattern toolbar */}
      <div className="toolbar" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 18 }}>/</span>
          <input
            type="text"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            placeholder="Enter regex pattern..."
            style={{ flex: 1, height: 32, borderRadius: 6, background: 'var(--input-bg)', border: '1px solid var(--border-light)', color: 'var(--text)', padding: '0 10px', fontFamily: 'Fira Code, monospace', fontSize: 13, outline: 'none' }}
          />
          <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 18 }}>/</span>
          <input
            type="text"
            value={flags}
            onChange={e => setFlags(e.target.value)}
            style={{ width: 56, height: 32, borderRadius: 6, background: 'var(--input-bg)', border: '1px solid var(--border-light)', color: 'var(--text)', padding: '0 8px', fontFamily: 'Fira Code, monospace', fontSize: 13, outline: 'none' }}
          />
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'var(--btn-secondary-bg)', border: '1px solid var(--border-light)', borderRadius: 99, padding: '2px 10px' }}>
            {matches.length} matches
          </span>
        </div>

        {/* Quick insert patterns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Insert:</span>
          {QUICK_PATTERNS.map(p => (
            <button key={p.label} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}
              onClick={() => setPattern(p.pattern)}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {error && <div style={{ width: '100%', padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: 12 }}>{error}</div>}
      </div>

      {/* Split: test string | highlighted output */}
      <div className="split-pane">
        <div className="split-panel">
          <div className="panel-header">
            <span className="panel-label">Test String</span>
          </div>
          <textarea
            value={testStr}
            onChange={e => setTestStr(e.target.value)}
            placeholder="Enter text to test against..."
            style={{ flex: 1, border: 'none', borderRadius: 0, background: 'var(--bg)', resize: 'none', padding: '10px 12px', fontFamily: 'Fira Code, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div className="split-panel">
          <div className="panel-header">
            <span className="panel-label">Highlighted Matches</span>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', fontFamily: 'Fira Code, monospace', fontSize: 13, overflow: 'auto', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {highlighted.map((part, i) =>
              part.match
                ? <mark key={i} style={{ background: 'rgba(124,58,237,0.35)', color: '#c4b5fd', borderRadius: 2, padding: '0 1px' }}>{part.text}</mark>
                : <span key={i} style={{ color: 'var(--text-muted)' }}>{part.text}</span>
            )}
            {matches.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {matches.map((m, i) => (
                  <div key={i} style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text)' }}>Match {i + 1}</strong>: [{m.start}–{m.end}]
                    {m.groups.slice(1).map((g: any, j: number) => g?.value != null && (
                      <span key={j} style={{ marginLeft: 8 }}>Group {j + 1}: <code style={{ color: '#a78bfa' }}>{g.value}</code></span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
