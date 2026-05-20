import { useState, useCallback, RefObject } from 'react';
import type { MouseEvent } from 'react';

export function useResizable(
  containerRef: RefObject<HTMLDivElement>,
  initialPercents: [number, number, number] = [33, 33, 34],
  minPercent = 15,
  maxPercent = 60,
  onCommit?: (percents: [number, number, number]) => void
) {
  const [percents, setPercents] = useState<[number, number, number]>(initialPercents);

  const startDrag = useCallback((dividerIndex: 0 | 1) => (event: MouseEvent) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startX = event.clientX;
    const startPercents = [...percents] as [number, number, number];
    let latestPercents = startPercents;
    const containerW = container.offsetWidth || 1;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = ((moveEvent.clientX - startX) / containerW) * 100;
      const next = [...startPercents] as [number, number, number];

      if (dividerIndex === 0) {
        next[0] = Math.max(minPercent, Math.min(maxPercent, startPercents[0] + delta));
        next[1] = startPercents[1] + (startPercents[0] - next[0]);
        next[2] = 100 - next[0] - next[1];
      } else {
        next[1] = Math.max(minPercent, Math.min(maxPercent, startPercents[1] + delta));
        next[2] = 100 - next[0] - next[1];
      }

      if (next[2] >= minPercent) {
        latestPercents = next;
        setPercents(next);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      onCommit?.(latestPercents);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [containerRef, percents, minPercent, maxPercent, onCommit]);

  return { percents, setPercents, startDrag };
}
