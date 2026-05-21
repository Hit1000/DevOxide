import React, { useState, useMemo } from 'react';
import { Icons } from '../../Icons';
import { openFolder } from './api';

interface ExportDialogProps {
  files: Array<{ relative_path: string; status: string; new_size: number; old_size: number }>;
  onExport: (selectedPaths: string[], exportMode: string) => Promise<any>;
  onCancel: () => void;
}

export function ExportDialog({ files, onExport, onCancel }: ExportDialogProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<'new_only' | 'full_merge' | 'patch_zip'>('patch_zip');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<any>(null);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligibleFiles = useMemo(() => {
    if (exportMode === 'new_only') return files.filter(f => f.status === 'added');
    if (exportMode === 'full_merge') return files.filter(f => f.status !== 'removed');
    return files.filter(f => f.status === 'modified' || f.status === 'added');
  }, [files, exportMode]);

  const estimatedSize = useMemo(() => {
    const bytes = eligibleFiles
      .filter(f => selectedPaths.includes(f.relative_path))
      .reduce((sum, f) => sum + (f.status === 'added' ? f.new_size : f.new_size), 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [eligibleFiles, selectedPaths]);

  const handleSelectAll = () => {
    setSelectedPaths(eligibleFiles.map(file => file.relative_path));
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
    setExportedPath(null);

    try {
      const result = await onExport(selectedPaths, exportMode);
      setExportSummary(result);
      // Get the output path from the last export
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenFolder = async () => {
    if (exportedPath) {
      try {
        await openFolder(exportedPath);
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
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
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Export Result</h2>
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
            background: 'rgba(239,68,68,0.12)',
            color: '#f87171',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {/* Export Mode Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '500' }}>Export Mode</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {([
              { value: 'patch_zip', label: 'Patch ZIP', desc: 'Changed files only (added + modified)' },
              { value: 'full_merge', label: 'Full Merge', desc: 'Entire new tree with cherry-picks applied' },
              { value: 'new_only', label: 'New Only', desc: 'New source files as-is, no edits' },
            ] as const).map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', gap: '8px' }}>
                <input
                  type="radio"
                  value={opt.value}
                  checked={exportMode === opt.value}
                  onChange={(e) => { setExportMode(e.target.value as any); setSelectedPaths([]); }}
                  style={{ marginRight: '8px', marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{opt.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* File Selection */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Files ({eligibleFiles.length} eligible)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSelectAll} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }}>
                Select All
              </button>
              <button onClick={handleSelectNone} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }}>
                Select None
              </button>
            </div>
          </div>
          <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px' }}>
            {eligibleFiles.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No files match this export mode
              </div>
            ) : (
              eligibleFiles.map((file, index) => (
                <div
                  key={file.relative_path}
                  onClick={() => handleToggleFile(file.relative_path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    background: selectedPaths.includes(file.relative_path) ? 'var(--active-bg)' : 'transparent',
                    cursor: 'pointer',
                    borderBottom: index !== eligibleFiles.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPaths.includes(file.relative_path)}
                    onChange={() => {}}
                    style={{ marginRight: '8px', accentColor: 'var(--accent)' }}
                  />
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
                    marginLeft: '8px',
                    minWidth: '60px',
                    textAlign: 'right'
                  }}>
                    {file.status === 'added' && (
                      <span style={{ color: '#4ade80' }}>+ Added</span>
                    )}
                    {file.status === 'modified' && (
                      <span style={{ color: '#fbbf24' }}>~ Modified</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Preview */}
        <div style={{
          borderRadius: '6px',
          border: '1px solid var(--border)',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '12px',
          background: 'var(--card)'
        }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Will export:</div>
          <div style={{ fontWeight: '500' }}>{selectedPaths.length} files · ~{estimatedSize}</div>
        </div>

        {/* Export Summary (shown after export) */}
        {exportSummary && !isExporting && (
          <div style={{
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#4ade80',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
              ✓ Exported {exportSummary.files_exported} files
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Hunks accepted:</span>
              <span>{exportSummary.hunks_accepted}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Hunks rejected:</span>
              <span>{exportSummary.hunks_rejected}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Hunks edited:</span>
              <span>{exportSummary.hunks_edited}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Output size:</span>
              <span>{(exportSummary.output_size_bytes / 1024).toFixed(1)} KB</span>
            </div>
            <button
              onClick={handleOpenFolder}
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: '11px', borderColor: 'rgba(34,197,94,0.35)', color: '#4ade80' }}
            >
              Open Folder
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {exportSummary ? (
            <button
              onClick={onCancel}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--accent-blue)' }}
            >
              Done
            </button>
          ) : (
            <>
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
                style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--accent-blue)' }}
                disabled={isExporting || selectedPaths.length === 0}
              >
                {isExporting ? 'Exporting...' : 'Export ZIP ↓'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}