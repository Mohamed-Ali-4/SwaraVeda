// Browser storage can be missing or locked (private windows, embedded
// previews), so every read and write is allowed to fail quietly.
function wrap(get: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return get().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        get().setItem(key, value);
      } catch {
        /* not available */
      }
    },
    remove(key: string) {
      try {
        get().removeItem(key);
      } catch {
        /* not available */
      }
    },
  };
}

export const safeLocal = wrap(() => window.localStorage);
export const safeSession = wrap(() => window.sessionStorage);
