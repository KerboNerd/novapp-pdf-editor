import { expect, test } from "bun:test";
import { createHistory, emptyDocument, pushHistory, redo, rememberRecent, undo } from "./model.js";

test("undo reapplies the previous object list as one step", () => {
  let doc = emptyDocument();
  let hist = createHistory();
  hist = pushHistory(hist, doc);
  doc = {
    ...doc,
    objects: [
      { id: "a", page: 0, kind: "text", bbox: { x: 0, y: 0, w: 10, h: 10 }, z: 0, payload: { text: "x" } },
    ],
    dirty: true,
  };
  const undone = undo(hist, doc);
  expect(undone.doc.objects).toEqual([]);
  expect(undone.doc.dirty).toBe(false);
  const redone = redo(undone.history, undone.doc);
  expect(redone.doc.objects).toHaveLength(1);
});

test("recents keep last 8 unique paths newest first", () => {
  let list = [];
  for (let i = 0; i < 9; i++) list = rememberRecent(list, { path: `C:/${i}.pdf`, name: `${i}.pdf`, at: String(i) });
  expect(list).toHaveLength(8);
  expect(list[0].path).toBe("C:/8.pdf");
  list = rememberRecent(list, { path: "C:/8.pdf", name: "8.pdf", at: "later" });
  expect(list[0].at).toBe("later");
  expect(list.filter((r) => r.path === "C:/8.pdf")).toHaveLength(1);
});
