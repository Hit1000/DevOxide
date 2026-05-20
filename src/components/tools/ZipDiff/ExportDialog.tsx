import React, { useState } from 'react';
import { Icons } from '../../Icons';

interface ExportDialogProps {
  files: Array<{ relative_path: string; status: string }>;
  onExport: (selectedPaths: string[], exportMode: string) => void;
  onCancel: () => void;
}

export function ExportDialog({ files, onExport, onCancel }: ExportDialogProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<'new_only' | 'full_merge' | 'patch_zip'>('patch_zip');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);


  const handleSelectAll = () => {
    const selected = files.filter(file => {
      if (exportMode === 'new_only') {
        return file.status === 'added';
      }
      if (exportMode === 'full_merge') {
        return file.status !== 'removed';
      }
      return file.status === 'modified' || file.status === 'added';
    }).map(file => file.relative_path);
    setSelectedPaths(selected);
  };

  const handleSelectNone = () => {
    setSelectedPaths([]);
  };

  const handleToggleFile = (path: string) => {
    setSelectedPaths(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path) 
        : [...prev, path]
    );
  };

  const handleExport = async () => {
    if (selectedPaths.length === 0) {
      setError('Please select at least one file to export');
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportSummary(null);

    try {
      await onExport(selectedPaths, exportMode);
      onCancel(); // Close dialog after successful export
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ 
        background: 'var(--bg)', 
        borderRadius: '8px', 
        padding: '24px', 
        width: '90%', 
        maxWidth: '500px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Export Results</h2>
          <button 
            onClick={onCancel}
            className="icon-btn"
            style={{ padding: '4px' }}
          >
            <Icons.x />
          </button>
        </div>

        {error && (
          <div style={{ 
            background: 'var(--error-bg)', 
            color: 'var(--error-text)', 
            padding: '8px 12px', 
            borderRadius: '4px', 
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* File Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500' }}>Select Files to Export</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button 
              onClick={handleSelectAll}
              className="btn btn-outline"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Select All
            </button>
            <button 
              onClick={handleSelectNone}
              className="btn btn-outline"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Select None
            </button>
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px' }}>
            {files.map((file, index) => (
              <div 
                key={file.relative_path}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '8px 12px', 
                  background: selectedPaths.includes(file.relative_path) ? 'var(--active-bg)' : 'var(--bg)',
                  cursor: 'pointer',
                  borderBottom: index !== files.length - 1 ? '1px solid var(--border-light)' : 'none'
                }}
                onClick={() => handleToggleFile(file.relative_path)}
              >
                <div style={{ 
                  flex: 1, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {file.relative_path}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)', 
                  marginLeft: '8px',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {file.status === 'added' && (
                    <span style={{ color: 'var(--success)' }}>+ Added</span>
                  )}
                  {file.status === 'removed' && (
                    <span style={{ color: 'var(--error)' }}>- Removed</span>
                  )}
                  {file.status === 'modified' && (
                    <span style={{ color: 'var(--warning)' }}>~ Modified</span>
                  )}
                  {file.status === 'identical' && (
                    <span>= Identical</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Mode Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500' }}>Export Mode</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="new_only"
                checked={exportMode === 'new_only'}
                onChange={(e) => setExportMode(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>New files only</span>
            </label>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Export only added/new files from the new source
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="full_merge"
                checked={exportMode === 'full_merge'}
                onChange={(e) => setExportMode(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>Full merged folder</span>
            </label>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Export entire new tree with modifications applied
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="patch_zip"
                checked={exportMode === 'patch_zip'}
                onChange={(e) => setExportMode(e.target.value as any)}
                style={{ marginRight: '8px' }}
              />
              <span>Patch (changes only)</span>
            </label>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Export only added and modified files (default)
            </p>
          </div>
        </div>

        {/* Export Summary (shown after export) */}
        {exportSummary && !isExporting && (
          <div style={{ 
            background: 'var(--success-bg)', 
            color: 'var(--success-text)', 
            padding: '12px 16px', 
            borderRadius: '4px', 
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Files exported:</span>
              <span>{exportSummary.files_exported}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Hunks accepted:</span>
              <span>{exportSummary.hunks_accepted}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Hunks rejected:</span>
              <span>{exportSummary.hunks_rejected}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Hunks edited:</span>
              <span>{exportSummary.hunks_edited}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Output size:</span>
              <span>{(exportSummary.output_size_bytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button 
            onClick={onCancel}
            className="btn btn-outline"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            disabled={isExporting || selectedPaths.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}