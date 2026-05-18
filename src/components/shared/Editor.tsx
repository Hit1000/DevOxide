import React, { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { markdown as mdLang } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';

interface EditorProps {
  value: string;
  onChange?: (v: string) => void;
  language?: 'json' | 'markdown' | 'text';
  readOnly?: boolean;
  placeholder?: string;
  height?: string;
}

const darkTheme = EditorView.theme({
  '&': { background: 'var(--bg)', color: 'var(--text)' },
  '.cm-content': { caretColor: 'var(--text)', padding: '6px 0' },
  '.cm-gutters': { background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', color: 'var(--text-dim)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px', minWidth: '36px' },
  '.cm-activeLine': { background: 'rgba(255,255,255,0.025)' },
  '.cm-activeLineGutter': { background: 'rgba(255,255,255,0.025)' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(124,58,237,0.25) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '.cm-placeholder': { color: 'var(--text-muted)' },
  '&.cm-focused': { outline: 'none' },
}, { dark: true });

export function Editor({ value, onChange, language = 'text', readOnly = false, placeholder, height = '100%' }: EditorProps) {
  const extensions: any[] = [darkTheme];
  if (language === 'json') extensions.push(json());
  if (language === 'markdown') extensions.push(mdLang());
  if (readOnly) extensions.push(EditorView.editable.of(false));
  if (placeholder) extensions.push(EditorView.contentAttributes.of({ 'data-placeholder': placeholder }));

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <CodeMirror
        value={value}
        height={height}
        style={{ height: '100%', flex: 1, overflow: 'hidden' }}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          autocompletion: false,
          searchKeymap: false,
          lintKeymap: false,
        }}
      />
    </div>
  );
}
