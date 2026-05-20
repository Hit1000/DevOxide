import React, { useState } from 'react';
import { Icons } from '../../Icons';

interface ExceptionRulesProps {
  exceptionRules: Array<{ 
    id: string; 
    pattern: string; 
    type: 'line-pattern' | 'whitespace' | 'line-ending' 
  }>;
  onAdd: (pattern: string, type: string) => void;
}

export function ExceptionRules({ exceptionRules, onAdd }: ExceptionRulesProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedType, setSelectedType] = useState<'line-pattern' | 'whitespace' | 'line-ending'>('line-pattern');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleAddRule = () => {
    const trimmed = inputValue.trim();
    if (trimmed || selectedType !== 'line-pattern') {
      onAdd(trimmed, selectedType);
      setInputValue('');
      setSelectedType('line-pattern');
    }
  };

  const handleRemoveRule = (index: number) => {
    // In a real implementation, this would call a hook to remove the rule
    console.log('Remove rule at index:', index);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRule();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const typeLabels: Record<string, string> = {
    'line-pattern': 'Line Pattern',
    'whitespace': 'Whitespace-only',
    'line-ending': 'Line Endings (CRLF vs LF)'
  };

  const typeDescriptions: Record<string, string> = {
    'line-pattern': 'Ignore lines matching this pattern everywhere',
    'whitespace': 'Ignore changes that only involve whitespace',
    'line-ending': 'Ignore differences in line endings (CR/LF/LF)'
  };

  return (
    <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)' }}>Exception Rules</h3>
        <button 
          onClick={() => {
            // Apply common presets
            console.log('Apply exception presets');
          }}
          className="btn btn-outline"
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          Presets
        </button>
      </div>
      
      {/* Rule Type Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <select 
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as any)}
          className="select"
          style={{ 
            padding: '8px', 
            border: '1px solid var(--border)', 
            borderRadius: '4px', 
            fontSize: '13px',
            background: 'var(--bg)',
            color: 'var(--text)'
          }}
        >
          <option value="line-pattern">Line Pattern</option>
          <option value="whitespace">Whitespace-only</option>
          <option value="line-ending">Line Endings</option>
        </select>
        
        {selectedType === 'line-pattern' && (
          <>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter regex or glob pattern"
              className="input"
              style={{ 
                flex: 1, 
                minWidth: 0, 
                padding: '8px', 
                border: '1px solid var(--border)', 
                borderRadius: '4px', 
                fontSize: '13px'
              }}
            />
            <button 
              onClick={handleAddRule}
              className="btn btn-primary"
              style={{ padding: '8px 12px', fontSize: '12px' }}
            >
              Add
            </button>
          </>
        )}
        
        {(selectedType === 'whitespace' || selectedType === 'line-ending') && (
          <button 
            onClick={handleAddRule}
            className="btn btn-primary"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            Add Rule
          </button>
        )}
      </div>
      
      {/* Current Rules List */}
      {exceptionRules.length > 0 && (
        <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '12px' }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: '500', 
            marginBottom: '4px', 
            color: 'var(--text-muted)'
          }}>
            Active Rules ({exceptionRules.length})
          </div>
          {exceptionRules.map((rule, index) => (
            <div 
              key={rule.id}
              onFocus={() => handleFocus(index)}
              onBlur={handleBlur}
              tabIndex={0}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '6px 10px', 
                background: focusedIndex === index ? 'var(--active-bg)' : 'var(--bg)', 
                borderRadius: '3px',
                marginBottom: '2px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <div style={{ 
                flex: 1, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontFamily: 'monospace'
              }}>
                {rule.type === 'line-pattern' && `Pattern: ${rule.pattern}`}
                {rule.type === 'whitespace' && 'Whitespace-only changes'}
                {rule.type === 'line-ending' && 'Line ending differences'}
              </div>
              <button 
                onClick={() => handleRemoveRule(index)}
                className="icon-btn"
                style={{ padding: '2px', color: 'var(--text-muted)', fontSize: '10px' }}
                title="Remove"
              >
                <Icons.x />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Hint when no rules */}
      {exceptionRules.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '16px', 
          color: 'var(--text-muted)', 
          fontSize: '12px',
          fontStyle: 'italic'
        }}>
          No exception rules - all differences will be shown
        </div>
      )}
    </div>
  );
}