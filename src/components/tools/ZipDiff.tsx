import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useZipDiff } from './ZipDiff/useZipDiff';
import { FileTree } from './ZipDiff/FileTree';
import { DiffPanel } from './ZipDiff/DiffPanel';
import { IgnoreRulesPanel } from './ZipDiff/IgnoreRulesPanel';
import { ExceptionRules } from './ZipDiff/ExceptionRules';
import { ExportDialog } from './ZipDiff/ExportDialog';
import { ProgressOverlay } from './ZipDiff/ProgressOverlay';
import { ExceptionRulesDialog } from './ZipDiff/ExceptionRulesDialog';
import { Icons } from '../Icons';
import { usePersistedState } from '../../hooks/useStore';

export function ZipDiff() {
  const {
    sessionId,
    oldSourceLabel,
    newSourceLabel,
    files,
    ignorePatterns,
    exceptionRules,
    activeFile,
    isLoading,
    progress,
    exportDialogOpen,
    setExportDialogOpen,
    exceptionDialogOpen,
    setExceptionDialogOpen,
    handleDrop,
    handleBrowseOld,
    handleBrowseOldFolder,
    handleBrowseNew,
    handleBrowseNewFolder,
    handleIgnoreChange,
    handleRerunDiff,
    handleExceptionAdd,
    handleExport,
    handleCloseSession,
    handleFileSelect,
    handleHunkAction,
    handleHunkStatsChange,
    hunkStats,
    ignoreDirty,
  } = useZipDiff();

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidths, setPanelWidths, widthsLoaded] = usePersistedState(
    'panel_widths',
    { sidebar: 240, fileTree: 260, diffLeft: 33, diffMid: 33 },
    200
  );
  const [sidebarWidth, setSidebarWidth] = useState(panelWidths.sidebar);
  const [fileTreeWidth, setFileTreeWidth] = useState(panelWidths.fileTree);

  useEffect(() => {
    if (!widthsLoaded) return;
    setSidebarWidth(panelWidths.sidebar);
    setFileTreeWidth(panelWidths.fileTree);
  }, [widthsLoaded, panelWidths.sidebar, panelWidths.fileTree]);

  // Handle drag over effects
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('drag-over');
  };

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('drag-over');
    
    const items = Array.from(e.dataTransfer.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile());
    
    if (items.length >= 2) {
      // For simplicity, we'll take first two files/folders
      // In a real implementation, we'd need to handle paths better
      // This is a limitation - we'd need to use Tauri's dialog for folder selection
      // For now, we'll just note this needs improvement
      console.log('Multiple files dropped:', items.length);
    }
  };

  const startSidebarDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let latestWidth = startWidth;

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      const next = Math.max(180, Math.min(300, startWidth + (moveEvent.clientX - startX)));
      latestWidth = next;
      setSidebarWidth(next);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setPanelWidths({
        ...panelWidths,
        sidebar: latestWidth,
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth, panelWidths, setPanelWidths]);

  const startFileTreeDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = fileTreeWidth;
    let latestWidth = startWidth;

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      const next = Math.max(200, Math.min(400, startWidth + (moveEvent.clientX - startX)));
      latestWidth = next;
      setFileTreeWidth(next);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setPanelWidths({
        ...panelWidths,
        fileTree: latestWidth,
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [fileTreeWidth, panelWidths, setPanelWidths]);

  return (
    <div ref={containerRef} className="zip-diff-container" style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Left Sidebar */}
      <div className="zip-diff-sidebar" style={{ width: `${sidebarWidth}px`, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--sidebar-bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Zip Diff</h2>
          <button 
            onClick={handleCloseSession}
            className="icon-btn"
            style={{ padding: '4px' }}
            title="Close Session"
          >
            <Icons.x />
          </button>
        </div>
        
        {/* Source Input Section */}
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--text-muted)' }}>Source Comparison</h3>
            <div className="source-inputs" style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <div 
                  onDrop={handleDropZone}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className="drop-zone"
                  style={{
                    border: '2px dashed var(--border-light)',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: dropZoneRef.current?.classList.contains('drag-over') ? 'var(--accent-bg)' : 'var(--bg)',
                    minHeight: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <Icons.upload />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Drop OLD here</span>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    <button
                      onClick={handleBrowseOld}
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      title="Browse for ZIP file"
                    >
                      ZIP
                    </button>
                    <button
                      onClick={handleBrowseOldFolder}
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      title="Browse for folder"
                    >
                      Folder
                    </button>
                  </div>
                </div>
                {oldSourceLabel && (
                  <div
                    title={oldSourceLabel}
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: 'var(--accent-bg)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      direction: 'rtl',
                      textAlign: 'left',
                      cursor: 'help',
                      fontFamily: 'monospace'
                    }}
                  >
                    {oldSourceLabel}
                  </div>
                )}
              </div>
              
              <div className="vs" style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-muted)' }}>VS</span>
              </div>
              
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <div 
                  onDrop={handleDropZone}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className="drop-zone"
                  style={{
                    border: '2px dashed var(--border-light)',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: dropZoneRef.current?.classList.contains('drag-over') ? 'var(--accent-bg)' : 'var(--bg)',
                    minHeight: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <Icons.upload />
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Drop NEW here</span>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    <button
                      onClick={handleBrowseNew}
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      title="Browse for ZIP file"
                    >
                      ZIP
                    </button>
                    <button
                      onClick={handleBrowseNewFolder}
                      className="btn btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      title="Browse for folder"
                    >
                      Folder
                    </button>
                  </div>
                </div>
                {newSourceLabel && (
                  <div
                    title={newSourceLabel}
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      background: 'var(--accent-bg)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      direction: 'rtl',
                      textAlign: 'left',
                      cursor: 'help',
                      fontFamily: 'monospace'
                    }}
                  >
                    {newSourceLabel}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* File Counts */}
          {sessionId && (
            <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Added:</span>
                <span style={{ color: 'var(--success)' }}>{files.filter(f => f.status === 'added').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Removed:</span>
                <span style={{ color: 'var(--error)' }}>{files.filter(f => f.status === 'removed').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Modified:</span>
                <span style={{ color: 'var(--warning)' }}>{files.filter(f => f.status === 'modified').length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Identical:</span>
                <span>{files.filter(f => f.status === 'identical').length}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Ignore Rules Panel */}
        {sessionId && (
          <>
            {ignoreDirty && (
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  ⚠ Ignore rules changed —{' '}
                  <button
                    onClick={handleRerunDiff}
                    className="btn btn-ghost"
                    style={{ padding: 0, fontSize: '12px', textDecoration: 'underline' }}
                  >
                    Re-run diff to apply
                  </button>
                </div>
              </div>
            )}
            <IgnoreRulesPanel 
              ignorePatterns={ignorePatterns} 
              onChange={handleIgnoreChange}
            />
          </>
        )}
        
        {/* Exception Rules Panel */}
        {sessionId && activeFile && (
          <ExceptionRules 
            exceptionRules={exceptionRules} 
            onAdd={handleExceptionAdd}
          />
        )}
        
        {/* Export Button */}
        {sessionId && (
          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <button 
              onClick={() => setExportDialogOpen(true)}
              className="btn btn-primary w-full"
              style={{ height: '40px', fontSize: '13px', fontWeight: '500' }}
              disabled={isLoading}
            >
              {isLoading ? 'Exporting...' : 'Export ▼'}
            </button>
          </div>
        )}
      </div>
      
      <div
        onMouseDown={startSidebarDrag}
        className="zip-diff-resize-handle"
        style={{ width: '4px', cursor: 'col-resize', background: 'var(--border)', flexShrink: 0 }}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        {/* File Tree */}
        <div className="zip-diff-file-tree" style={{ width: `${fileTreeWidth}px`, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--sidebar-bg)', overflowY: 'auto' }}>
          <FileTree 
            files={files} 
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            hunkStats={hunkStats}
          />
        </div>

        <div
          onMouseDown={startFileTreeDrag}
          className="zip-diff-resize-handle"
          style={{ width: '4px', cursor: 'col-resize', background: 'var(--border)', flexShrink: 0 }}
        />
        
        {/* Diff Panel */}
        <div className="zip-diff-diff-panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DiffPanel
            sessionId={sessionId}
            activeFile={activeFile}
            files={files}
            onHunkAction={handleHunkAction}
            onHunkStatsChange={handleHunkStatsChange}
            onOpenExport={() => setExportDialogOpen(true)}
            onRerunDiff={handleRerunDiff}
            panelPercents={[panelWidths.diffLeft, panelWidths.diffMid, 100 - panelWidths.diffLeft - panelWidths.diffMid]}
            onPanelPercentsChange={next => {
              setPanelWidths({
                ...panelWidths,
                diffLeft: next[0],
                diffMid: next[1],
              });
            }}
          />
          
          {/* Progress Overlay */}
          {isLoading && <ProgressOverlay progress={progress} />}
          
          {/* Export Dialog */}
          {exportDialogOpen && (
            <ExportDialog 
              files={files}
              onExport={handleExport}
              onCancel={() => setExportDialogOpen(false)}
            />
          )}
          
          {/* Exception Dialog */}
          {exceptionDialogOpen && (
            <ExceptionRulesDialog
              onAdd={(pattern, type) => { handleExceptionAdd(pattern, type); setExceptionDialogOpen(false); }}
              onCancel={() => setExceptionDialogOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}