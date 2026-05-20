import { useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

export function useScrollSync(views: Array<EditorView | null>) {
  const syncing = useRef(false);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    views.forEach((view, index) => {
      if (!view) return;

      const handler = (event: Event) => {
        if (syncing.current) return;
        syncing.current = true;
        const scrollTop = (event.target as HTMLElement).scrollTop;

        views.forEach((other, otherIndex) => {
          if (otherIndex !== index && other) {
            other.scrollDOM.scrollTop = scrollTop;
          }
        });

        requestAnimationFrame(() => {
          syncing.current = false;
        });
      };

      view.scrollDOM.addEventListener('scroll', handler);
      cleanups.push(() => view.scrollDOM.removeEventListener('scroll', handler));
    });

    return () => cleanups.forEach(fn => fn());
  }, [views]);
}
