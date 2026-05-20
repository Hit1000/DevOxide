import { invoke } from '@tauri-apps/api/core';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FileNode {
  relative_path: string;
  status: 'added' | 'removed' | 'modified' | 'identical' | 'binary';
  old_hash: string | null;
  new_hash: string | null;
  is_binary: boolean;
  old_size: number;
  new_size: number;
}

export interface Hunk {
  hunk_id: string;
  old_start: number;
  old_lines: string[];
  new_start: number;
  new_lines: string[];
  state: 'accepted' | 'rejected' | 'edited';
  edited_content: string | null;
  is_exception: boolean;
}

export interface DiffLine {
  kind: 'equal' | 'added' | 'removed';
  old_line_no: number | null;
  new_line_no: number | null;
  content: string;
  hunk_id: string;
}

export interface ResultLine {
  kind: 'equal' | 'accepted' | 'rejected' | 'edited';
  content: string;
  hunk_id: string | null;
}

export interface FileDiff {
  relative_path: string;
  status: string;
  hunks: Hunk[];
  old_content: string | null;
  new_content: string | null;
  diff_lines: DiffLine[];
  result_lines: ResultLine[];
}

export interface SessionResult {
  session_id: string;
  file_tree: FileNode[];
  added_count: number;
  removed_count: number;
  modified_count: number;
  identical_count: number;
  binary_count: number;
  old_label: string;
  new_label: string;
}

export interface ExportSummary {
  files_exported: number;
  hunks_accepted: number;
  hunks_rejected: number;
  hunks_edited: number;
  output_size_bytes: number;
}

// ── API wrappers ──────────────────────────────────────────────────────────────
export async function openDiffSession(
  oldSource: string,
  newSource: string,
  ignorePatterns: string[] = []
): Promise<SessionResult> {
  return invoke('open_diff_session', {
    oldSource, newSource, ignorePatterns,
  });
}

export async function getFileDiff(
  sessionId: string,
  relativePath: string
): Promise<FileDiff> {
  return invoke('get_file_diff', { sessionId, relativePath });
}

export async function setHunkState(
  sessionId: string,
  relativePath: string,
  hunkId: string,
  state: 'accepted' | 'rejected' | 'edited',
  editedContent?: string
): Promise<void> {
  return invoke('set_hunk_state', {
    sessionId, relativePath, hunkId, state,
    editedContent: editedContent ?? null,
  });
}

export async function setAllHunks(
  sessionId: string,
  relativePath: string,
  state: 'accepted' | 'rejected'
): Promise<void> {
  return invoke('set_all_hunks', { sessionId, relativePath, state });
}

export async function previewFileResult(
  sessionId: string,
  relativePath: string
): Promise<string> {
  return invoke('preview_file_result', { sessionId, relativePath });
}

export async function exportResult(
  sessionId: string,
  selectedPaths: string[],
  exportMode: string,
  outputPath: string
): Promise<ExportSummary> {
  return invoke('export_result', {
    sessionId, selectedPaths, exportMode, outputPath,
  });
}

export async function closeDiffSession(sessionId: string): Promise<void> {
  return invoke('close_diff_session', { sessionId });
}

export async function saveFileEdit(
  sessionId: string,
  relativePath: string,
  content: string
): Promise<void> {
  return invoke('save_file_edit', { sessionId, relativePath, content });
}

export async function clearFileEdit(
  sessionId: string,
  relativePath: string
): Promise<void> {
  return invoke('clear_file_edit', { sessionId, relativePath });
}
