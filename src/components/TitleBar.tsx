import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
  const isTauri = '__TAURI_INTERNALS__' in window;

  const minimize = () => { if (isTauri) getCurrentWindow().minimize(); };
  const maximize = () => { if (isTauri) getCurrentWindow().toggleMaximize(); };
  const close = () => { if (isTauri) getCurrentWindow().close(); };
  const startDrag = (event: React.MouseEvent) => {
    if (!isTauri) return;
    if (event.button !== 0) return;
    event.preventDefault();
    getCurrentWindow().startDragging();
  };
  const stopDrag = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  if (!isTauri) return null; // Hide custom titlebar in browser

  return (
    <div className="titlebar" data-tauri-drag-region onMouseDown={startDrag}>
      <div className="titlebar-brand" data-tauri-drag-region>
        <span className="titlebar-brand-logo" aria-hidden="true" />
        <span className="titlebar-brand-text">DevOxide</span>
      </div>
      <div className="titlebar-button" onMouseDown={stopDrag} onClick={minimize} data-tauri-drag-region="false">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
          <rect x="1" y="4" width="8" height="1" fill="currentColor" />
        </svg>
      </div>
      <div className="titlebar-button" onMouseDown={stopDrag} onClick={maximize} data-tauri-drag-region="false">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
          <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <div className="titlebar-button close" onMouseDown={stopDrag} onClick={close} data-tauri-drag-region="false">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
