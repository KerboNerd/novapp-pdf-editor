const KINDS = new Set(["text", "image", "shape", "annotation", "field"]);
const OPS = new Set(["add", "update", "delete", "reorder"]);

function fail(error) {
  return { ok: false, error };
}

function asObject(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw;
}

function validBbox(bbox) {
  if (!bbox || typeof bbox !== "object") return false;
  const { x, y, w, h } = bbox;
  return [x, y, w, h].every((n) => typeof n === "number" && Number.isFinite(n)) && w > 0 && h > 0;
}

function validObject(object, pageCount) {
  if (!object || typeof object.id !== "string" || !object.id) return false;
  if (!KINDS.has(object.kind)) return false;
  if (typeof object.page !== "number" || object.page < 0) return false;
  if (pageCount > 0 && object.page >= pageCount) return false;
  if (typeof object.z !== "number" || !Number.isFinite(object.z)) return false;
  if (!validBbox(object.bbox)) return false;
  return true;
}

export function parseEditList(raw) {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return fail("app_invalid");
    }
  }
  const list = asObject(value);
  if (!list || list.version !== 1 || !Array.isArray(list.ops)) return fail("app_invalid");
  for (const op of list.ops) {
    const item = asObject(op);
    if (!item || !OPS.has(item.op)) return fail("app_invalid");
    if (item.op === "add") {
      if (!asObject(item.object)) return fail("app_invalid");
    } else if (item.op === "update") {
      if (typeof item.id !== "string" || !asObject(item.patch)) return fail("app_invalid");
    } else if (item.op === "delete") {
      if (typeof item.id !== "string") return fail("app_invalid");
    } else if (item.op === "reorder") {
      if (typeof item.id !== "string" || typeof item.z !== "number") return fail("app_invalid");
    }
  }
  return { ok: true, list: { version: 1, ops: list.ops } };
}

export function applyEditList(doc, list) {
  const parsed = list && list.version === 1 && Array.isArray(list.ops) ? { ok: true, list } : parseEditList(list);
  if (!parsed.ok) return parsed;
  const pageCount = Array.isArray(doc.pages) ? doc.pages.length : 0;
  const objects = structuredClone(doc.objects ?? []);
  const byId = new Map(objects.map((o) => [o.id, o]));

  for (const op of parsed.list.ops) {
    if (op.op === "add") {
      if (!validObject(op.object, pageCount)) return fail("app_invalid");
      if (byId.has(op.object.id)) return fail("app_invalid");
      continue;
    }
    if (!byId.has(op.id)) return fail("unknown_id");
    if (op.op === "update") {
      const next = { ...byId.get(op.id), ...op.patch };
      if (op.patch.bbox) next.bbox = op.patch.bbox;
      if (op.patch.payload) next.payload = op.patch.payload;
      if (!validObject(next, pageCount)) return fail("app_invalid");
    }
    if (op.op === "reorder" && !Number.isFinite(op.z)) return fail("app_invalid");
  }

  const next = objects.slice();
  const index = new Map(next.map((o, i) => [o.id, i]));
  for (const op of parsed.list.ops) {
    if (op.op === "add") {
      next.push(structuredClone(op.object));
      index.set(op.object.id, next.length - 1);
    } else if (op.op === "delete") {
      const i = index.get(op.id);
      next.splice(i, 1);
      index.clear();
      next.forEach((o, i2) => index.set(o.id, i2));
    } else if (op.op === "update") {
      const i = index.get(op.id);
      const merged = { ...next[i], ...op.patch };
      if (op.patch.bbox) merged.bbox = op.patch.bbox;
      if (op.patch.payload) merged.payload = op.patch.payload;
      next[i] = merged;
    } else if (op.op === "reorder") {
      const i = index.get(op.id);
      next[i] = { ...next[i], z: op.z };
    }
  }
  return { ok: true, doc: { ...doc, objects: next, dirty: true } };
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, { parseEditList, applyEditList });
}
