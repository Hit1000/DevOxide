import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, Decoration, GutterMarker, gutter, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, StateField, Compartment, StateEffect } from '@codemirror/state';
import { getFileDiff, setAllHunks, saveFileEdit, clearFileEdit, type DiffLine, type ResultLine, type Hunk } from './api';
import { useScrollSync } from '../../../hooks/useScrollSync';
import { useResizable } from '../../../hooks/useResizable';

interface DiffPanelProps {
  sessionId: string | null;
  activeFile: string | null;
  files: Array<{
    relative_path: string;
    status: 'added' | 'removed' | 'modified' | 'identical' | 'binary';
    old_hash: string | null;
    new_hash: string | null;
    is_binary: boolean;
    old_size: number;
    new_size: number;
  }>;
  onHunkAction: (relativePath: string, hunkId: string, action: 'accept' | 'reject' | 'edit', editedContent?: string) => Promise<void>;
  onHunkStatsChange?: (relativePath: string, stats: HunkStats) => void;
  onOpenExport?: () => void;
  onRerunDiff?: () => void;
  panelPercents?: [number, number, number];
  onPanelPercentsChange?: (percents: [number, number, number]) => void;
}

type PanelKind = 'equal' | 'added' | 'removed' | 'accepted' | 'rejected' | 'edited';

interface PanelLine {
  content: string;
  kind: PanelKind;
  lineNo: number | null;
  hunkId: string | null;
}

interface HunkStats {
  accepted: number;
  rejected: number;
  edited: number;
  total: number;
}

const lineClassByKind: Record<PanelKind, string | null> = {
  equal: null,
  added: 'cm-line-added',
  removed: 'cm-line-removed',
  accepted: 'cm-line-accepted',
  rejected: 'cm-line-rejected',
  edited: 'cm-line-edited',
};

class DiffMarker extends GutterMarker {
  constructor(private label: string, private className?: string) {
    super();
  }

  toDOM() {
    const el = document.createElement('span');
    el.textContent = this.label;
    el.className = this.className ?? '';
    return el;
  }
}

class LineNumberMarker extends GutterMarker {
  constructor(private label: string) {
    super();
  }

  toDOM() {
    const el = document.createElement('span');
    el.textContent = this.label;
    return el;
  }
}

class HunkBarWidget extends WidgetType {
  constructor(
    private hunk: Hunk,
    private index: number,
    private total: number,
    private onAccept: (hunkId: string) => void,
    private onReject: (hunkId: string) => void,
    private onEdit: (hunkId: string) => void
  ) {
    super();
  }

  toDOM() {
    const el = document.createElement('div');
    el.className = 'cm-hunk-bar';
    el.addEventListener('mousedown', event => event.preventDefault());

    const label = document.createElement('span');
    label.className = 'cm-hunk-bar-label';
    label.textContent = `Hunk ${this.index}/${this.total}`;
    el.appendChild(label);

    const range = document.createElement('span');
    range.className = 'cm-hunk-bar-range';
    range.textContent = `@@ -${this.hunk.old_start},${this.hunk.old_lines.length} +${this.hunk.new_start},${this.hunk.new_lines.length} @@`;
    el.appendChild(range);

    const spacer = document.createElement('span');
    spacer.className = 'cm-hunk-bar-spacer';
    el.appendChild(spacer);

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = `cm-hunk-action ${this.hunk.state === 'accepted' ? 'is-accepted' : ''}`;
    acceptBtn.textContent = '✓ Accept';
    acceptBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onAccept(this.hunk.hunk_id);
    });
    el.appendChild(acceptBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = `cm-hunk-action ${this.hunk.state === 'rejected' ? 'is-rejected' : ''}`;
    rejectBtn.textContent = '✗ Reject';
    rejectBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onReject(this.hunk.hunk_id);
    });
    el.appendChild(rejectBtn);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = `cm-hunk-action ${this.hunk.state === 'edited' ? 'is-edited' : ''}`;
    editBtn.textContent = '✎ Edit';
    editBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      this.onEdit(this.hunk.hunk_id);
    });
    el.appendChild(editBtn);

    return el;
  }
}

function buildDiffExtensions(
  lines: PanelLine[],
  hunks: Hunk[],
  options: {
    showDiffGutter: boolean;
    showLineNumbers: boolean;
    showHunkBars: boolean;
    onAccept: (hunkId: string) => void;
    onReject: (hunkId: string) => void;
    onEdit: (hunkId: string) => void;
  }
) {
  const decorationField = StateField.define<ReturnType<RangeSetBuilder<Decoration>['finish']>>({
    create(state) {
      const builder = new RangeSetBuilder<Decoration>();

      lines.forEach((line, index) => {
        const className = lineClassByKind[line.kind];
        if (className) {
          const linePos = state.doc.line(index + 1).from;
          builder.add(linePos, linePos, Decoration.line({ class: className }));
        }
      });

      if (options.showHunkBars) {
        const hunkStarts = new Map<string, number>();
        lines.forEach((line, index) => {
          if (!line.hunkId) return;
          if (!hunkStarts.has(line.hunkId)) {
            hunkStarts.set(line.hunkId, index);
          }
        });

        hunks.forEach((hunk, idx) => {
          const startIndex = hunkStarts.get(hunk.hunk_id);
          if (startIndex === undefined) return;
          const linePos = state.doc.line(startIndex + 1).from;
          builder.add(
            linePos,
            linePos,
            Decoration.widget({
              widget: new HunkBarWidget(hunk, idx + 1, hunks.length, options.onAccept, options.onReject, options.onEdit),
              side: -1,
              block: true,
            })
          );
        });
      }

      return builder.finish();
    },
    update(decorations, transaction) {
      if (transaction.docChanged) {
        return decorations.map(transaction.changes);
      }
      return decorations;
    },
    provide: field => EditorView.decorations.from(field),
  });

  const lineNumberGutter = options.showLineNumbers
    ? gutter({
        class: 'cm-line-number-gutter',
        lineMarker(view, line) {
          const index = view.state.doc.lineAt(line.from).number - 1;
          const lineNo = lines[index]?.lineNo;
          return new LineNumberMarker(lineNo ? String(lineNo) : '');
        },
      })
    : [];

  const diffMarkerGutter = options.showDiffGutter
    ? gutter({
        class: 'cm-diff-gutter',
        lineMarker(view, line) {
          const index = view.state.doc.lineAt(line.from).number - 1;
          const kind = lines[index]?.kind;
          if (kind === 'added') return new DiffMarker('+', 'cm-gutter-added');
          if (kind === 'removed') return new DiffMarker('-', 'cm-gutter-removed');
          return new DiffMarker('');
        },
      })
    : [];

  return [decorationField, lineNumberGutter, diffMarkerGutter];
}

function buildOldLines(lines: DiffLine[]): PanelLine[] {
  return lines.map(line => ({
    content: line.kind === 'added' ? '' : line.content,
    kind: line.kind === 'removed' ? 'removed' : 'equal',
    lineNo: line.old_line_no,
    hunkId: line.hunk_id || null,
  }));
}

function buildNewLines(lines: DiffLine[]): PanelLine[] {
  return lines.map(line => ({
    content: line.kind === 'removed' ? '' : line.content,
    kind: line.kind === 'added' ? 'added' : 'equal',
    lineNo: line.new_line_no,
    hunkId: line.hunk_id || null,
  }));
}

function buildResultLines(lines: ResultLine[]): PanelLine[] {
  return lines.map((line, index) => ({
    content: line.content,
    kind: line.kind,
    lineNo: index + 1,
    hunkId: line.hunk_id ?? null,
  }));
}

function getSizeLabel(file: DiffPanelProps['files'][0]) {
  if (file.status === 'identical') return 'Identical';
  if (file.status === 'binary') return 'Binary';
  if (file.status === 'added') return `Added — ${file.new_size} B`;
  if (file.status === 'removed') return `Removed — ${file.old_size} B`;
  if (file.status === 'modified') return `Modified — ${file.old_size} B → ${file.new_size} B`;
  return '';
}

export function DiffPanel({
  sessionId,
  activeFile,
  files,
  onHunkAction,
  onHunkStatsChange,
  onOpenExport,
  onRerunDiff,
  panelPercents,
  onPanelPercentsChange,
}: DiffPanelProps) {
  const [diff, setDiff] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [resultContent, setResultContent] = useState('');
  const [editDirty, setEditDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editCompartmentRef = useRef<Compartment | null>(null);

  const [oldView, setOldView] = useState<EditorView | null>(null);
  const [newView, setNewView] = useState<EditorView | null>(null);
  const [resultView, setResultView] = useState<EditorView | null>(null);

  const [syncEnabled, setSyncEnabled] = useState(false);
  const diffContainerRef = useRef<HTMLDivElement | null>(null);
  const initialPercents = panelPercents ?? [33, 33, 34];
  const { percents, setPercents, startDrag } = useResizable(
    diffContainerRef,
    initialPercents,
    15,
    60,
    onPanelPercentsChange
  );

  const reloadDiffAndPreview = useCallback(async () => {
    if (!sessionId || !activeFile) {
      setDiff(null);
      setResultContent('');
      return;
    }

    setIsLoading(true);
    try {
      const fileDiff = await getFileDiff(sessionId, activeFile);
      setDiff(fileDiff);

      if (onHunkStatsChange && fileDiff?.hunks) {
        const stats = fileDiff.hunks.reduce<HunkStats>((acc: HunkStats, hunk: Hunk) => {
          if (hunk.state === 'accepted') acc.accepted += 1;
          if (hunk.state === 'rejected') acc.rejected += 1;
          if (hunk.state === 'edited') acc.edited += 1;
          acc.total += 1;
          return acc;
        }, { accepted: 0, rejected: 0, edited: 0, total: 0 });
        onHunkStatsChange(activeFile, stats);
      }
    } catch (err) {
      console.error('Failed to load diff:', err);
      setDiff(null);
      setResultContent('');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, activeFile]);

  useEffect(() => {
    reloadDiffAndPreview();
  }, [reloadDiffAndPreview]);

  useEffect(() => {
    if (!diff) {
      setResultContent('');
      return;
    }

    if (!editMode) {
      const next = diff.result_lines?.map((line: ResultLine) => line.content).join('\n') ?? '';
      setResultContent(next);
      setEditDirty(false);
    }
  }, [diff, editMode]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const handler = (event: MediaQueryListEvent) => setSyncEnabled(event.matches);
    setSyncEnabled(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (panelPercents) {
      setPercents(panelPercents);
    }
  }, [panelPercents, setPercents]);

  const syncViews = useMemo(
    () => (syncEnabled ? [oldView, newView, resultView] : []),
    [syncEnabled, oldView, newView, resultView]
  );
  useScrollSync(syncViews);

  // Toggle result panel editability via Compartment reconfiguration
  useEffect(() => {
    if (!resultView) return;
    const compartment = editCompartmentRef.current ?? new Compartment();
    editCompartmentRef.current = compartment;

    resultView.dispatch({
      effects: [
        StateEffect.reconfigure.of([
          compartment.of(EditorView.editable.of(editMode)),
        ]),
      ],
    });
  }, [editMode, resultView]);

  const file = files.find(f => f.relative_path === activeFile);

  const diffLines: DiffLine[] = diff?.diff_lines ?? [];
  const oldLines = useMemo(() => buildOldLines(diffLines), [diffLines]);
  const newLines = useMemo(() => buildNewLines(diffLines), [diffLines]);
  const resultLines = useMemo(() => {
    if (!diff?.result_lines) return [] as PanelLine[];
    if (editMode) {
      return resultContent.split('\n').map((line, index) => ({
        content: line,
        kind: 'edited' as PanelKind,
        lineNo: index + 1,
        hunkId: null,
      }));
    }
    return buildResultLines(diff.result_lines as ResultLine[]);
  }, [diff, editMode, resultContent]);

  const oldValue = useMemo(() => oldLines.map(line => line.content).join('\n'), [oldLines]);
  const newValue = useMemo(() => newLines.map(line => line.content).join('\n'), [newLines]);
  const resultValue = useMemo(() => resultLines.map(line => line.content).join('\n'), [resultLines]);

  if (!activeFile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Select a file to see the diff
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        File not found
      </div>
    );
  }

  const hunks: Hunk[] = diff?.hunks ?? [];
  const hunkStartLines = useMemo(() => {
    const map = new Map<string, number>();
    resultLines.forEach((line, index) => {
      if (!line.hunkId) return;
      if (!map.has(line.hunkId)) {
        map.set(line.hunkId, index + 1);
      }
    });
    return map;
  }, [resultLines]);

  const [currentHunkIndex, setCurrentHunkIndex] = useState(0);
  const hunkHistoryRef = useRef<Array<{ hunkId: string; prevState: Hunk['state'] }>>([]);

  useEffect(() => {
    setCurrentHunkIndex(0);
  }, [activeFile]);

  useEffect(() => {
    if (currentHunkIndex >= hunks.length && hunks.length > 0) {
      setCurrentHunkIndex(hunks.length - 1);
    }
  }, [hunks.length, currentHunkIndex]);

  const scrollToHunk = useCallback((index: number) => {
    if (!resultView) return;
    const hunk = hunks[index];
    if (!hunk) return;
    const lineNo = hunkStartLines.get(hunk.hunk_id);
    if (!lineNo) return;
    const pos = resultView.state.doc.line(lineNo).from;
    resultView.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
  }, [resultView, hunks, hunkStartLines]);

  useEffect(() => {
    if (!hunks.length) return;
    scrollToHunk(currentHunkIndex);
  }, [currentHunkIndex, hunks.length, scrollToHunk]);

  const handleSaveEdit = useCallback((value: string) => {
    setResultContent(value);
    setEditDirty(true);

    if (!sessionId || !activeFile) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveFileEdit(sessionId, activeFile, value).catch(err => {
        console.error('Failed to save edit:', err);
      });
    }, 300);
  }, [sessionId, activeFile]);

  const handleRevertEdit = useCallback(async () => {
    if (!sessionId || !activeFile) return;
    await clearFileEdit(sessionId, activeFile);
    setEditDirty(false);
    await reloadDiffAndPreview();
  }, [sessionId, activeFile, reloadDiffAndPreview]);

  const recordHunkState = useCallback((hunkId: string) => {
    const prev = hunks.find(hunk => hunk.hunk_id === hunkId)?.state;
    if (!prev) return;
    hunkHistoryRef.current.push({ hunkId, prevState: prev });
  }, [hunks]);

  const handleHunkAccept = useCallback(async (hunkId: string) => {
    if (!sessionId || !activeFile) return;
    recordHunkState(hunkId);
    await onHunkAction(activeFile, hunkId, 'accept');
    await reloadDiffAndPreview();
  }, [sessionId, activeFile, onHunkAction, reloadDiffAndPreview, recordHunkState]);

  const handleHunkReject = useCallback(async (hunkId: string) => {
    if (!sessionId || !activeFile) return;
    recordHunkState(hunkId);
    await onHunkAction(activeFile, hunkId, 'reject');
    await reloadDiffAndPreview();
  }, [sessionId, activeFile, onHunkAction, reloadDiffAndPreview, recordHunkState]);

  const handleHunkEdit = useCallback((hunkId: string) => {
    if (!hunkId) return;
    setEditMode(true);
  }, []);

  useEffect(() => {
    if (!sessionId || !activeFile) return;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.cm-editor'))) {
        return;
      }

      const key = event.key.toLowerCase();
      if (event.key === 'F5') {
        event.preventDefault();
        onRerunDiff?.();
        return;
      }

      if (event.ctrlKey && event.shiftKey && key === 'e') {
        event.preventDefault();
        onOpenExport?.();
        return;
      }

      if (event.ctrlKey && key === 'z') {
        event.preventDefault();
        const last = hunkHistoryRef.current.pop();
        if (!last) return;
        if (last.prevState === 'accepted' || last.prevState === 'rejected') {
          onHunkAction(activeFile, last.hunkId, last.prevState === 'accepted' ? 'accept' : 'reject')
            .then(() => reloadDiffAndPreview())
            .catch(err => console.error('Failed to undo hunk:', err));
        }
        return;
      }

      if (event.shiftKey && key === 'a') {
        event.preventDefault();
        setAllHunks(sessionId, activeFile, 'accepted')
          .then(() => reloadDiffAndPreview())
          .catch(err => console.error('Failed to accept all hunks:', err));
        return;
      }

      if (event.shiftKey && key === 'r') {
        event.preventDefault();
        setAllHunks(sessionId, activeFile, 'rejected')
          .then(() => reloadDiffAndPreview())
          .catch(err => console.error('Failed to reject all hunks:', err));
        return;
      }

      if (key === 'n' || event.key === 'ArrowDown') {
        event.preventDefault();
        setCurrentHunkIndex(prev => Math.min(hunks.length - 1, prev + 1));
        return;
      }

      if (key === 'p' || event.key === 'ArrowUp') {
        event.preventDefault();
        setCurrentHunkIndex(prev => Math.max(0, prev - 1));
        return;
      }

      if (key === 'a') {
        event.preventDefault();
        const hunk = hunks[currentHunkIndex];
        if (hunk) handleHunkAccept(hunk.hunk_id);
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        const hunk = hunks[currentHunkIndex];
        if (hunk) handleHunkReject(hunk.hunk_id);
        return;
      }

      if (key === 'e') {
        event.preventDefault();
        const hunk = hunks[currentHunkIndex];
        if (hunk) handleHunkEdit(hunk.hunk_id);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    sessionId,
    activeFile,
    hunks,
    currentHunkIndex,
    onOpenExport,
    onRerunDiff,
    onHunkAction,
    reloadDiffAndPreview,
    handleHunkAccept,
    handleHunkReject,
    handleHunkEdit,
  ]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* File Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '12px 16px', 
        borderBottom: '1px solid var(--border)',
        background: 'var(--sidebar-bg)',
        flexShrink: 0
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
              {activeFile.split('/').pop()}
            </h3>
            <span
              title={activeFile}
              style={{
                fontSize: '11px',
                color: 'var(--text-dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                direction: 'rtl',
                textAlign: 'left',
                flex: 1,
                minWidth: 0
              }}
            >
              {activeFile}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            {getSizeLabel(file)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setEditMode(prev => !prev)}
            className={editMode ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ padding: '4px 8px', fontSize: '12px', background: editMode ? '#b45309' : undefined }}
            title="Toggle Edit Mode"
          >
            {editMode ? 'Editing ✎' : 'Edit'}
          </button>
          {editMode && (
            <button
              onClick={handleRevertEdit}
              className="btn btn-outline"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Revert
            </button>
          )}
          <button 
            onClick={async () => {
              if (sessionId && activeFile) {
                await setAllHunks(sessionId, activeFile, 'accepted');
                await reloadDiffAndPreview();
              }
            }}
            className="btn btn-outline"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            Accept All
          </button>
          {onOpenExport && (
            <button
              onClick={onOpenExport}
              className="btn btn-primary"
              style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--accent-blue)' }}
            >
              ↓ Export
            </button>
          )}
        </div>
      </div>
      
      {/* Diff Content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'var(--text-muted)', 
            fontSize: '14px'
          }}>
            Loading diff...
          </div>
        ) : (
          <>
            {/* File status specific views */}
            {file.status === 'binary' && (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--text-muted)', 
                fontSize: '14px'
              }}>
                Binary file - cannot display diff
                {file.old_size && file.new_size && (
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    {file.old_size} bytes → {file.new_size} bytes
                  </div>
                )}
              </div>
            )}
            
            {file.status === 'identical' && (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--text-muted)', 
                fontSize: '14px'
              }}>
                Files are identical
              </div>
            )}
            
            {(file.status === 'added' || file.status === 'removed' || file.status === 'modified') && diff && (
              <div ref={diffContainerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                {/* Old File Panel */}
                <div style={{ 
                  width: `${percents[0]}%`,
                  minWidth: 0, 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  borderRight: file.status === 'added' ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ 
                    padding: '8px 12px', 
                    borderBottom: '1px solid var(--border)', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-muted)',
                    background: 'var(--bg)'
                  }}>
                    Original
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                    <CodeMirror
                      value={oldValue}
                      height="100%"
                      style={{ height: '100%', flex: 1, overflow: 'hidden' }}
                      onCreateEditor={setOldView}
                      extensions={buildDiffExtensions(oldLines, hunks, {
                        showDiffGutter: true,
                        showLineNumbers: true,
                        showHunkBars: true,
                        onAccept: handleHunkAccept,
                        onReject: handleHunkReject,
                        onEdit: handleHunkEdit,
                      })}
                      editable={false}
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                        bracketMatching: false,
                        autocompletion: false,
                      }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div
                  onMouseDown={startDrag(0)}
                  className="zip-diff-resize-handle zip-diff-resize-handle-interactive"
                  style={{ width: '4px', cursor: 'col-resize', background: 'var(--border)', flexShrink: 0, position: 'relative' }}
                >
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    display: 'flex', flexDirection: 'column', gap: '2px', opacity: 0, transition: 'opacity 0.15s',
                  }} className="resize-grip-dots">
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                    ))}
                  </div>
                </div>

                {/* New File Panel */}
                <div style={{ 
                  width: `${percents[1]}%`,
                  minWidth: 0, 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  borderRight: file.status === 'removed' ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{ 
                    padding: '8px 12px', 
                    borderBottom: '1px solid var(--border)', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-muted)',
                    background: 'var(--bg)'
                  }}>
                    New
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                    <CodeMirror
                      value={newValue}
                      height="100%"
                      style={{ height: '100%', flex: 1, overflow: 'hidden' }}
                      onCreateEditor={setNewView}
                      extensions={buildDiffExtensions(newLines, hunks, {
                        showDiffGutter: true,
                        showLineNumbers: true,
                        showHunkBars: true,
                        onAccept: handleHunkAccept,
                        onReject: handleHunkReject,
                        onEdit: handleHunkEdit,
                      })}
                      editable={false}
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                        bracketMatching: false,
                        autocompletion: false,
                      }}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div
                  onMouseDown={startDrag(1)}
                  className="zip-diff-resize-handle zip-diff-resize-handle-interactive"
                  style={{ width: '4px', cursor: 'col-resize', background: 'var(--border)', flexShrink: 0, position: 'relative' }}
                >
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    display: 'flex', flexDirection: 'column', gap: '2px', opacity: 0, transition: 'opacity 0.15s',
                  }} className="resize-grip-dots">
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
                    ))}
                  </div>
                </div>

                {/* Result Panel */}
                <div style={{ 
                  width: `${percents[2]}%`,
                  minWidth: 0, 
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    borderBottom: '1px solid var(--border)', 
                    fontSize: '12px', 
                    fontWeight: '500', 
                    color: 'var(--text-muted)',
                    background: 'var(--bg)',
                    gap: '8px'
                  }}>
                    <span>Result</span>
                    {editMode && editDirty && (
                      <span style={{ fontSize: '11px', color: 'var(--accent-orange)' }}>Unsaved</span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                    <CodeMirror
                      value={resultValue}
                      height="100%"
                      style={{ height: '100%', flex: 1, overflow: 'hidden' }}
                      onCreateEditor={(view) => {
                        setResultView(view);
                        editCompartmentRef.current = new Compartment();
                      }}
                      onChange={editMode ? handleSaveEdit : undefined}
                      extensions={buildDiffExtensions(resultLines, hunks, {
                        showDiffGutter: false,
                        showLineNumbers: true,
                        showHunkBars: true,
                        onAccept: handleHunkAccept,
                        onReject: handleHunkReject,
                        onEdit: handleHunkEdit,
                      })}
                      editable={editMode}
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: editMode,
                        highlightActiveLineGutter: false,
                        bracketMatching: editMode,
                        autocompletion: false,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {file.status === 'modified' && diff && (
        <div style={{ 
          padding: '10px 16px', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--sidebar-bg)',
          display: 'flex', 
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          fontSize: '12px'
        }}>
          <button
            onClick={() => setCurrentHunkIndex(prev => Math.max(0, prev - 1))}
            className="btn btn-outline"
            style={{ padding: '2px 6px', fontSize: '11px' }}
            disabled={currentHunkIndex === 0}
          >
            ← Prev
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            Hunk {hunks.length ? currentHunkIndex + 1 : 0}/{hunks.length}
          </span>
          <button
            onClick={() => setCurrentHunkIndex(prev => Math.min(hunks.length - 1, prev + 1))}
            className="btn btn-outline"
            style={{ padding: '2px 6px', fontSize: '11px' }}
            disabled={currentHunkIndex >= hunks.length - 1}
          >
            Next →
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              if (sessionId && activeFile) {
                setAllHunks(sessionId, activeFile, 'accepted')
                  .then(() => reloadDiffAndPreview())
                  .catch(err => console.error('Failed to accept all hunks:', err));
              }
            }}
            className="btn btn-outline"
            style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--success)' }}
          >
            Accept All
          </button>
          <button
            onClick={() => {
              if (sessionId && activeFile) {
                setAllHunks(sessionId, activeFile, 'rejected')
                  .then(() => reloadDiffAndPreview())
                  .catch(err => console.error('Failed to reject all hunks:', err));
              }
            }}
            className="btn btn-outline"
            style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--error)' }}
          >
            Reject All
          </button>
        </div>
      )}
    </div>
  );
}