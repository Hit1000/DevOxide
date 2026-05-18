import React, { useState, useEffect } from 'react';
import { CopyBtn } from '../TopBar';
import { useTauri } from '../../hooks/useTauri';

type HashTab = 'text' | 'compare';

export function HashGenerator() {
  const [tab, setTab] = useState<HashTab>('text');
  const [input, setInput] = useState('');
  const [hmacMode, setHmacMode] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const tauri = useTauri();

  const generate = async (text = input) => {
    if (!text.trim()) { setResult(null); return; }
    try {
      const res = await tauri.generateHashes(text);
      setResult(res);
    } catch { setResult(null); }
  };

  useEffect(() => { generate(); }, [input]);

  const match = compareA && compareB && compareA.toLowerCase() === compareB.toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div className="url-tabs">
        {([['text', 'Text Input'], ['compare', 'Compare']] as const).map(([id, label]) => (
          <div key={id} className={`url-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}
            style={{ flex: 'none', padding: '9px 24px' }}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'text' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label className="check-label">
              <div
                style={{ width: 32, height: 18, borderRadius: 9, background: hmacMode ? 'var(--btn-primary-bg)' : 'var(--btn-secondary-bg)', border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                onClick={() => setHmacMode(v => !v)}
              >
                <div style={{ position: 'absolute', top: 2, left: hmacMode ? 14 : 2, width: 12, height: 12, borderRadius: 6, background: 'white', transition: 'left 0.2s' }} />
              </div>
              HMAC Mode
            </label>
          </div>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter text to hash..."
            style={{ height: 100, resize: 'none', fontFamily: 'Fira Code, monospace' }}
          />

          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => generate()}>
            Generate Hashes
          </button>

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {['md5', 'sha1', 'sha256', 'sha512'].map(algo => (
                <div key={algo} className="hash-row">
                  <span className="hash-algo">{algo.toUpperCase()}</span>
                  <span className="hash-val">{result[algo]}</span>
                  <CopyBtn value={result[algo]} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'compare' && (
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          <input type="text" value={compareA} onChange={e => setCompareA(e.target.value)} placeholder="First hash value..." />
          <input type="text" value={compareB} onChange={e => setCompareB(e.target.value)} placeholder="Second hash value..." />
          {compareA && compareB && (
            <div style={{ padding: '10px 16px', borderRadius: 8, background: match ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${match ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: match ? '#22c55e' : '#ef4444', fontSize: 14, fontWeight: 600 }}>
              {match ? '✓ Hashes match' : '✗ Hashes do not match'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
