import { expect, test } from "bun:test";
import { asPickedFile, bytesFromRead } from "./open.js";
import { bytesToBase64 } from "./host.js";

test("asPickedFile needs a path", () => {
  expect(asPickedFile(null)).toBe(null);
  expect(asPickedFile({})).toBe(null);
  expect(asPickedFile({ path: "C:/a.pdf", name: "a.pdf" })).toEqual({ path: "C:/a.pdf", name: "a.pdf" });
});

test("bytesFromRead requires base64", () => {
  expect(() => bytesFromRead({ content: "not-bytes" })).toThrow("Restart NOVA");
  const bytes = new Uint8Array([1, 2, 3]);
  expect([...bytesFromRead({ bytesBase64: bytesToBase64(bytes) })]).toEqual([1, 2, 3]);
});
