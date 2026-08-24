import { applyEditList } from "./edits.js";
import { parseModelText } from "./ai.js";
import { createHistory, emptyDocument, pushHistory } from "./model.js";

export function createSession() {
  return { doc: emptyDocument(), history: createHistory(), page: 0 };
}

export function openDocument(session, input) {
  session.doc = {
    path: input.path,
    name: input.name,
    bytes: input.bytes,
    pages: input.pages ?? [],
    objects: structuredClone(input.objects ?? []),
    unlifted: structuredClone(input.unlifted ?? []),
    dirty: false,
  };
  session.history = createHistory();
  session.page = 0;
  return session;
}

export function markUnlifted(session, items) {
  session.doc = { ...session.doc, unlifted: structuredClone(items ?? []) };
  return session;
}

export function selectableIds(session) {
  return (session.doc.objects ?? []).map((o) => o.id);
}

export function applyAi(session, rawText) {
  const parsed = parseModelText(rawText);
  if (!parsed.ok) return parsed;
  const applied = applyEditList(session.doc, parsed.list);
  if (!applied.ok) return applied;
  session.history = pushHistory(session.history, session.doc);
  session.doc = applied.doc;
  return applied;
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, {
    createSession,
    openDocument,
    applyAi,
    markUnlifted,
    selectableIds,
  });
}
