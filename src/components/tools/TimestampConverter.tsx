import React, { useState, useEffect } from 'react';
import { CopyBtn } from '../TopBar';
import { useTauri } from '../../hooks/useTauri';

const TIMEZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Kolkata'];

export function TimestampConverter() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [tz, setTz] = useState('UTC');
  const tauri = useTauri();

  const convert = async (val = input) => {
    try {
      const res = await tauri.convertTimestamp(val);
      setResult(res); setError('');
    } catch (e: any) { setError(String(e)); setResult(null); }
  };

  useEffect(() => { convert(); }, [input]);

  const now = () => { const ts = Math.floor(Date.now() / 1000).toString(); setInput(ts); };

  return (
    <div style={{ flex: 1, padding: 24, overflow: 'auto', maxWidth: 700 }}>
      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter Unix timestamp or ISO date..."
          style={{ flex: 1, height: 42, fontSize: 14 }}
        />
        <button className="icon-btn" onClick={now} title="Use current time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
      </div>

      {/* Timezone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>Timezone:</span>
        <select value={tz} onChange={e => setTz(e.target.value)}>
          {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'UTC', value: result.utc },
            { label: 'Local', value: result.local },
            { label: 'ISO 8601', value: result.iso8601 },
            { label: 'Unix (s)', value: String(result.unix_seconds) },
            { label: 'Unix (ms)', value: String(result.unix_milliseconds) },
          ].map(item => (
            <div key={item.label} className="ts-card">
              <div className="ts-label">{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="ts-val">{item.value}</span>
                <CopyBtn value={item.value} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
