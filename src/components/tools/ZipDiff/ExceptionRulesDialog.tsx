import React, { useState } from 'react';
import { Icons } from '../../Icons';

interface ExceptionRulesDialogProps {
  onAdd: (pattern: string, type: 'line-pattern' | 'whitespace' | 'line-ending') => void;
  onCancel: () => void;
}

export function ExceptionRulesDialog({ onAdd, onCancel }: ExceptionRulesDialogProps) {
  const [pattern, setPattern] = useState('');
  const [selectedType, setSelectedType] = useState<'line-pattern' | 'whitespace' | 'line-ending'>('line-pattern');

  const handleAdd = () => {
    const trimmed = pattern.trim();
    if (selectedType === 'line-pattern' && !trimmed) return;
    onAdd(trimmed, selectedType);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Add Exception Rule</h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Rule Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="select"
            style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px', background: 'var(--bg)', color: 'var(--text)' }}
          >
            <option value="line-pattern">Line Pattern</option>
            <option value="whitespace">Whitespace-only</option>
            <option value="line-ending">Line Endings (CRLF vs LF)</option>
          </select>
        </div>
        {selectedType === 'line-pattern' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Pattern:</label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g., // Generated at .*"
              className="input"
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
            Cancel
          </button>
          <button onClick={handleAdd} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}
