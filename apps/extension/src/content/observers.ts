const MUTATION_DEBOUNCE_MS = 250;
const VISIBILITY_THRESHOLD = 0.5;

function findVideos(node: Node): HTMLVideoElement[] {
  if (node instanceof HTMLVideoElement) return [node];
  if (node instanceof Element) return Array.from(node.querySelectorAll("video"));
  return [];
}

/**
 * Observa o documento em busca de elementos <video>, incluindo os inseridos
 * dinamicamente. Chama onAdded uma vez por vídeo descoberto (dedupe via
 * WeakSet) e novamente sempre que o `src` do vídeo trocar (evento
 * `loadstart`), para que o chamador possa invalidar o cache.
 */
export function watchVideos(
  root: Document,
  onAdded: (video: HTMLVideoElement) => void,
  onRemoved?: (video: HTMLVideoElement) => void,
): () => void {
  const seen = new WeakSet<HTMLVideoElement>();
  const loadstartHandlers = new Map<HTMLVideoElement, EventListener>();
  let pending = new Set<HTMLVideoElement>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function emit(video: HTMLVideoElement): void {
    if (seen.has(video)) return;
    seen.add(video);

    const onLoadstart = () => onAdded(video);
    video.addEventListener("loadstart", onLoadstart);
    loadstartHandlers.set(video, onLoadstart);

    onAdded(video);
  }

  for (const video of Array.from(root.querySelectorAll("video"))) {
    emit(video);
  }

  const observer = new MutationObserver((mutations) => {
    const removed = new Set<HTMLVideoElement>();
    const added = new Set<HTMLVideoElement>();
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.removedNodes)) {
        for (const video of findVideos(node)) removed.add(video);
      }
      for (const node of Array.from(mutation.addedNodes)) {
        for (const video of findVideos(node)) added.add(video);
      }
    }

    for (const video of removed) {
      if (video.isConnected) continue;
      pending.delete(video);
      const handler = loadstartHandlers.get(video);
      if (handler) video.removeEventListener("loadstart", handler);
      loadstartHandlers.delete(video);
      seen.delete(video);
      onRemoved?.(video);
    }

    for (const video of added) {
      if (video.isConnected && !seen.has(video)) {
        pending.add(video);
      }
    }

    if (pending.size === 0) return;

    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const batch = pending;
      pending = new Set();
      debounceTimer = undefined;
      for (const video of batch) emit(video);
    }, MUTATION_DEBOUNCE_MS);
  });

  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    pending.clear();
    for (const [video, handler] of loadstartHandlers) {
      video.removeEventListener("loadstart", handler);
    }
    loadstartHandlers.clear();
  };
}

/**
 * Chama onDwell uma única vez, quando o vídeo permanece visível
 * (intersectionRatio >= 0.5) por pelo menos minVisibleMs contínuos.
 */
export function watchVisibility(video: HTMLVideoElement, minVisibleMs: number, onDwell: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (fired) return;
      const entry = entries[entries.length - 1];
      if (!entry) return;

      const visible = entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD;
      if (visible) {
        if (timer === undefined) {
          timer = setTimeout(() => {
            fired = true;
            timer = undefined;
            observer.disconnect();
            onDwell();
          }, minVisibleMs);
        }
      } else if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    { threshold: [VISIBILITY_THRESHOLD] },
  );

  observer.observe(video);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    observer.disconnect();
  };
}
