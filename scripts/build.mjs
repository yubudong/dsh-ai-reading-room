import { build } from "esbuild";
import { mkdir, copyFile, cp, writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { MANUAL, MANUAL_VERSION } from "../src/shared/manual.js";
import { SHORTCUTS, keyLabel } from "../src/shared/shortcuts.js";
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const hostFile = `host-${pkg.version}.js`;
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
  outfile: hostFile,
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
  loader: { ".css": "text", ".webp": "dataurl" },
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  banner: {
    js: 'window.__ModuleLoader__.load({id:"dsh-ai-reading-room",factory(require){',
  },
  footer: { js: "return ReadingRoomPlugin;}});" },
  globalName: "ReadingRoomPlugin",
  define: { "process.env.NODE_ENV": '"production"' },
});
await writeFile("index.js", `export {apply, inject} from './${hostFile}';\n`);
await mkdir("docs", { recursive: true });
for (const lang of ["zh", "en"]) {
  const title =
    lang === "zh" ? "AI 书房使用说明书" : "AI Reading Room user guide";
  const sections = MANUAL.map(
    (x) => "## " + x.title[lang] + "\n\n" + x.body[lang],
  ).join("\n\n");
  const table = [
    "| " +
      (lang === "zh"
        ? "操作 | Windows/Linux 默认 | macOS 默认"
        : "Action | Windows/Linux defaults | macOS defaults") +
      " |",
    "|---|---|---|",
    ...SHORTCUTS.map(
      (s) =>
        "| " +
        s[lang] +
        " | " +
        s.keys.map((k) => keyLabel(k, false)).join(" / ") +
        " | " +
        s.keys.map((k) => keyLabel(k, true)).join(" / ") +
        " |",
    ),
  ].join("\n");
  await writeFile(
    "docs/USER_GUIDE." + lang + ".md",
    "# " +
      title +
      "\n\nVersion " +
      MANUAL_VERSION +
      "\n\n" +
      sections +
      "\n\n" +
      table +
      "\n\n" +
      (lang === "zh"
        ? "以上是默认键位；帮助中心显示当前设备自定义后的实际配置。"
        : "These are defaults; the in-app guide shows your effective device-local bindings.") +
      "\n",
  );
}
console.log("Built Host, Client, PDF resources and bilingual user guides");
