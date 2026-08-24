import { expect, test } from "bun:test";
import { buildCompletePrompt, parseModelText } from "./ai.js";
import { emptyDocument } from "./model.js";

test("buildCompletePrompt stays under 32000 and includes instruction", () => {
  const objects = Array.from({ length: 200 }, (_, i) => ({
    id: `o${i}`,
    page: i % 3,
    kind: "text",
    bbox: { x: 0, y: 0, w: 10, h: 10 },
    z: 0,
    payload: { text: "word ".repeat(40) },
  }));
  const doc = { ...emptyDocument(), pages: [{}, {}, {}], objects };
  const prompt = buildCompletePrompt({
    instruction: "Tighten page 0",
    scope: "document",
    doc,
    page: 0,
    selectedIds: [],
  });
  expect(prompt.length).toBeLessThanOrEqual(32000);
  expect(prompt).toContain("Tighten page 0");
  expect(prompt).toContain("o0");
});

test("parseModelText reads a json fence and rejects prose", () => {
  expect(parseModelText('```json\n{"version":1,"ops":[]}\n```').ok).toBe(true);
  expect(parseModelText("sure, I will edit it").ok).toBe(false);
});
