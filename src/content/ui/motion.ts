/**
 * Motion helpers. Everything degrades to the final state when the user prefers
 * reduced motion, and observers/listeners are always returned with a teardown so
 * the renderer can clean up on unmount.
 */

export function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface RevealObserver {
  observe(element: Element): void;
  disconnect(): void;
}

/** One-shot reveal: each element animates in once, then is unobserved. */
export function createRevealObserver(): RevealObserver {
  if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
    return {
      observe: (element) => element.classList.add('is-in'),
      disconnect: () => undefined,
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );

  return {
    observe: (element) => observer.observe(element),
    disconnect: () => observer.disconnect(),
  };
}

/**
 * rAF is not guaranteed in every environment the renderer is unit-tested in
 * (jsdom), so fall back to a timer rather than throwing.
 */
function requestFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(0), 16) as unknown as number;
}

function cancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  globalThis.clearTimeout(handle as unknown as ReturnType<typeof globalThis.setTimeout>);
}

/**
 * Reports how far the feed has been read, as 0..1. rAF-throttled and passive so
 * it never blocks scrolling.
 */
export function trackScrollProgress(
  root: HTMLElement,
  onChange: (progress: number) => void,
): () => void {
  let frame = 0;

  const compute = (): void => {
    frame = 0;
    const rect = root.getBoundingClientRect();
    const span = Math.max(1, rect.height - globalThis.innerHeight);
    onChange(Math.min(1, Math.max(0, -rect.top / span)));
  };

  const schedule = (): void => {
    if (frame) return;
    frame = requestFrame(compute);
  };

  globalThis.addEventListener('scroll', schedule, { passive: true });
  globalThis.addEventListener('resize', schedule, { passive: true });
  schedule();

  return () => {
    globalThis.removeEventListener('scroll', schedule);
    globalThis.removeEventListener('resize', schedule);
    if (frame) cancelFrame(frame);
  };
}

/** Re-runs a one-shot CSS animation by toggling a class. */
export function pulseClass(element: HTMLElement, className: string, durationMs: number): void {
  element.classList.remove(className);
  // Force a reflow so the animation restarts even if the class was just removed.
  void element.offsetWidth;
  element.classList.add(className);
  globalThis.setTimeout(() => element.classList.remove(className), durationMs);
}
