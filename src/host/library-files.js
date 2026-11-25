import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
export const bookExtension = (name) =>
  /\.(epub|pdf|txt|md|markdown)$/i.test(name);
export const fileName = (b) => {
  const parsed = path.parse(path.basename(b.originalName));
  let stem = parsed.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  while (Buffer.byteLength(stem, "utf8") > 170)
    stem = Array.from(stem).slice(0, -1).join("");
  return b.hash.slice(0, 12) + "-" + stem + parsed.ext.toLowerCase();
};
export async function realDirectory(input, create = false) {
  if (typeof input !== "string" || !path.isAbsolute(input))
    throw new Error("ABSOLUTE_DIRECTORY_REQUIRED");
  if (create) await fs.mkdir(input, { recursive: true });
  const real = await fs.realpath(input);
  if (!(await fs.stat(real)).isDirectory())
    throw new Error("DIRECTORY_REQUIRED");
  return real;
}
export async function scanDirectory(
  input,
  { recursive = true, limit = 1000, exclude = [] } = {},
) {
  const root = await realDirectory(input),
    items = [],
    seen = new Set();
  let truncated = false;
  async function visit(dir, depth) {
    if (depth > 20 || items.length >= limit) {
      truncated = true;
      return;
    }
    const key = await fs.realpath(dir);
    if (seen.has(key) || exclude.includes(key)) return;
    seen.add(key);
    const entries = await fs.readdir(key, { withFileTypes: true });
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const file = path.join(key, e.name);
      if (e.isFile() && bookExtension(e.name)) {
        const stat = await fs.stat(file);
        items.push({
          name: e.name,
          path: file,
          relative: path.relative(root, file),
          bytes: stat.size,
        });
        if (items.length >= limit) {
          truncated = true;
          break;
        }
      } else if (recursive && e.isDirectory()) await visit(file, depth + 1);
      if (items.length >= limit) break;
    }
  }
  await visit(root, 0);
  return { root, items, truncated };
}
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export async function copyVerified(source, target, expected) {
  const bytes = await fs.readFile(source);
  if (digest(bytes) !== expected) throw new Error("ORIGINAL_HASH_MISMATCH");
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    const existing = await fs.readFile(target);
    if (digest(existing) !== expected) throw new Error("TARGET_FILE_CONFLICT");
    return;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const tmp = target + "." + randomUUID() + ".tmp";
  await fs.writeFile(tmp, bytes, { flag: "wx" });
  await fs.rename(tmp, target);
  if (digest(await fs.readFile(target)) !== expected)
    throw new Error("COPY_VERIFY_FAILED");
}
