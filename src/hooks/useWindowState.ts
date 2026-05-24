import { useEffect, useRef } from 'react';
import {
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from '@tauri-apps/api/window';
import { getStore } from './useStore';

type WindowState = {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
  fullscreen: boolean;
};

const STATE_KEY = 'window_state';

const isValidNumber = (value: unknown): value is number => Number.isFinite(value);

const isValidState = (state: WindowState) => {
  return (
    isValidNumber(state.width) &&
    isValidNumber(state.height) &&
    isValidNumber(state.x) &&
    isValidNumber(state.y)
  );
};

export function useWindowState() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringRef = useRef(true);

  useEffect(() => {
    const isTauri = '__TAURI_INTERNALS__' in window;
    if (!isTauri) return;

    const appWindow = getCurrentWindow();
    let didShow = false;
    let unlistenResize: (() => void) | null = null;
    let unlistenMove: (() => void) | null = null;

    const showWindow = async () => {
      if (didShow) return;
      didShow = true;
      await appWindow.show();
      await appWindow.setFocus();
    };

    const saveState = async () => {
      const [size, position, maximized, fullscreen] = await Promise.all([
        appWindow.outerSize(),
        appWindow.outerPosition(),
        appWindow.isMaximized(),
        appWindow.isFullscreen(),
      ]);

      const minimized = await appWindow.isMinimized();
      if (minimized) return;

      if (!isValidNumber(size.width) || !isValidNumber(size.height)) return;
      if (!isValidNumber(position.x) || !isValidNumber(position.y)) return;

      const state: WindowState = {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
        maximized,
        fullscreen,
      };

      const store = await getStore();
      await store.set(STATE_KEY, state);
      await store.save();
    };

    const debouncedSave = () => {
      if (restoringRef.current) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => {
        saveState().catch(err => console.error('Failed to save window state:', err));
      }, 250);
    };

    const restoreState = async () => {
      try {
        const store = await getStore();
        const stored = await store.get<WindowState>(STATE_KEY);
        if (!stored) {
          await showWindow();
          return;
        }

        if (!isValidState(stored)) {
          await store.delete(STATE_KEY);
          await store.save();
          await showWindow();
          return;
        }

        if (stored.width < 200 || stored.height < 150) {
          await showWindow();
          return;
        }

        if (stored.fullscreen) {
          await appWindow.setFullscreen(true);
        } else if (stored.maximized) {
          await appWindow.maximize();
        } else {
          if (stored.x < -10000 || stored.y < -10000) {
            await appWindow.setSize(new PhysicalSize(stored.width, stored.height));
            await showWindow();
            return;
          }
          await appWindow.setSize(new PhysicalSize(stored.width, stored.height));
          await appWindow.setPosition(new PhysicalPosition(stored.x, stored.y));
        }
        await showWindow();
      } catch (err) {
        console.error('Failed to restore window state:', err);
        await showWindow();
      }
    };

    restoreState().finally(() => {
      setTimeout(() => {
        restoringRef.current = false;
      }, 250);
    });

    appWindow.onResized(() => {
      debouncedSave();
    }).then(unlisten => {
      unlistenResize = unlisten;
    });

    appWindow.onMoved(() => {
      debouncedSave();
    }).then(unlisten => {
      unlistenMove = unlisten;
    });

    const unlistenClosePromise = appWindow.onCloseRequested(() => {
      saveState().catch(err => {
        console.error('Failed to save window state on close:', err);
      });
    });

    return () => {
      if (unlistenResize) unlistenResize();
      if (unlistenMove) unlistenMove();
      unlistenClosePromise.then(unlisten => unlisten()).catch(() => undefined);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);
}
