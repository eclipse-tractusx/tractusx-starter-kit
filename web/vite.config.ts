import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The site is static and uses hash routes, so a relative base serves it from any path:
// https://eclipse-tractusx.github.io/tractusx-starter-kit/, a pull request preview under
// pr-preview/<number>/, or `npm run preview` on your machine.
//
// SITE_PREVIEW_PR (set by the Pages workflow for pull requests) shows a banner naming the
// pull request and keeps search engines away from the preview.
const previewPr = process.env.SITE_PREVIEW_PR ?? "";
const sourceSha = process.env.GITHUB_SHA ?? "";

// The guide's "Download install.sh" button: the installer of this commit, next to the page.
const installer = new URL("../developer-toolbox/install.sh", import.meta.url);

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "preview-noindex",
      transformIndexHtml(html) {
        // The Pages workflow checks this revision on the published page.
        let head = sourceSha ? `    <meta name="source-revision" content="${sourceSha}">\n` : "";
        if (previewPr) head += '    <meta name="robots" content="noindex, nofollow">\n';
        return html.replace("</head>", `${head}  </head>`);
      },
    },
    {
      name: "toolbox-installer",
      configureServer(server) {
        server.middlewares.use("/install.sh", (_request, response) => {
          response.setHeader("Content-Type", "text/x-shellscript");
          response.end(readFileSync(installer));
        });
      },
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "install.sh", source: readFileSync(installer) });
      },
    },
  ],
  define: {
    __PREVIEW_PR__: JSON.stringify(previewPr),
    __SOURCE_SHA__: JSON.stringify(sourceSha),
  },
  // The Compose output ships the developer toolbox's own issue_credentials.py.
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", sourcemap: false },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
