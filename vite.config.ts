import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { marked, type Tokens } from "marked";
import type { Plugin } from "vite";

const SPEC_PATH = resolve("spec.md");

function readSpec() {
  const md = readFileSync("spec.md", "utf-8");
  const tokens = marked.lexer(md);
  const h1 = tokens.find(
    (t): t is Tokens.Heading => t.type === "heading" && t.depth === 1,
  );
  const grammarMatch = md.match(
    /<!--grammar-->\n```\n([\s\S]*?)\n```\n<!--\/grammar-->/,
  );
  return { tokens, h1, grammar: grammarMatch?.[1] ?? "" };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function specPlugin(): Plugin {
  const SPEC_FILENAME = "spec.html";

  function render(): string {
    const { tokens, h1 } = readSpec();
    const title = h1 ? escapeHtml(h1.text) : "phig spec";
    const body = marked.parser(tokens);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
body { max-width: 720px; margin: 0 auto; padding: 20px; font-family: system-ui, sans-serif; line-height: 1.6; color: #333; }
pre { background: #f5f5f5; padding: 12px 16px; border-radius: 4px; overflow-x: auto; }
code { font-size: 0.9em; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 4px 10px; text-align: left; }
</style>
</head>
<body>${body}</body>
</html>`;
  }

  return {
    name: "spec",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === `/${SPEC_FILENAME}`) {
          res.setHeader("Content-Type", "text/html");
          res.end(render());
        } else {
          next();
        }
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: SPEC_FILENAME,
        source: render(),
      });
    },
  };
}

function grammarPlugin(): Plugin {
  return {
    name: "grammar",
    configureServer(server) {
      server.watcher.add(SPEC_PATH);
      server.watcher.on("change", (file) => {
        if (file === SPEC_PATH) {
          server.ws.send({ type: "full-reload" });
        }
      });
    },
    transformIndexHtml(html) {
      const { grammar } = readSpec();
      return html.replace("%GRAMMAR%", escapeHtml(grammar));
    },
  };
}

export default {
  plugins: [specPlugin(), grammarPlugin()],
};
