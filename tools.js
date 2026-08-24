export function hitTest(objects, page, x, y) {
  let found = null;
  let z = -Infinity;
  for (const obj of objects) {
    if (obj.page !== page) continue;
    const b = obj.bbox;
    if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) continue;
    if (obj.z >= z) {
      z = obj.z;
      found = obj.id;
    }
  }
  return found;
}

export function moveObject(obj, dx, dy) {
  return { ...obj, bbox: { ...obj.bbox, x: obj.bbox.x + dx, y: obj.bbox.y + dy } };
}

export function resizeObject(obj, bbox) {
  return { ...obj, bbox };
}

export function newId() {
  return crypto.randomUUID();
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, { hitTest, moveObject, resizeObject, newId });
}
