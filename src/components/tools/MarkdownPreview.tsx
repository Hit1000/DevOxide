import React, { useState, useEffect } from 'react';
import { Editor } from '../shared/Editor';
import { Icons } from '../Icons';
import { CopyBtn } from '../TopBar';
import { useTauri } from '../../hooks/useTauri';

const MD_BUTTONS = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'] },
  { label: 'I', title: 'Italic', wrap: ['_', '_'] },
  { label: '<>', title: 'Inline Code', wrap: ['`', '`'] },
  { label: 'H1', title: 'Heading 1', prefix: '# ' },
  { label: 'H2', title: 'Heading 2', prefix: '## ' },
  { label: 'H3', title: 'Heading 3', prefix: '### ' },
];

export function MarkdownPreview() {
  const [input, setInput] = useState('');
  const [html, setHtml] = useState('');
  const [chars, setChars] = useState(0);
  const tauri = useTauri();

  useEffect(() => {
    setChars(input.length);
    const render = async () => {
      try {
        const res = await tauri.renderMarkdown(input);
        setHtml(res);
      } catch { setHtml(''); }
    };
    render();
  }, [input]);

  const copyHtml = () => navigator.clipboard.writeText(html);
  const clearAll = () => setInput('');

  const insertText = (btn: typeof MD_BUTTONS[0]) => {
    if (btn.wrap) {
      setInput(prev => prev + (prev ? ' ' : '') + btn.wrap![0] + 'text' + btn.wrap![1]);
    } else if (btn.prefix) {
      setInput(prev => prev + (prev ? '\n' : '') + btn.prefix + 'text');
    }
  };

  const insertExtra = (type: string) => {
    if (type === 'link') setInput(prev => prev + (prev ? ' ' : '') + '[link text](https://url.com)');
    if (type === 'image') setInput(prev => prev + (prev ? ' ' : '') + '![alt text](https://url.com/image.jpg)');
    if (type === 'table') setInput(prev => prev + (prev ? '\n' : '') + '\n| Header |\n| ------ |\n| Cell   |');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="toolbar">
        {MD_BUTTONS.map(btn => (
          <button key={btn.label} className="md-toolbar-btn" title={btn.title} onClick={() => insertText(btn)}>
            {btn.label}
          </button>
        ))}
        <span className="md-sep" />
        <button className="md-toolbar-btn" onClick={() => insertExtra('link')}><Icons.link /></button>
        <button className="md-toolbar-btn" onClick={() => insertExtra('image')}><Icons.image /></button>
        <button className="md-toolbar-btn" onClick={() => insertExtra('table')}><Icons.table /></button>

        <div className="toolbar-right">
          <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 99, padding: '2px 10px' }}>Saved</span>
          <button className="btn btn-secondary" onClick={copyHtml}><Icons.copy /> Copy HTML</button>
          <button className="btn btn-secondary"><Icons.download /> Export HTML</button>
          <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
        </div>
      </div>

      {/* Split */}
      <div className="split-pane">
        <div className="split-panel">
          <div className="panel-header">
            <span className="panel-label">Markdown <span className="badge">{chars} chars</span></span>
          </div>
          <Editor value={input} onChange={setInput} language="markdown" placeholder="Write your markdown here..." height="100%" />
        </div>
        <div className="split-panel">
          <div className="panel-header">
            <span className="panel-label">Preview</span>
          </div>
          <div
            className="prose-preview"
            dangerouslySetInnerHTML={{ __html: html || '<p style="color:var(--text-muted)">Preview will appear here...</p>' }}
          />
        </div>
      </div>
    </div>
  );
}
