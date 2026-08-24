import { expect, test } from "bun:test";
import { liftTextContent, planDrawOps, sniffPdf, textItemToObject, topLeftToPdf, writePdf } from "./pdfio.js";

test("textItemToObject flips y to top-left", () => {
  const obj = textItemToObject(
    { str: "Hi", transform: [10, 0, 0, 10, 20, 100], width: 20, height: 10 },
    200,
    "t0",
  );
  expect(obj.kind).toBe("text");
  expect(obj.bbox.x).toBe(20);
  expect(obj.bbox.y).toBe(200 - 100 - 10);
  expect(obj.payload.text).toBe("Hi");
});

test("liftTextContent names items per page", () => {
  const objects = liftTextContent(
    { items: [{ str: "A", transform: [1, 0, 0, 1, 0, 10], width: 8, height: 8 }] },
    100,
    2,
  );
  expect(objects[0].id).toBe("p2-t0");
  expect(objects[0].page).toBe(2);
});

test("topLeftToPdf flips y using page height", () => {
  expect(topLeftToPdf({ x: 10, y: 20, w: 30, h: 40 }, 200)).toEqual({ x: 10, y: 140, w: 30, h: 40 });
});

test("sniffPdf rejects non-pdf and defaults letter page", () => {
  expect(() => sniffPdf(new Uint8Array([1, 2, 3]))).toThrow("not a PDF");
  const bytes = new TextEncoder().encode("%PDF-1.4\n");
  const info = sniffPdf(bytes);
  expect(info.pages).toEqual([{ w: 612, h: 792 }]);
  expect(info.unlifted[0].reason).toBe("page-render");
});

test("writePdf draws overlay text onto a copied page", async () => {
  const mod = await import("./vendor/pdf-lib.min.js");
  const lib = mod.PDFLib ?? mod.default ?? mod;
  const src = await lib.PDFDocument.create();
  src.addPage([200, 200]);
  const bytes = await src.save();
  const out = await writePdf(
    bytes,
    {
      pages: [{ w: 200, h: 200 }],
      objects: [
        { id: "t", page: 0, kind: "text", z: 1, bbox: { x: 10, y: 20, w: 30, h: 12 }, payload: { text: "Hi" } },
      ],
    },
    lib,
  );
  expect(out.byteLength).toBeGreaterThan(bytes.byteLength);
  expect((await lib.PDFDocument.load(out)).getPageCount()).toBe(1);
});

test("planDrawOps converts overlay objects into page draws", () => {
  const doc = {
    pages: [{ w: 200, h: 200 }],
    objects: [
      { id: "t", page: 0, kind: "text", z: 1, bbox: { x: 10, y: 20, w: 30, h: 40 }, payload: { text: "Hi", size: 14 } },
      { id: "r", page: 0, kind: "shape", z: 0, bbox: { x: 1, y: 2, w: 3, h: 4 }, payload: { shape: "rect" } },
    ],
  };
  expect(planDrawOps(doc)).toEqual([
    { type: "rect", page: 0, x: 1, y: 194, w: 3, h: 4 },
    { type: "text", page: 0, x: 10, y: 140, size: 14, text: "Hi" },
  ]);
});
