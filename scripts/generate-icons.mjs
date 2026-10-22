// Generates every Jarvis icon from the master artwork at apps/web/brand/jarvis-mark.svg.
// Run: npm run icons  (uses sharp, already a dependency). Outputs are committed, so builds never need this.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const web = path.join(root, "apps/web");
const master = await readFile(path.join(web, "brand/jarvis-mark.svg"));
const png = (size, svg = master) => sharp(svg, { density: Math.max(72, Math.ceil((72 * size) / 512) * 4) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** Minimal ICO writer: PNG-compressed entries (supported by every current browser and Windows Vista+). */
function ico(images) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  const entries = []; let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6); entry.writeUInt32LE(data.length, 8); entry.writeUInt32LE(offset, 12);
    entries.push(entry); offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

// Maskable icons need the artwork inside the central 80% "safe zone" on a full-bleed background.
const maskable = Buffer.from(master.toString("utf8")
  .replace('<rect width="512" height="512" rx="116" fill="url(#bg)"/>', '<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace("</svg>", "</g></svg>"));

const appDir = path.join(web, "src/app");
const iconsDir = path.join(web, "public/icons");
await mkdir(iconsDir, { recursive: true });

await writeFile(path.join(appDir, "icon.svg"), master);
await writeFile(path.join(appDir, "favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })))));
await writeFile(path.join(appDir, "apple-icon.png"), await png(180));
for (const size of [192, 512]) await writeFile(path.join(iconsDir, `icon-${size}.png`), await png(size));
await writeFile(path.join(iconsDir, "maskable-512.png"), await png(512, maskable));
console.log("Icons written: app/icon.svg, app/favicon.ico, app/apple-icon.png, public/icons/icon-{192,512}.png, public/icons/maskable-512.png");
