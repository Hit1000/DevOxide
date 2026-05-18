import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
  const isTauri = '__TAURI_INTERNALS__' in window;

  const minimize = () => { if (isTauri) getCurrentWindow().minimize(); };
  const maximize = () => { if (isTauri) getCurrentWindow().toggleMaximize(); };
  const close = () => { if (isTauri) getCurrentWindow().close(); };

  if (!isTauri) return null; // Hide custom titlebar in browser

  return (
    <div className="titlebar">
      <div data-tauri-drag-region style={{ flex: 1, height: '100%' }} />
      <div className="titlebar-button" onClick={minimize}>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
          <rect x="1" y="4" width="8" height="1" fill="currentColor" />
        </svg>
      </div>
      <div className="titlebar-button" onClick={maximize}>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
          <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <div className="titlebar-button close" onClick={close}>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
