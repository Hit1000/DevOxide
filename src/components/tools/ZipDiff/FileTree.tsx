import React, { useState } from 'react';

interface FileTreeProps {
  files: Array<{
    relative_path: string;
    status: 'added' | 'removed' | 'modified' | 'identical' | 'binary';
    old_hash: string | null;
    new_hash: string | null;
    is_binary: boolean;
    old_size: number;
    new_size: number;
  }>;
  activeFile: string | null;
  onFileSelect: (file: { relative_path: string }) => void;
  hunkStats?: Record<string, { accepted: number; rejected: number; edited: number; total: number }>;
}

export function FileTree({ files, activeFile, onFileSelect, hunkStats }: FileTreeProps) {
  const [filter, setFilter] = useState<'all' | 'modified' | 'added' | 'removed' | 'identical'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!files || files.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No files to display. Please drag and drop or browse for folders.
      </div>
    );
  }

  const filteredFiles = files.filter(file => {
    // Apply filter
    if (filter !== 'all' && file.status !== filter) {
      return false;
    }
    
    // Apply search
    if (searchTerm.trim() !== '' && 
        !file.relative_path.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // Group files by directory
  const groupedFiles: Record<string, Array<typeof filteredFiles[0]>> = {};
  const rootFiles: Array<typeof filteredFiles[0]> = [];
  
  filteredFiles.forEach(file => {
    const parts = file.relative_path.split('/');
    if (parts.length === 1) {
      rootFiles.push(file);
    } else {
      const dir = parts.slice(0, -1).join('/');
      if (!groupedFiles[dir]) {
        groupedFiles[dir] = [];
      }
      groupedFiles[dir].push(file);
    }
  });

  const statusConfig: Record<FileTreeProps['files'][0]['status'], { color: string; bg: string; icon: string; label: string }> = {
    added: { color: '#4ade80', bg: 'rgba(34,197,94,0.12)', icon: '+', label: 'Added' },
    removed: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', icon: '-', label: 'Removed' },
    modified: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: '~', label: 'Modified' },
    identical: { color: 'var(--text-muted)', bg: 'transparent', icon: '=', label: 'Identical' },
    binary: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: 'B', label: 'Binary' },
  };

  return (
    <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
      {/* Filter Controls */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'btn btn-outline-active' : 'btn btn-outline'}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          All
        </button>
        <button 
          onClick={() => setFilter('modified')}
          className={filter === 'modified' ? 'btn btn-outline-active' : 'btn btn-outline'}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Modified
        </button>
        <button 
          onClick={() => setFilter('added')}
          className={filter === 'added' ? 'btn btn-outline-active' : 'btn btn-outline'}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Added
        </button>
        <button 
          onClick={() => setFilter('removed')}
          className={filter === 'removed' ? 'btn btn-outline-active' : 'btn btn-outline'}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Removed
        </button>
        <button 
          onClick={() => setFilter('identical')}
          className={filter === 'identical' ? 'btn btn-outline-active' : 'btn btn-outline'}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Identical
        </button>
      </div>
      
      {/* Search Box */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input"
          style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
        />
      </div>
      
      {/* File List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Root Files */}
        {rootFiles.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', color: 'var(--text-muted)' }}>Files</div>
            {rootFiles.map(file => {
              const config = statusConfig[file.status];
              const isActive = activeFile === file.relative_path;
              const stats = hunkStats?.[file.relative_path];
              const accepted = stats?.accepted ?? 0;
              const rejected = stats?.rejected ?? 0;
              const edited = stats?.edited ?? 0;
              const hunkBadge = (accepted + rejected + edited) > 0
                ? `${accepted}✓ ${rejected}✗`
                : null;
              return (
              <div 
                key={file.relative_path}
                onClick={() => onFileSelect(file)}
                className={`file-item ${activeFile === file.relative_path ? 'active' : ''}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 12px', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--active-bg)' : config.bg,
                  marginBottom: '2px'
                }}
              >
                <span style={{ 
                  fontSize: '14px', 
                  marginRight: '8px', 
                  color: config.color,
                  minWidth: '16px',
                  textAlign: 'center'
                }}>
                  {config.icon}
                </span>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.relative_path}
                </div>
                {hunkBadge && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px', minWidth: '60px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {hunkBadge}
                  </div>
                )}
                <div style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)', 
                  marginLeft: '8px',
                  minWidth: '60px',
                  textAlign: 'right'
                }}>
                  {file.is_binary ? 'Binary' : 
                   file.status === 'identical' ? 'Same' :
                   `${file.old_size} → ${file.new_size} B`}
                </div>
              </div>
            );
            })}
          </>
        )}
        
        {/* Directory Groups */}
        {Object.keys(groupedFiles).map(dir => (
          <div key={dir} style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '4px', 
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'var(--bg)'
            }}>
              <span style={{ marginRight: '8px' }}>▾</span>
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>{dir}</span>
            </div>
            <div style={{ marginLeft: '16px' }}>
              {groupedFiles[dir].map(file => {
                const config = statusConfig[file.status];
                const isActive = activeFile === file.relative_path;
                const stats = hunkStats?.[file.relative_path];
                const accepted = stats?.accepted ?? 0;
                const rejected = stats?.rejected ?? 0;
                const edited = stats?.edited ?? 0;
                const hunkBadge = (accepted + rejected + edited) > 0
                  ? `${accepted}✓ ${rejected}✗`
                  : null;
                return (
                <div 
                  key={file.relative_path}
                  onClick={() => onFileSelect(file)}
                  className={`file-item ${activeFile === file.relative_path ? 'active' : ''}`}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--active-bg)' : config.bg,
                    marginBottom: '2px'
                  }}
                >
                  <span style={{ 
                    fontSize: '14px', 
                    marginRight: '8px', 
                    color: config.color,
                    minWidth: '16px',
                    textAlign: 'center'
                  }}>
                    {config.icon}
                  </span>
                  <div style={{ 
                    flex: 1, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}>
                    {file.relative_path.split('/').pop()}
                  </div>
                  {hunkBadge && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px', minWidth: '60px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {hunkBadge}
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-muted)', 
                    marginLeft: '8px',
                    minWidth: '60px',
                    textAlign: 'right'
                  }}>
                    {file.is_binary ? 'Binary' : 
                     file.status === 'identical' ? 'Same' :
                     `${file.old_size} → ${file.new_size} B`}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}