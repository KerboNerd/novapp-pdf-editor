import { expect, test } from "bun:test";
import { hitTest, moveObject } from "./tools.js";

test("hitTest returns the topmost object on that page", () => {
  const objects = [
    { id: "a", page: 0, z: 0, bbox: { x: 0, y: 0, w: 50, h: 50 }, kind: "text", payload: {} },
    { id: "b", page: 0, z: 2, bbox: { x: 10, y: 10, w: 20, h: 20 }, kind: "shape", payload: {} },
    { id: "c", page: 1, z: 9, bbox: { x: 0, y: 0, w: 50, h: 50 }, kind: "text", payload: {} },
  ];
  expect(hitTest(objects, 0, 15, 15)).toBe("b");
  expect(hitTest(objects, 0, 90, 90)).toBe(null);
});

test("moveObject shifts bbox", () => {
  const obj = { bbox: { x: 1, y: 2, w: 3, h: 4 } };
  expect(moveObject(obj, 10, -1).bbox).toEqual({ x: 11, y: 1, w: 3, h: 4 });
});
