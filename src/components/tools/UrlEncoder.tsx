import React, { useState, useEffect } from 'react';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';
import { useTauri } from '../../hooks/useTauri';

type UrlTab = 'url' | 'base64' | 'html' | 'parser';

export function UrlEncoder() {
  const [tab, setTab] = useState<UrlTab>('url');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const tauri = useTauri();

  useEffect(() => {
    const run = async () => {
      if (!input.trim()) { setOutput(''); return; }
      try {
        if (tab === 'url') {
          if (mode === 'encode') setOutput(await tauri.urlEncode(input));
          else setOutput(await tauri.urlDecode(input));
        } else if (tab === 'base64') {
          if (mode === 'encode') setOutput(btoa(input));
          else setOutput(atob(input));
        } else if (tab === 'html') {
          if (mode === 'encode') setOutput(input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));
          else setOutput(input.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'"));
        }
      } catch (e: any) { setOutput(`Error: ${e}`); }
    };
    run();
  }, [input, tab, mode]);

  const TAB_DEFS: { id: UrlTab; label: string; icon: React.ReactNode }[] = [
    { id: 'url',    label: 'URL Encode',  icon: <Icons.url /> },
    { id: 'base64', label: 'Base64',      icon: <Icons.json /> },
    { id: 'html',   label: 'HTML Entity', icon: <Icons.json /> },
    { id: 'parser', label: 'URL Parser',  icon: <Icons.color /> },
  ];

  // URL Parser view
  const parsedUrl = React.useMemo(() => {
    if (tab !== 'parser') return null;
    try { return new URL(input); } catch { return null; }
  }, [input, tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div className="url-tabs">
        {TAB_DEFS.map(t => (
          <div key={t.id} className={`url-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </div>
        ))}
      </div>

      {tab === 'parser' ? (
        <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="https://example.com/path?query=value#hash"
            style={{ width: '100%', marginBottom: 16 }}
          />
          {parsedUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Protocol', parsedUrl.protocol],
                ['Host', parsedUrl.host],
                ['Pathname', parsedUrl.pathname],
                ['Search', parsedUrl.search],
                ['Hash', parsedUrl.hash],
                ['Origin', parsedUrl.origin],
              ].map(([k, v]) => v && (
                <div key={k} className="color-format-row">
                  <span className="color-format-label">{k}</span>
                  <span className="color-format-val mono">{v}</span>
                  <CopyBtn value={v} />
                </div>
              ))}
              {parsedUrl.searchParams.toString() && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Query Params</div>
                  {Array.from(parsedUrl.searchParams.entries()).map(([k, v]) => (
                    <div key={k} className="color-format-row" style={{ marginBottom: 6 }}>
                      <span className="color-format-label" style={{ color: '#818cf8' }}>{k}</span>
                      <span className="color-format-val mono">{v}</span>
                      <CopyBtn value={v} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : input && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Invalid URL</div>}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Input/Output labels row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--sidebar-bg)', flexShrink: 0 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>Input ({mode === 'encode' ? 'Plain' : 'Encoded'})</span>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11 }}
              onClick={() => setMode(m => m === 'encode' ? 'decode' : 'encode')}
            >
              Switch to {mode === 'encode' ? 'Decode' : 'Encode'}
            </button>
            <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button className="icon-btn" onClick={() => { const tmp = input; setInput(output); setOutput(tmp); }}>
                <Icons.swap />
              </button>
            </div>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>Output ({mode === 'encode' ? 'Encoded' : 'Plain'})</span>
            <CopyBtn value={output} />
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Enter text to ${mode}...`}
              style={{ flex: 1, border: 'none', borderRadius: 0, background: 'var(--bg)', resize: 'none', padding: '10px 12px', fontFamily: 'Fira Code, monospace', fontSize: 13, color: 'var(--text)', outline: 'none', borderRight: '1px solid var(--border)' }}
            />
            <textarea
              value={output}
              readOnly
              style={{ flex: 1, border: 'none', borderRadius: 0, background: 'var(--bg)', resize: 'none', padding: '10px 12px', fontFamily: 'Fira Code, monospace', fontSize: 13, color: 'var(--text)', outline: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
