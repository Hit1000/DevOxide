import React, { useState, useEffect } from 'react';
import { Editor } from '../shared/Editor';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';
import { useTauri } from '../../hooks/useTauri';

export function JwtDecoder() {
  const [token, setToken] = useState('');
  const [secret, setSecret] = useState('');
  const [header, setHeader] = useState('');
  const [payload, setPayload] = useState('');
  const [sigStatus, setSigStatus] = useState<boolean | null>(null);
  const tauri = useTauri();

  const decode = async () => {
    if (!token.trim()) { setHeader(''); setPayload(''); setSigStatus(null); return; }
    try {
      const res = await tauri.decodeJwt(token, secret || undefined);
      setHeader(JSON.stringify(res.header, null, 2));
      setPayload(JSON.stringify(res.payload, null, 2));
      setSigStatus(res.valid_signature);
    } catch {
      setHeader('Invalid token');
      setPayload('');
      setSigStatus(null);
    }
  };

  useEffect(() => { decode(); }, [token, secret]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* Token input */}
      <div style={{ padding: 16, borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--sidebar-bg)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste JWT token here..."
            style={{ flex: 1, height: 80, background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '8px 10px', fontFamily: 'Fira Code, monospace', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'none', wordBreak: 'break-all' }}
          />
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={decode}>
            Decode
          </button>
        </div>

        {/* Secret + sig status */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input
            type="text"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Secret (optional — for signature verification)"
            style={{ flex: 1, height: 32 }}
          />
          {sigStatus !== null && (
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: sigStatus ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: sigStatus ? '#22c55e' : '#ef4444', border: `1px solid ${sigStatus ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, whiteSpace: 'nowrap' }}>
              {sigStatus ? '✓ Valid signature' : '✗ Invalid signature'}
            </span>
          )}
        </div>
      </div>

      {/* Three columns: Header | Payload | Signature */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div className="panel-header">
            <span className="jwt-section-header jwt-purple" style={{ fontSize: 12 }}>Header</span>
          </div>
          <Editor value={header} language="json" readOnly height="100%" />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div className="panel-header">
            <span className="jwt-section-header jwt-blue" style={{ fontSize: 12 }}>Payload</span>
          </div>
          <Editor value={payload} language="json" readOnly height="100%" />
        </div>
        <div style={{ flex: 0.6, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <span className="jwt-section-header jwt-red" style={{ fontSize: 12 }}>Signature</span>
          </div>
          <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>
            {token.split('.')[2] && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Base64Url encoded:</div>
                <div style={{ fontFamily: 'Fira Code, monospace', fontSize: 11, wordBreak: 'break-all', color: '#f87171' }}>{token.split('.')[2]}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
