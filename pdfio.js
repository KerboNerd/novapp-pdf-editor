export function textItemToObject(item, pageHeight, id, page = 0) {
  const t = item.transform ?? [1, 0, 0, 1, 0, 0];
  const x = t[4];
  const yPdf = t[5];
  const w = item.width ?? 0;
  const h = item.height ?? Math.abs(t[3] || 10);
  return {
    id,
    page,
    kind: "text",
    bbox: { x, y: pageHeight - yPdf - h, w: w || 10, h: h || 10 },
    z: 0,
    payload: { text: item.str ?? "", lifted: true },
  };
}

export function liftTextContent(content, pageHeight, page) {
  return (content.items ?? []).map((item, i) => textItemToObject(item, pageHeight, `p${page}-t${i}`, page));
}

export function topLeftToPdf(bbox, pageHeight) {
  return { x: bbox.x, y: pageHeight - bbox.y - bbox.h, w: bbox.w, h: bbox.h };
}

export function sniffPdf(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 8));
  if (!head.startsWith("%PDF")) throw new Error("not a PDF");
  const text = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.byteLength, 500_000)));
  const match = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
  const w = match ? Number(match[3]) - Number(match[1]) : 612;
  const h = match ? Number(match[4]) - Number(match[2]) : 792;
  const count = Math.max(1, (text.match(/\/Type\s*\/Page(?!s)/g) || []).length);
  const pages = Array.from({ length: count }, () => ({ w, h }));
  return {
    pages,
    objects: [],
    unlifted: pages.map((_, page) => ({ page, reason: "page-render" })),
  };
}

export function planDrawOps(doc) {
  const objects = [...(doc.objects ?? [])].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const ops = [];
  for (const obj of objects) {
    const height = doc.pages?.[obj.page]?.h ?? 792;
    const box = topLeftToPdf(obj.bbox, height);
    const payload = obj.payload ?? {};
    if (obj.kind === "text") {
      ops.push({ type: "text", page: obj.page, x: box.x, y: box.y, size: payload.size ?? 12, text: String(payload.text ?? "") });
      continue;
    }
    if (obj.kind === "shape") {
      const shape = payload.shape ?? "rect";
      if (shape === "line") {
        ops.push({ type: "line", page: obj.page, x1: box.x, y1: box.y, x2: box.x + box.w, y2: box.y + box.h });
      } else if (shape === "ellipse") {
        ops.push({ type: "ellipse", page: obj.page, ...box });
      } else {
        ops.push({ type: "rect", page: obj.page, ...box });
      }
      continue;
    }
    if (obj.kind === "annotation") {
      if (payload.kind === "highlight") ops.push({ type: "highlight", page: obj.page, ...box });
      else ops.push({ type: "note", page: obj.page, ...box, text: String(payload.text ?? "") });
      continue;
    }
    if (obj.kind === "image") {
      ops.push({ type: "image", page: obj.page, ...box, bytesBase64: payload.bytesBase64, mime: payload.mime });
      continue;
    }
    if (obj.kind === "field") {
      ops.push({
        type: "field",
        page: obj.page,
        ...box,
        field: payload.field,
        name: payload.name,
        value: payload.value,
        options: payload.options,
      });
    }
  }
  return ops;
}

function rgbOf(lib, r, g, b) {
  return lib.rgb(r, g, b);
}

export async function writePdf(sourceBytes, doc, lib = globalThis.PDFLib) {
  if (!lib?.PDFDocument) throw new Error("pdf_lib_missing");
  const pdf = await lib.PDFDocument.load(sourceBytes);
  const pages = pdf.getPages();
  const form = pdf.getForm();
  for (const op of planDrawOps(doc)) {
    const page = pages[op.page];
    if (!page) continue;
    if (op.type === "text") {
      page.drawText(op.text || " ", { x: op.x, y: op.y, size: op.size });
    } else if (op.type === "rect") {
      page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, borderColor: rgbOf(lib, 0.2, 0.18, 0.16), borderWidth: 1 });
    } else if (op.type === "ellipse") {
      page.drawEllipse({ x: op.x + op.w / 2, y: op.y + op.h / 2, xScale: op.w / 2, yScale: op.h / 2, borderColor: rgbOf(lib, 0.2, 0.18, 0.16), borderWidth: 1 });
    } else if (op.type === "line") {
      page.drawLine({ start: { x: op.x1, y: op.y1 }, end: { x: op.x2, y: op.y2 }, color: rgbOf(lib, 0.2, 0.18, 0.16), thickness: 1 });
    } else if (op.type === "highlight") {
      page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, color: rgbOf(lib, 0.77, 0.64, 0.42), opacity: 0.35 });
    } else if (op.type === "note") {
      page.drawRectangle({ x: op.x, y: op.y, width: op.w, height: op.h, color: rgbOf(lib, 0.89, 0.86, 0.78) });
      if (op.text) page.drawText(op.text, { x: op.x + 2, y: op.y + 4, size: 8 });
    } else if (op.type === "image" && op.bytesBase64) {
      const raw = Uint8Array.from(atob(op.bytesBase64), (c) => c.charCodeAt(0));
      const image = op.mime && String(op.mime).includes("jpeg")
        ? await pdf.embedJpg(raw)
        : await pdf.embedPng(raw).catch(() => pdf.embedJpg(raw));
      page.drawImage(image, { x: op.x, y: op.y, width: op.w, height: op.h });
    } else if (op.type === "field") {
      const name = String(op.name || `field-${op.page}-${op.x}-${op.y}`);
      if (op.field === "check") {
        const box = form.createCheckBox(name);
        box.addToPage(page, { x: op.x, y: op.y, width: op.w, height: op.h });
        if (op.value) box.check();
      } else if (op.field === "dropdown") {
        const list = form.createDropdown(name);
        list.addOptions(Array.isArray(op.options) ? op.options : []);
        list.addToPage(page, { x: op.x, y: op.y, width: op.w, height: op.h });
        if (op.value) list.select(String(op.value));
      } else {
        const field = form.createTextField(name);
        field.addToPage(page, { x: op.x, y: op.y, width: op.w, height: op.h });
        if (op.value) field.setText(String(op.value));
      }
    }
  }
  return new Uint8Array(await pdf.save());
}

export async function loadPdf(bytes, pdfjs = globalThis.pdfjsLib) {
  if (!pdfjs?.getDocument) throw new Error("pdfjs_missing");
  if (globalThis.PDFJS_WORKER_SRC) pdfjs.GlobalWorkerOptions.workerSrc = globalThis.PDFJS_WORKER_SRC;
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages = [];
  const objects = [];
  const unlifted = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const view = page.view;
    const w = view[2] - view[0];
    const h = view[3] - view[1];
    pages.push({ w, h });
    objects.push(...liftTextContent(await page.getTextContent(), h, i - 1));
    unlifted.push({ page: i - 1, reason: "page-render" });
  }
  return { pdf, pages, objects, unlifted };
}

export async function renderPageToCanvas(pdf, pageIndex, canvas, dpr = 1) {
  if (!pdf || !canvas) return;
  const page = await pdf.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const cssW = canvas.clientWidth || base.width;
  const scale = (cssW / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
}

if (typeof globalThis !== "undefined") {
  globalThis.NovaPdf = Object.assign(globalThis.NovaPdf || {}, {
    textItemToObject,
    liftTextContent,
    topLeftToPdf,
    sniffPdf,
    planDrawOps,
    writePdf,
    loadPdf,
    renderPageToCanvas,
  });
}
