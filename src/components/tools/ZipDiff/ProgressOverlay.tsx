import React from 'react';

interface ProgressOverlayProps {
  progress: {
    stage: string;
    current: number;
    total: number;
    current_file: string;
  } | null;
}

export function ProgressOverlay({ progress }: ProgressOverlayProps) {
  if (!progress) {
    return null;
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0,0,0,0.7)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000 
    }}>
      <div style={{ 
        background: 'var(--bg)', 
        borderRadius: '8px', 
        padding: '24px', 
        width: '90%', 
        maxWidth: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          marginBottom: '16px', 
          color: 'var(--text)' 
        }}>
          Processing {progress.stage}...
        </div>
        
        <div style={{ 
          marginBottom: '12px', 
          fontSize: '13px', 
          color: 'var(--text-muted)' 
        }}>
          {progress.current_file}
        </div>
        
        <div style={{ 
          width: '100%', 
          background: 'var(--border-light)', 
          borderRadius: '4px', 
          height: '8px', 
          overflow: 'hidden' 
        }}>
          <div style={{ 
            width: `${percent}%`, 
            background: 'var(--accent)', 
            height: '100%', 
            transition: 'width 0.2s ease' 
          }}></div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '8px', 
          fontSize: '12px', 
          color: 'var(--text-muted)' 
        }}>
          <span>{progress.current} / {progress.total}</span>
          <span>{percent}%</span>
        </div>
        
        <button 
          onClick={() => {
            // In real implementation, this would cancel the operation
            console.log('Cancel operation');
          }}
          className="btn btn-outline"
          style={{ 
            marginTop: '16px', 
            padding: '6px 12px', 
            fontSize: '12px' 
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}