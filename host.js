export function bytesToBase64(bytes) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

export function base64ToBytes(value) {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createNovaCall(opts) {
  return function novaCall(method, params, onChunk) {
    const id = opts.id ? opts.id() : crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const stop = opts.subscribe((msg) => {
        if (!msg || msg.v !== 1 || msg.id !== id) return;
        if (msg.type === "chunk") {
          onChunk?.(msg.text);
          return;
        }
        stop();
        if (msg.type === "result" && msg.ok) resolve(msg.value);
        else reject(new Error(msg.error || "failed"));
      });
      opts.post({ v: 1, id, type: "call", method, params: params ?? {} });
    });
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, { createNovaCall, bytesToBase64, base64ToBytes });
}
