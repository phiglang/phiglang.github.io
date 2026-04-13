import { readFileSync } from "node:fs";
import { marked } from "marked";
import type { Plugin } from "vite";

function specPlugin(): Plugin {
  const SPEC_ID = "/spec.html";

  function render(): string {
    const md = readFileSync("spec.md", "utf-8");
    const body = marked.parse(md, { async: false }) as string;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>phig spec</title>
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
        if (req.url === SPEC_ID) {
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
        fileName: "spec.html",
        source: render(),
      });
    },
  };
}

export default {
  plugins: [specPlugin()],
};
