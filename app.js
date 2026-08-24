const N = globalThis.NovaPdf;
const novaCall = N.createNovaCall({
  post: (msg) => parent.postMessage(msg, "*"),
  subscribe: (fn) => {
    const on = (event) => {
      if (event.source === parent) fn(event.data);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  },
});

const session = N.createSession();
const ui = {
  open: document.getElementById("open"),
  save: document.getElementById("save"),
  saveAs: document.getElementById("save-as"),
  undo: document.getElementById("undo"),
  redo: document.getElementById("redo"),
  pages: document.getElementById("pages"),
  page: document.getElementById("page"),
  overlay: document.getElementById("overlay"),
  canvas: document.getElementById("page-canvas"),
  status: document.getElementById("status"),
  instruction: document.getElementById("instruction"),
  scope: document.getElementById("scope"),
  ask: document.getElementById("ask"),
  imageUrl: document.getElementById("image-url"),
};

let selectedId = null;
let tool = "select";
let recents = [];

function setStatus(text, kind) {
  ui.status.textContent = text;
  ui.status.className = kind === "cut" ? "cut" : "";
}

function explain(err) {
  return err instanceof Error ? err.message : String(err);
}

function renderPages() {
  ui.pages.replaceChildren();
  (session.doc.pages ?? []).forEach((_, i) => {
    const btn = document.createElement("button");
    btn.className = `page-btn${i === session.page ? " on" : ""}`;
    btn.textContent = String(i + 1);
    btn.addEventListener("click", () => {
      session.page = i;
      render();
    });
    ui.pages.append(btn);
  });
}

function renderOverlay() {
  ui.overlay.replaceChildren();
  for (const obj of session.doc.objects ?? []) {
    if (obj.page !== session.page) continue;
    const el = document.createElement("div");
    el.className = `obj${obj.id === selectedId ? " sel" : ""}`;
    el.style.left = `${obj.bbox.x}px`;
    el.style.top = `${obj.bbox.y}px`;
    el.style.width = `${obj.bbox.w}px`;
    el.style.height = `${obj.bbox.h}px`;
    const lifted = Boolean(obj.payload?.lifted);
    el.classList.toggle("lifted", lifted);
    el.textContent = obj.kind === "text" && (!lifted || obj.id === selectedId) ? String(obj.payload?.text ?? "") : "";
    el.addEventListener("mousedown", (event) => {
      if (tool !== "select") return;
      selectedId = obj.id;
      const start = { x: event.clientX, y: event.clientY, bx: obj.bbox.x, by: obj.bbox.y };
      session.history = N.pushHistory(session.history, session.doc);
      function move(ev) {
        obj.bbox.x = start.bx + (ev.clientX - start.x);
        obj.bbox.y = start.by + (ev.clientY - start.y);
        session.doc.dirty = true;
        renderOverlay();
      }
      function up() {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        render();
      }
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      renderOverlay();
    });
    ui.overlay.append(el);
  }
}

function render() {
  ui.save.disabled = !session.doc.path && !session.doc.bytes;
  renderPages();
  renderOverlay();
  if (session.pdf && ui.canvas && N.renderPageToCanvas) {
    void N.renderPageToCanvas(session.pdf, session.page, ui.canvas, window.devicePixelRatio || 1).catch(() => {});
  }
}

async function persistRecents(path, name) {
  recents = N.rememberRecent(recents, { path, name, at: new Date().toISOString() });
  await novaCall("storage.set", { key: "recents", value: recents });
}

async function openAt(path, name) {
  const read = await novaCall("fs.read", { path, encoding: "base64" });
  const bytes = N.base64ToBytes ? N.base64ToBytes(read.bytesBase64) : undefined;
  let info = N.sniffPdf ? N.sniffPdf(bytes ?? new Uint8Array()) : { pages: [{ w: 612, h: 792 }], objects: [], unlifted: [{ page: 0, reason: "page-render" }] };
  session.pdf = null;
  if (N.loadPdf && bytes) {
    try {
      const loaded = await N.loadPdf(bytes);
      info = { pages: loaded.pages, objects: loaded.objects, unlifted: loaded.unlifted };
      session.pdf = loaded.pdf;
    } catch {
      session.pdf = null;
    }
  }
  N.openDocument(session, { path, name, bytes, pages: info.pages, objects: info.objects, unlifted: info.unlifted });
  selectedId = null;
  ui.page.style.width = `${info.pages[0]?.w ?? 612}px`;
  ui.page.style.height = `${info.pages[0]?.h ?? 792}px`;
  await persistRecents(path, name);
  setStatus(session.pdf ? "Opened" : "Opened. Page paint not lifted.");
  render();
}

async function writeCurrent(path) {
  if (!session.doc.bytes) throw new Error("Nothing to save");
  const out = N.writePdf ? await N.writePdf(session.doc.bytes, session.doc) : session.doc.bytes;
  const bytesBase64 = N.bytesToBase64 ? N.bytesToBase64(out) : btoa(String.fromCharCode(...out));
  await novaCall("fs.write", { path, bytesBase64 });
  session.doc.path = path;
  session.doc.dirty = false;
  setStatus("Saved");
  render();
}

ui.open.addEventListener("click", async () => {
  try {
    const file = await novaCall("fs.pick", {});
    if (!file) return;
    await openAt(file.path, file.name);
  } catch (err) {
    setStatus(explain(err), "cut");
  }
});

ui.save.addEventListener("click", async () => {
  try {
    if (!session.doc.path) {
      ui.saveAs.click();
      return;
    }
    await writeCurrent(session.doc.path);
  } catch (err) {
    setStatus(explain(err), "cut");
  }
});

ui.saveAs.addEventListener("click", async () => {
  try {
    const file = await novaCall("fs.pickSave", { defaultName: session.doc.name || "document.pdf", accept: ".pdf" });
    if (!file) return;
    await writeCurrent(file.path);
    await persistRecents(file.path, file.name);
  } catch (err) {
    setStatus(explain(err), "cut");
  }
});

ui.undo.addEventListener("click", () => {
  const next = N.undo(session.history, session.doc);
  session.doc = next.doc;
  session.history = next.history;
  render();
});

ui.redo.addEventListener("click", () => {
  const next = N.redo(session.history, session.doc);
  session.doc = next.doc;
  session.history = next.history;
  render();
});

document.querySelectorAll("[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    tool = btn.getAttribute("data-tool");
    setStatus(tool);
  });
});

ui.overlay.addEventListener("click", (event) => {
  if (event.target !== ui.overlay) return;
  if (tool === "select") {
    selectedId = null;
    renderOverlay();
    return;
  }
  const rect = ui.overlay.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const id = N.newId ? N.newId() : crypto.randomUUID();
  const object = {
    id,
    page: session.page,
    kind: tool === "text" ? "text" : tool === "highlight" || tool === "note" ? "annotation" : tool.startsWith("field") ? "field" : "shape",
    bbox: { x, y, w: 120, h: 28 },
    z: (session.doc.objects?.length ?? 0) + 1,
    payload:
      tool === "text"
        ? { text: "Text" }
        : tool === "highlight" || tool === "note"
          ? { kind: tool, text: "" }
          : tool.startsWith("field")
            ? { field: tool.replace("field-", ""), name: id, value: "" }
            : { shape: tool === "ellipse" || tool === "line" || tool === "rect" ? tool : "rect" },
  };
  session.history = N.pushHistory(session.history, session.doc);
  const applied = N.applyEditList(session.doc, { version: 1, ops: [{ op: "add", object }] });
  if (applied.ok) session.doc = applied.doc;
  selectedId = id;
  render();
});

ui.ask.addEventListener("click", async () => {
  const instruction = ui.instruction.value.trim();
  if (!instruction) {
    setStatus("Write an instruction first.");
    return;
  }
  ui.ask.disabled = true;
  setStatus("Asking");
  try {
    const prompt = N.buildCompletePrompt({
      instruction,
      scope: ui.scope.value,
      doc: session.doc,
      page: session.page,
      selectedIds: selectedId ? [selectedId] : [],
    });
    let text = "";
    const result = await novaCall("models.complete", { prompt }, (chunk) => {
      text += chunk;
      setStatus("Asking");
    });
    const applied = N.applyAi(session, result?.text ?? text);
    if (!applied.ok) {
      setStatus(applied.error || "No edits", "cut");
      return;
    }
    setStatus("Applied");
    render();
  } catch (err) {
    const message = explain(err);
    if (message === "no_chat_model") {
      ui.ask.disabled = true;
      setStatus("no_chat_model", "cut");
      return;
    }
    setStatus(message, "cut");
  } finally {
    if (ui.status.textContent !== "no_chat_model") ui.ask.disabled = false;
  }
});

document.getElementById("place-url")?.addEventListener("click", async () => {
  const url = ui.imageUrl.value.trim();
  if (!url) return;
  try {
    const res = await novaCall("network.fetch", { url, encoding: "base64" });
    const id = N.newId ? N.newId() : crypto.randomUUID();
    session.history = N.pushHistory(session.history, session.doc);
    const applied = N.applyEditList(session.doc, {
      version: 1,
      ops: [
        {
          op: "add",
          object: {
            id,
            page: session.page,
            kind: "image",
            bbox: { x: 40, y: 40, w: 160, h: 120 },
            z: (session.doc.objects?.length ?? 0) + 1,
            payload: { bytesBase64: res.bodyBase64, mime: "image" },
          },
        },
      ],
    });
    if (applied.ok) session.doc = applied.doc;
    render();
    setStatus("Image placed");
  } catch (err) {
    setStatus(explain(err), "cut");
  }
});

novaCall("storage.get", { key: "recents" })
  .then((value) => {
    if (Array.isArray(value)) recents = value;
    setStatus("Ready");
  })
  .catch((err) => setStatus(explain(err), "cut"));

render();
