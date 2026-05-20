import React, { useState } from 'react';
import { Icons } from '../../Icons';

interface IgnoreRulesPanelProps {
  ignorePatterns: string[];
  onChange: (patterns: string[]) => void;
}

export function IgnoreRulesPanel({ ignorePatterns, onChange }: IgnoreRulesPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);

  const handleAddPattern = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange([...ignorePatterns, trimmed]);
      setInputValue('');
    }
  };

  const handleRemovePattern = (index: number) => {
    const newPatterns = [...ignorePatterns];
    newPatterns.splice(index, 1);
    onChange(newPatterns);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPattern();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const presets = [
    {
      label: 'Node.js',
      patterns: ['node_modules/', 'package-lock.json', 'yarn.lock', '.npmrc'],
    },
    {
      label: 'Python',
      patterns: ['__pycache__/', '*.pyc', '.venv/', '*.egg-info'],
    },
    {
      label: 'Build',
      patterns: ['dist/', 'build/', '.next/', 'out/', 'target/'],
    },
    {
      label: 'OS Files',
      patterns: ['.DS_Store', 'Thumbs.db', 'desktop.ini'],
    },
    {
      label: 'Logs',
      patterns: ['*.log', '*.tmp', '*.cache'],
    },
  ];

  return (
    <div style={{ padding: '16px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', position: 'relative' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)' }}>Ignore Rules</h3>
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setPresetsOpen(open => !open)}
            className="btn btn-outline"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Presets ▼
          </button>
          {presetsOpen && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', minWidth: '200px', boxShadow: '0 10px 20px rgba(0,0,0,0.25)', zIndex: 10 }}>
              {presets.map(group => (
                <button
                  key={group.label}
                  onClick={() => {
                    const next = [...ignorePatterns];
                    group.patterns.forEach(pattern => {
                      if (!next.includes(pattern)) {
                        next.push(pattern);
                      }
                    });
                    onChange(next);
                    setPresetsOpen(false);
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', fontSize: '12px', borderRadius: 0 }}
                >
                  {group.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Pattern Input */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter pattern (e.g., *.log, dist/)"
          className="input"
          style={{ flex: 1, padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
        />
        <button 
          onClick={handleAddPattern}
          className="btn btn-primary"
          style={{ padding: '8px 12px', fontSize: '12px' }}
        >
          Add
        </button>
      </div>
      
      {/* Pattern List */}
      {ignorePatterns.length > 0 && (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {ignorePatterns.map((pattern, index) => (
            <div 
              key={index}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              tabIndex={0}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 12px', 
                background: focusedIndex === index ? 'var(--active-bg)' : 'var(--bg)', 
                borderRadius: '4px',
                marginBottom: '4px',
                cursor: 'pointer'
              }}
            >
              <span style={{ 
                flex: 1, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                {pattern}
              </span>
              <button 
                onClick={() => handleRemovePattern(index)}
                className="icon-btn"
                style={{ padding: '4px', color: 'var(--text-muted)' }}
                title="Remove"
              >
                <Icons.x />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Hint when no patterns */}
      {ignorePatterns.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: 'var(--text-muted)', 
          fontSize: '12px',
          fontStyle: 'italic'
        }}>
          No ignore patterns - all files will be compared
        </div>
      )}
    </div>
  );
}