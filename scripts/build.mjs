import { build } from "esbuild";
import { mkdir, copyFile, cp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
await mkdir("assets", { recursive: true });
await copyFile(
  require.resolve("pdfjs-dist/build/pdf.worker.mjs"),
  "assets/pdf.worker.mjs",
);
await copyFile(
  path.join(
    path.dirname(require.resolve("pdfjs-dist/package.json")),
    "LICENSE",
  ),
  "assets/PDFJS-LICENSE",
);
for (const dir of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), dir),
    path.join("assets", dir),
    { recursive: true },
  );
await build({
  entryPoints: ["src/host/index.js"],
  outfile: "host.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
});
await build({
  entryPoints: ["src/client/main.jsx"],
  outfile: "client.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "chrome120",
  external: ["react"],
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  banner: {
    js: 'window.__ModuleLoader__.load({id:"dsh-ai-reading-room",factory(require){',
  },
  footer: { js: "return ReadingRoomPlugin;}});" },
  globalName: "ReadingRoomPlugin",
  define: { "process.env.NODE_ENV": '"production"' },
});
await writeFile("index.js", "export {apply, inject} from './host.js';\n");
console.log("Built Host, Client and PDF worker");
