import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("packed html binds Open before vendor pdf.js", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const app = html.indexOf("function createNovaCall");
  const vendor = html.indexOf("webpackUniversalModuleDefinition");
  expect(app).toBeGreaterThan(-1);
  expect(vendor).toBeGreaterThan(-1);
  expect(app).toBeLessThan(vendor);
});
