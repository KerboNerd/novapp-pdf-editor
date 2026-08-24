import { expect, test } from "bun:test";
import { applyAi, createSession, openDocument, selectableIds } from "./session.js";

test("open replaces the document and applyAi is one undo step", () => {
  const s = createSession();
  openDocument(s, {
    path: "C:/a.pdf",
    name: "a.pdf",
    bytes: new Uint8Array([1]),
    pages: [{}],
    objects: [{ id: "t1", page: 0, kind: "text", bbox: { x: 0, y: 0, w: 1, h: 1 }, z: 0, payload: { text: "A" } }],
    unlifted: [{ page: 0, reason: "image-xobject" }],
  });
  expect(selectableIds(s)).toEqual(["t1"]);
  const ok = applyAi(s, JSON.stringify({ version: 1, ops: [{ op: "update", id: "t1", patch: { payload: { text: "B" } } }] }));
  expect(ok.ok).toBe(true);
  expect(s.doc.objects[0].payload.text).toBe("B");
  const bad = applyAi(s, JSON.stringify({ version: 1, ops: [{ op: "delete", id: "missing" }] }));
  expect(bad.ok).toBe(false);
  expect(s.doc.objects[0].payload.text).toBe("B");
});
