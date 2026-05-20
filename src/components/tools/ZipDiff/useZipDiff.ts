import { useState, useEffect, useCallback } from 'react';
import {
  openDiffSession,
  getFileDiff,
  setHunkState,
  setAllHunks,
  previewFileResult,
  exportResult,
  closeDiffSession,
  type SessionResult,
  type FileNode,
  type FileDiff,
  type Hunk,
  type ExportSummary
} from './api';

interface UseZipDiffReturn {
  // Session state
  sessionId: string | null;
  oldSourceLabel: string | null;
  newSourceLabel: string | null;
  files: FileNode[];
  ignorePatterns: string[];
  exceptionRules: Array<{ id: string; pattern: string; type: string }>;
  activeFile: string | null;
  ignoreDirty: boolean;
  hunkStats: Record<string, { accepted: number; rejected: number; edited: number; total: number }>;
  
  // UI state
  isLoading: boolean;
  progress: { stage: string; current: number; total: number; current_file: string } | null;
  exportDialogOpen: boolean;
  exceptionDialogOpen: boolean;
  
  // Actions
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handleBrowseOld: () => Promise<void>;
  handleBrowseNew: () => Promise<void>;
  handleIgnoreChange: (patterns: string[]) => void;
  handleRerunDiff: () => Promise<void>;
  handleExceptionAdd: (pattern: string, type: string) => void;
  handleFileSelect: (file: FileNode) => void;
  handleHunkAction: (relativePath: string, hunkId: string, action: 'accept' | 'reject' | 'edit', editedContent?: string) => Promise<void>;
  handleBulkHunkAction: (relativePath: string, action: 'accept' | 'reject') => Promise<void>;
  handleExport: (selectedPaths: string[], exportMode: string) => Promise<void>;
  handleCloseSession: () => Promise<void>;
  handleHunkStatsChange: (relativePath: string, stats: { accepted: number; rejected: number; edited: number; total: number }) => void;
  setExportDialogOpen: (open: boolean) => void;
  setExceptionDialogOpen: (open: boolean) => void;
}

export function useZipDiff(): UseZipDiffReturn {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [oldSourceLabel, setOldSourceLabel] = useState<string | null>(null);
  const [newSourceLabel, setNewSourceLabel] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [ignorePatterns, setIgnorePatterns] = useState<string[]>([]);
  const [exceptionRules, setExceptionRules] = useState<Array<{ id: string; pattern: string; type: string }>>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [ignoreDirty, setIgnoreDirty] = useState(false);
  const [hunkStats, setHunkStats] = useState<Record<string, { accepted: number; rejected: number; edited: number; total: number }>>({});
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; current: number; total: number; current_file: string } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  
  // Progress event listener
  useEffect(() => {
    const handleProgress = (event: { 
      detail: { 
        stage: string; 
        current: number; 
        total: number; 
        current_file: string 
      } 
    }) => {
      setProgress(event.detail);
    };
    
    window.addEventListener('diff_progress', handleProgress as any);
    return () => {
      window.removeEventListener('diff_progress', handleProgress as any);
    };
  }, []);
  
  // This would be called when both sources are selected
  const startDiffSession = useCallback(async (oldSource: string, newSource: string) => {
    try {
      setIsLoading(true);
      setProgress({ stage: 'initializing', current: 0, total: 100, current_file: '' });
      
      const result = await openDiffSession(oldSource, newSource, ignorePatterns);
      setSessionId(result.session_id);
      setFiles(result.file_tree);
      setOldSourceLabel(oldSource);
      setNewSourceLabel(newSource);
      setIgnoreDirty(false);
      
    } catch (err: any) {
      console.error('Failed to start diff session:', err);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [ignorePatterns]);

  // Handle browse for old source
  const handleBrowseOld = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        directory: true, // We'll default to folders for now
      });
      if (selected && typeof selected === 'string') {
        setOldSourceLabel(selected);
        if (newSourceLabel) {
          startDiffSession(selected, newSourceLabel);
        }
      }
    } catch (err) {
      console.error('Failed to browse for old source:', err);
    }
  }, [newSourceLabel, startDiffSession]);
  
  // Handle browse for new source
  const handleBrowseNew = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        directory: true,
      });
      if (selected && typeof selected === 'string') {
        setNewSourceLabel(selected);
        if (oldSourceLabel) {
          startDiffSession(oldSourceLabel, selected);
        }
      }
    } catch (err) {
      console.error('Failed to browse for new source:', err);
    }
  }, [oldSourceLabel, startDiffSession]);

  // Handle global drag and drop from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    async function setupDragDrop() {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            if (paths && paths.length === 2) {
              setOldSourceLabel(paths[0]);
              setNewSourceLabel(paths[1]);
              startDiffSession(paths[0], paths[1]);
            } else if (paths && paths.length === 1) {
              // If only one is dropped, we arbitrarily assign it to OLD if it's empty, else NEW
              setOldSourceLabel(prevOld => {
                if (!prevOld) return paths[0];
                setNewSourceLabel(paths[0]);
                startDiffSession(prevOld, paths[0]);
                return prevOld;
              });
            }
          }
        });
      } catch (err) {
        console.error("Could not setup drag drop:", err);
      }
    }
    
    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, [startDiffSession]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    // This is essentially a no-op for HTML5 drop, since Tauri intercepts OS drops natively.
  }, []);
  

  
  // Handle ignore patterns change
  const handleIgnoreChange = useCallback((patterns: string[]) => {
    setIgnorePatterns(patterns);
    if (sessionId) {
      setIgnoreDirty(true);
    }
  }, [sessionId]);

  const handleRerunDiff = useCallback(async () => {
    if (!oldSourceLabel || !newSourceLabel) {
      return;
    }
    await startDiffSession(oldSourceLabel, newSourceLabel);
  }, [oldSourceLabel, newSourceLabel, startDiffSession]);
  
  // Handle exception rule addition
  const handleExceptionAdd = useCallback((pattern: string, type: string) => {
    setExceptionRules(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        pattern,
        type
      }
    ]);
  }, []);
  
  // Handle file selection
  const handleFileSelect = useCallback((file: FileNode) => {
    setActiveFile(file.relative_path);
  }, []);
  
  // Handle hunk actions (accept/reject/edit)
  const handleHunkAction = useCallback(async (
    relativePath: string, 
    hunkId: string, 
    action: 'accept' | 'reject' | 'edit',
    editedContent?: string
  ) => {
    try {
      setIsLoading(true);
      
      if (action === 'edit' && editedContent !== undefined) {
        await setHunkState(sessionId!, relativePath, hunkId, 'edited', editedContent);
      } else {
        await setHunkState(sessionId!, relativePath, hunkId, action);
      }
      
      // In a real implementation, we would update the diff cache here
    } catch (err: any) {
      console.error(`Failed to ${action} hunk:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);
  
  // Handle bulk hunk actions
  const handleBulkHunkAction = useCallback(async (
    relativePath: string, 
    action: 'accept' | 'reject'
  ) => {
    try {
      setIsLoading(true);
      await setAllHunks(sessionId!, relativePath, action);
      
      // In a real implementation, we would update the diff cache here
    } catch (err: any) {
      console.error(`Failed to ${action} all hunks:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);
  
  // Handle export
  const handleExport = useCallback(async (selectedPaths: string[], exportMode: string) => {
    try {
      const { save, open } = await import('@tauri-apps/plugin-dialog');
      let outputPath: string | null = null;
      
      if (exportMode === 'patch_zip') {
          outputPath = await save({ filters: [{ name: 'Zip Archive', extensions: ['zip'] }] });
      } else {
          outputPath = await open({ directory: true, multiple: false }) as string | null;
      }
      
      if (!outputPath) return; // User canceled dialog

      setIsLoading(true);
      setProgress({ stage: 'exporting', current: 0, total: 100, current_file: '' });
      
      const result = await exportResult(sessionId!, selectedPaths, exportMode, outputPath);
      // In a real implementation, we would show a success message with the result
      console.log('Export result:', result);
      
    } catch (err: any) {
      console.error('Failed to export:', err);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [sessionId]);
  
  // Handle closing session
  const handleCloseSession = useCallback(async () => {
    try {
      if (sessionId) {
        await closeDiffSession(sessionId);
        setSessionId(null);
        setFiles([]);
        setOldSourceLabel(null);
        setNewSourceLabel(null);
        setActiveFile(null);
        setIgnoreDirty(false);
        setHunkStats({});
      }
    } catch (err: any) {
      console.error('Failed to close session:', err);
    }
  }, [sessionId]);

  const handleHunkStatsChange = useCallback((relativePath: string, stats: { accepted: number; rejected: number; edited: number; total: number }) => {
    setHunkStats(prev => ({
      ...prev,
      [relativePath]: stats,
    }));
  }, []);
  
  return {
    // Session state
    sessionId,
    oldSourceLabel,
    newSourceLabel,
    files,
    ignorePatterns,
    exceptionRules,
    activeFile,
    ignoreDirty,
    hunkStats,
    
    // UI state
    isLoading,
    progress,
    exportDialogOpen,
    exceptionDialogOpen,
    
    // Actions
    handleDrop,
    handleBrowseOld,
    handleBrowseNew,
    handleIgnoreChange,
    handleRerunDiff,
    handleExceptionAdd,
    handleFileSelect,
    handleHunkAction,
    handleBulkHunkAction,
    handleExport,
    handleCloseSession,
    handleHunkStatsChange,
    setExportDialogOpen,
    setExceptionDialogOpen
  };
}