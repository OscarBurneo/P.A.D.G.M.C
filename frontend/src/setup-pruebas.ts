import "@testing-library/jest-dom/vitest";

class ObservadorRedimension {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ObservadorRedimension as typeof ResizeObserver;
}
