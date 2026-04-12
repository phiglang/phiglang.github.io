import "./style.css";
import { parse } from "./phig";

function escapeHTML(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Loc {
  line: number;
  col: number;
}

function locAt(src: string, i: number): Loc {
  let line = 1,
    col = 1;
  for (let j = 0; j < i && j < src.length; ++j) {
    if (src[j] === "\n") {
      ++line;
      col = 1;
    } else ++col;
  }
  return { line, col };
}

function highlightJSON(obj: unknown, indent = 0): string {
  const p = "  ".repeat(indent),
    p1 = "  ".repeat(indent + 1);
  if (Array.isArray(obj)) {
    if (!obj.length) return '<span class="hl-punct">[]</span>';
    return `<span class="hl-punct">[</span>\n${obj
      .map(
        (v, i) =>
          p1 +
          highlightJSON(v, indent + 1) +
          (i < obj.length - 1 ? '<span class="hl-punct">,</span>' : ""),
      )
      .join("\n")}\n${p}<span class="hl-punct">]</span>`;
  }
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj);
    if (!keys.length) return '<span class="hl-punct">{}</span>';
    return `<span class="hl-punct">{</span>\n${keys
      .map(
        (k, i) =>
          p1 +
          `<span class="hl-key">"${escapeHTML(JSON.stringify(k).slice(1, -1))}"</span>` +
          '<span class="hl-punct">:</span> ' +
          highlightJSON(obj[k as keyof typeof obj], indent + 1) +
          (i < keys.length - 1 ? '<span class="hl-punct">,</span>' : ""),
      )
      .join("\n")}\n${p}<span class="hl-punct">}</span>`;
  }
  if (typeof obj === "string")
    return `<span class="hl-string">"${escapeHTML(JSON.stringify(obj).slice(1, -1))}"</span>`;
  return escapeHTML(JSON.stringify(obj));
}

const input = document.getElementById("input")! as HTMLTextAreaElement;
const output = document.getElementById("output")! as HTMLDivElement;
const hl = document.getElementById("highlight")! as HTMLDivElement;
const squiggles = document.getElementById("squiggles")! as HTMLDivElement;
const status = document.getElementById("status"!) as HTMLSpanElement;

function update() {
  let hlHTML = "";
  const src = input.value;
  const { root, errors } = parse(src, (cls, text) => {
    const escaped = escapeHTML(text);
    hlHTML += cls ? `<span class="hl-${cls}">${escaped}</span>` : escaped;
  });
  // white-space:pre divs swallow the final newline, but textareas don't.
  // append an extra newline so the highlight layer matches the textarea height.
  if (src.endsWith("\n")) hlHTML += "\n";
  hl.innerHTML = hlHTML;

  // build squiggle underline layer from error ranges
  if (errors.length > 0) {
    const ranges = errors
      .map((e) => [e.start, e.end] as const)
      .sort((a, b) => a[0] - b[0]);
    let sqHTML = "";
    let cursor = 0;
    for (const [s, e] of ranges) {
      if (s < cursor) continue; // overlapping, skip
      if (s > cursor) sqHTML += escapeHTML(src.slice(cursor, s));
      sqHTML += `<span class="squiggle">${escapeHTML(src.slice(s, e))}</span>`;
      cursor = e;
    }
    if (cursor < src.length) sqHTML += escapeHTML(src.slice(cursor));
    if (src.endsWith("\n")) sqHTML += "\n";
    squiggles.innerHTML = sqHTML;
  } else {
    squiggles.innerHTML = "";
  }

  if (errors.length > 0) {
    output.innerHTML = errors
      .map((e) => {
        const s = locAt(src, e.start);
        const d = locAt(src, e.end);
        return `<span class="hl-error">${s.line}:${s.col}-${d.line}:${d.col}: ${escapeHTML(e.msg)}</span>`;
      })
      .join("\n");
    status.textContent = "error";
    status.className = "status-error";
  } else {
    output.innerHTML = highlightJSON(root);
    status.textContent = "✓";
    status.className = "status-ok";
  }
}
input.addEventListener("scroll", () => {
  hl.scrollTop = input.scrollTop;
  hl.scrollLeft = input.scrollLeft;
  squiggles.scrollTop = input.scrollTop;
  squiggles.scrollLeft = input.scrollLeft;
});
input.addEventListener("input", update);

update();

const g = document.querySelector(".grammar")!;
g.innerHTML = g.textContent!.replace(
  /(?<key>\w+)|(?<string>'[^']*'|"[^"]*")|(?<qescape>\/[^/]*\/)|(?<punct>[[\]{}()|=])/gm,
  (...args) => {
    for (const [cls, text] of Object.entries(args.at(-1)!)) {
      if (text)
        return `<span class="hl-${cls}">${escapeHTML(text as string)}</span>`;
    }
    return args[0];
  },
);
