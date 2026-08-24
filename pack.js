import { readFile, writeFile } from "node:fs/promises";

const files = ["host.js", "open.js", "model.js", "edits.js", "ai.js", "session.js", "pdfio.js", "tools.js", "app.js"];
const parts = [];
for (const file of files) {
  let src = await readFile(new URL(file, import.meta.url), "utf8");
  src = src.replace(/^import .+;?\n/gm, "");
  src = src.replace(/^export /gm, "");
  parts.push(`try {\n${src}\n} catch (err) { console.error(${JSON.stringify(file)}, err); }`);
}

const pdfLib = await readFile(new URL("vendor/pdf-lib.min.js", import.meta.url), "utf8");
const pdfjs = await readFile(new URL("vendor/pdf.min.js", import.meta.url), "utf8");
const worker = await readFile(new URL("vendor/pdf.worker.min.js", import.meta.url), "utf8");
const boot = `globalThis.PDFJS_WORKER_SRC = URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: "application/javascript" }));`;
const vendors = `try {\n${pdfLib}\n} catch (err) { console.error(err); }\ntry {\n${boot}\n${pdfjs}\n} catch (err) { console.error(err); }`;

const css = await readFile(new URL("style.css", import.meta.url), "utf8");
const template = await readFile(new URL("index.template.html", import.meta.url), "utf8");
const html = template.replace("<!-- STYLES -->", css).replace("<!-- BUNDLE -->", [...parts, vendors].join("\n;\n"));
await writeFile(new URL("index.html", import.meta.url), html);
console.log("wrote index.html");
