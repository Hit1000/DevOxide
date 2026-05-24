import { useEffect, useState, useRef, useCallback } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';

// ── Singleton store instance ──────────────────────────────────────────────────
let storeInstance: Store | null = null;
let storePromise: Promise<Store> | null = null;

export async function getStore(): Promise<Store> {
  if (storeInstance) return storeInstance;
  if (storePromise) return storePromise;

  storePromise = load('devkit.json', { autoSave: 100, defaults: {} })
    .then(async s => {
      console.log('Store loaded successfully:', s);
      storeInstance = s;
      // Make sure a missing store file gets recreated on first launch.
      try {
        await s.save();
      } catch (saveErr) {
        console.error('Failed to seed store file:', saveErr);
      }
      return s;
    })
    .catch(err => {
      console.error('Failed to load store:', err);
      storePromise = null; // reset so caller can retry
      throw err;
    });
  return storePromise;
}

// ── Generic persisted state hook ──────────────────────────────────────────────
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  debounceMs = 0
): [T, (val: T) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load from store on mount
  useEffect(() => {
    getStore()
      .then(s => {
        s.get<T>(key)
          .then(stored => {
            if (stored !== null && stored !== undefined) {
              setValue(stored);
            }
            setLoaded(true);
          })
          .catch(err => {
            console.error(`Failed to read key ${key} from store:`, err);
            setLoaded(true);
          });
      })
      .catch(err => {
        // Fallback if store completely fails to load
        setLoaded(true);
      });
  }, [key]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Persist on change
  const set = useCallback((val: T) => {
    setValue(val);
    clearTimeout(debounceRef.current);
    if (debounceMs > 0) {
      debounceRef.current = setTimeout(() => {
        getStore().then(s => s.set(key, val).then(() => s.save()));
      }, debounceMs);
    } else {
      getStore().then(s => s.set(key, val).then(() => s.save()));
    }
  }, [key, debounceMs]);

  return [value, set, loaded];
}
