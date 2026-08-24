function snap(doc) {
  return {
    objects: structuredClone(doc.objects ?? []),
    unlifted: structuredClone(doc.unlifted ?? []),
    dirty: Boolean(doc.dirty),
  };
}

function applySnap(doc, s) {
  return { ...doc, objects: structuredClone(s.objects), unlifted: structuredClone(s.unlifted), dirty: s.dirty };
}

export function createObject({ id, page, kind, bbox, z, payload }) {
  return { id, page, kind, bbox, z, payload };
}

export function emptyDocument() {
  return { path: null, name: null, bytes: null, pages: [], objects: [], unlifted: [], dirty: false };
}

export function createHistory(max = 80) {
  return { past: [], future: [], max };
}

export function pushHistory(history, doc) {
  const past = [...history.past, snap(doc)];
  while (past.length > history.max) past.shift();
  return { ...history, past, future: [] };
}

export function undo(history, doc) {
  if (history.past.length === 0) return { doc, history };
  const past = history.past.slice();
  const prev = past.pop();
  return {
    doc: applySnap(doc, prev),
    history: { ...history, past, future: [snap(doc), ...history.future] },
  };
}

export function redo(history, doc) {
  if (history.future.length === 0) return { doc, history };
  const [next, ...future] = history.future;
  return {
    doc: applySnap(doc, next),
    history: { ...history, past: [...history.past, snap(doc)], future },
  };
}

export function rememberRecent(list, entry, max = 8) {
  return [entry, ...list.filter((item) => item.path !== entry.path)].slice(0, max);
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, {
    createObject,
    emptyDocument,
    createHistory,
    pushHistory,
    undo,
    redo,
    rememberRecent,
  });
}
