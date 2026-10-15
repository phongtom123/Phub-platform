/** Serve only existing public catalog assets, shared with the customer UI. */
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export const runtime = "nodejs";
const types: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
};

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const missing = () => new Response(null, { status: 404 });
  if (!path.length || path.some(part => !part || part === "." || part === ".." || /[/\\\x00]/.test(part))) return missing();
  const type = types[extname(path[path.length - 1]).toLowerCase()];
  if (!type) return missing();
  try {
    // npm run dev/start runs in adminUI; do not fetch arbitrary external URLs.
    const root = await realpath(resolve(process.cwd(), "../userUI/Frontend/public/images"));
    const target = await realpath(resolve(root, ...path));
    if (!target.startsWith(root + sep)) return missing();
    const info = await stat(target);
    if (!info.isFile() || info.size > 10 * 1024 * 1024) return missing();
    const data = await readFile(target);
    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return missing(); }
}
