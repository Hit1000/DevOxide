import React, { useState, useEffect } from 'react';
import { CopyBtn } from '../TopBar';
import { useTauri } from '../../hooks/useTauri';

export function ColorConverter() {
  const [input, setInput] = useState('#3b82f6');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const tauri = useTauri();

  useEffect(() => {
    const run = async () => {
      if (!input.trim()) { setResult(null); setError(''); return; }
      try {
        const res = await tauri.convertColor(input);
        setResult(res); setError('');
      } catch (e: any) { setError(String(e)); setResult(null); }
    };
    run();
  }, [input]);

  return (
    <div style={{ flex: 1, padding: 24, overflow: 'auto', maxWidth: 600 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        {result && (
          <div className="color-swatch" style={{ background: result.hex }} />
        )}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter HEX (#FF5733), RGB (rgb(255, 87, 51)), HSL (hsl(11, 100%, 60%))..."
          style={{ flex: 1, height: 42, fontSize: 14 }}
        />
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 16 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'HEX', value: result.hex },
            { label: 'RGB', value: result.rgb },
            { label: 'RGBA', value: result.rgba },
            { label: 'HSL', value: result.hsl },
          ].map(row => (
            <div key={row.label} className="color-format-row">
              <span className="color-format-label">{row.label}</span>
              <span className="color-format-val">{row.value}</span>
              <CopyBtn value={row.value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
