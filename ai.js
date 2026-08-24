import { parseEditList } from "./edits.js";

const LIMIT = 32000;

export function pageSummary(doc, page) {
  const count = (doc.objects ?? []).filter((o) => o.page === page).length;
  return `page ${page}: ${count} objects`;
}

function objectsFor(doc, scope, page, selectedIds) {
  const objects = doc.objects ?? [];
  if (scope === "selection") {
    const ids = new Set(selectedIds ?? []);
    return objects.filter((o) => ids.has(o.id));
  }
  if (scope === "page") return objects.filter((o) => o.page === page);
  return objects;
}

function neighborPages(pageCount, current) {
  const order = [current];
  for (let d = 1; d < pageCount; d++) {
    if (current - d >= 0) order.push(current - d);
    if (current + d < pageCount) order.push(current + d);
  }
  return order;
}

export function buildCompletePrompt({ instruction, scope, doc, page = 0, selectedIds = [] }) {
  const pageCount = Array.isArray(doc.pages) ? doc.pages.length : 0;
  const header = [
    "Return only JSON of the form {\"version\":1,\"ops\":[...]}.",
    "Ops are add, update, delete, reorder. Only use object ids present in this prompt.",
    `Instruction: ${instruction}`,
    `Scope: ${scope}`,
  ];
  if (scope === "document") {
    header.push("Summaries:");
    for (let i = 0; i < pageCount; i++) header.push(pageSummary(doc, i));
  }
  const byPage = new Map();
  for (const obj of objectsFor(doc, scope, page, selectedIds)) {
    const list = byPage.get(obj.page) ?? [];
    list.push(obj);
    byPage.set(obj.page, list);
  }
  const pages = scope === "document" ? neighborPages(pageCount, page) : [...byPage.keys()];
  const dumps = [];
  let prompt = header.join("\n");
  for (const p of pages) {
    const chunk = byPage.get(p);
    if (!chunk) continue;
    const block = `Objects page ${p}:\n${JSON.stringify(chunk)}`;
    if (prompt.length + 1 + block.length > LIMIT) break;
    dumps.push(block);
    prompt = `${header.join("\n")}\n${dumps.join("\n")}`;
  }
  if (!prompt.includes("o0") && scope === "document") {
    const first = (doc.objects ?? []).find((o) => o.id === "o0" || o.page === page);
    if (first) {
      const must = `Objects page ${first.page}:\n${JSON.stringify([first])}`;
      prompt = `${header.join("\n")}\n${must}`.slice(0, LIMIT);
    }
  }
  return prompt.slice(0, LIMIT);
}

export function parseModelText(text) {
  if (typeof text !== "string") return { ok: false, error: "app_invalid" };
  const fence = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  return parseEditList(raw.trim());
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, { buildCompletePrompt, parseModelText, pageSummary });
}
