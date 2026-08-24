import { expect, test } from "bun:test";
import { applyEditList, parseEditList } from "./edits.js";
import { emptyDocument } from "./model.js";

const box = { x: 1, y: 2, w: 3, h: 4 };
const obj = { id: "t1", page: 0, kind: "text", bbox: box, z: 0, payload: { text: "A" } };

test("parseEditList accepts version 1 and rejects junk", () => {
  expect(parseEditList({ version: 1, ops: [] }).ok).toBe(true);
  expect(parseEditList("{").ok).toBe(false);
  expect(parseEditList({ version: 2, ops: [] }).ok).toBe(false);
  expect(parseEditList({ version: 1, ops: [{ op: "explode" }] }).ok).toBe(false);
});

test("applyEditList is all-or-nothing", () => {
  const doc = { ...emptyDocument(), pages: [{}], objects: [obj] };
  const bad = applyEditList(doc, { version: 1, ops: [{ op: "delete", id: "nope" }] });
  expect(bad.ok).toBe(false);
  expect(doc.objects).toHaveLength(1);
  const good = applyEditList(doc, {
    version: 1,
    ops: [
      { op: "update", id: "t1", patch: { payload: { text: "B" } } },
      { op: "add", object: { ...obj, id: "t2", payload: { text: "C" } } },
    ],
  });
  expect(good.ok).toBe(true);
  expect(good.doc.objects.map((o) => o.id).sort()).toEqual(["t1", "t2"]);
  expect(good.doc.objects.find((o) => o.id === "t1").payload.text).toBe("B");
  expect(good.doc.dirty).toBe(true);
});
