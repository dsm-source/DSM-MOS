import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// In this jsdom test environment, `window` is `globalThis`, so jsdom skips installing
// its own localStorage (Node's experimental global already occupies the slot). Reading
// that slot at all — even to copy it — trips Node's ExperimentalWarning. Replace it with
// a plain in-memory stub before anything touches it.
if (typeof globalThis !== "undefined") {
  const store = new Map<string, string>();
  const localStorageStub: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageStub,
  });
}

// jsdom lacks these – add minimal shims used by Radix / shadcn components.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}
