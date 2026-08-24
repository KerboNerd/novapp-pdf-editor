import { expect, test } from "bun:test";
import { createNovaCall } from "./host.js";

test("novaCall resolves result and streams chunks", async () => {
  const posts: unknown[] = [];
  const call = createNovaCall({
    post: (msg) => posts.push(msg),
    subscribe: (fn) => {
      queueMicrotask(() => {
        const id = (posts[0] as { id: string }).id;
        fn({ v: 1, id, type: "chunk", text: "He" });
        fn({ v: 1, id, type: "result", ok: true, value: { text: "Hello" } });
      });
      return () => {};
    },
  });
  const value = await call("models.complete", { prompt: "hi" }, (t) => {
    expect(t).toBe("He");
  });
  expect(value).toEqual({ text: "Hello" });
  expect(posts[0]).toMatchObject({ v: 1, type: "call", method: "models.complete" });
});

test("novaCall rejects host errors", async () => {
  const call = createNovaCall({
    post: () => {},
    subscribe: (fn) => {
      queueMicrotask(() => fn({ v: 1, id: "fixed", type: "result", ok: false, error: "no_chat_model" }));
      return () => {};
    },
    id: () => "fixed",
  });
  await expect(call("models.complete", { prompt: "x" })).rejects.toThrow("no_chat_model");
});
