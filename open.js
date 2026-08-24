import { base64ToBytes } from "./host.js";

export function asPickedFile(value) {
  if (!value || typeof value !== "object") return null;
  const path = value.path;
  if (typeof path !== "string" || !path) return null;
  const name = typeof value.name === "string" && value.name ? value.name : path.split(/[/\\]/).pop() ?? path;
  return { path, name };
}

export function bytesFromRead(value) {
  if (!value || typeof value !== "object" || typeof value.bytesBase64 !== "string") {
    throw new Error("Could not read that file. Restart NOVA.");
  }
  return base64ToBytes(value.bytesBase64);
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, { asPickedFile, bytesFromRead });
}
