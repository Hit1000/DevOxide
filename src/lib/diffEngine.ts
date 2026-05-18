// diffEngine.ts — ported from Tools/lib/diff/compareEngine.ts
// Pure client-side diff using the 'diff' npm package (same as Tools)

import { diffLines, diffWords } from 'diff';

export interface WordSegment { value: string; type: 'equal' | 'added' | 'removed'; }

export interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'equal' | 'added' | 'removed';
  newLineNumber?: number;
  oldLineNumber?: number;
  wordSegments?: WordSegment[];
}

export interface DiffStats { added: number; removed: number; modified: number; unchanged: number; }

export interface UnifiedRow {
  type: 'context' | 'added' | 'removed';
  content: string;
  oldLine?: number;
  newLine?: number;
  segments?: WordSegment[];
}

export interface DiffResult {
  leftLines: DiffLine[];
  rightLines: DiffLine[];
  unifiedRows: UnifiedRow[];
  stats: DiffStats;
}

export function compareText(original: string, modified: string, ignoreCase = false): DiffResult {
  let a = original;
  let b = modified;
  if (ignoreCase) { a = a.toLowerCase(); b = b.toLowerCase(); }
  return buildDiffResult(a, b);
}

function buildDiffResult(original: string, modified: string): DiffResult {
  const changes = diffLines(original, modified);
  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];
  const unifiedRows: UnifiedRow[] = [];
  const stats: DiffStats = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  let oldLineNum = 1;
  let newLineNum = 1;
  let i = 0;

  while (i < changes.length) {
    const change = changes[i];

    if (!change.added && !change.removed) {
      // Context
      for (const line of splitLines(change.value)) {
        leftLines.push({ lineNumber: oldLineNum, content: line, type: 'equal', newLineNumber: newLineNum });
        rightLines.push({ lineNumber: newLineNum, content: line, type: 'equal', oldLineNumber: oldLineNum });
        unifiedRows.push({ type: 'context', content: line, oldLine: oldLineNum, newLine: newLineNum });
        oldLineNum++; newLineNum++; stats.unchanged++;
      }
      i++;
    } else {
      let removedText = '';
      let addedText = '';
      while (i < changes.length && (changes[i].added || changes[i].removed)) {
        if (changes[i].removed) removedText += changes[i].value;
        if (changes[i].added)   addedText   += changes[i].value;
        i++;
      }
      const removedLines = splitLines(removedText);
      const addedLines   = splitLines(addedText);
      const pairedCount  = Math.min(removedLines.length, addedLines.length);

      for (let j = 0; j < pairedCount; j++) {
        const oldContent = removedLines[j];
        const newContent = addedLines[j];
        const wordChanges = diffWords(oldContent, newContent);
        const oldSeg: WordSegment[] = [];
        const newSeg: WordSegment[] = [];
        for (const wc of wordChanges) {
          if (!wc.added && !wc.removed) { oldSeg.push({ value: wc.value, type: 'equal' }); newSeg.push({ value: wc.value, type: 'equal' }); }
          else if (wc.removed) oldSeg.push({ value: wc.value, type: 'removed' });
          else if (wc.added)   newSeg.push({ value: wc.value, type: 'added' });
        }
        leftLines.push({ lineNumber: oldLineNum, content: oldContent, type: 'removed', wordSegments: oldSeg });
        rightLines.push({ lineNumber: newLineNum, content: newContent, type: 'added', wordSegments: newSeg });
        unifiedRows.push({ type: 'removed', content: oldContent, oldLine: oldLineNum, segments: oldSeg });
        unifiedRows.push({ type: 'added',   content: newContent, newLine: newLineNum, segments: newSeg });
        oldLineNum++; newLineNum++; stats.modified++;
      }
      for (let j = pairedCount; j < removedLines.length; j++) {
        leftLines.push({ lineNumber: oldLineNum, content: removedLines[j], type: 'removed' });
        unifiedRows.push({ type: 'removed', content: removedLines[j], oldLine: oldLineNum });
        oldLineNum++; stats.removed++;
      }
      for (let j = pairedCount; j < addedLines.length; j++) {
        rightLines.push({ lineNumber: newLineNum, content: addedLines[j], type: 'added' });
        unifiedRows.push({ type: 'added', content: addedLines[j], newLine: newLineNum });
        newLineNum++; stats.added++;
      }
    }
  }
  return { leftLines, rightLines, unifiedRows, stats };
}

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function generateUnifiedDiffText(leftLines: DiffLine[], rightLines: DiffLine[]): string {
  const lines: string[] = [];
  const maxLen = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxLen; i++) {
    const left  = leftLines[i];
    const right = rightLines[i];
    if (left?.type  === 'removed') lines.push(`- ${left.content}`);
    if (right?.type === 'added')   lines.push(`+ ${right.content}`);
    if (left?.type  === 'equal')   lines.push(`  ${left.content}`);
  }
  return lines.join('\n');
}
