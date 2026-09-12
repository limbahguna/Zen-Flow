import sharp from "sharp";
import path from "path";
import { mkdirSync } from "fs";

const OUT_DIR = path.resolve(
  import.meta.dirname,
  "../../artifacts/mindful-productivity/public/icons",
);

mkdirSync(OUT_DIR, { recursive: true });

const BG = { r: 26, g: 30, b: 26 };
const LEAF = { r: 143, g: 166, b: 128 };
const STEM = { r: 26, g: 30, b: 26 };

function makeSvg(size: number): Buffer {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = Math.round(s * 0.15);         // corner radius
  const leafTop = Math.round(s * 0.12);
  const leafBottom = Math.round(s * 0.85);
  const leafW = Math.round(s * 0.38);
  const stemX1 = cx;
  const stemY1 = Math.round(s * 0.85);
  const stemY2 = Math.round(s * 0.52);
  const branchLen = Math.round(s * 0.14);
  const sw = Math.max(2, Math.round(s * 0.03));
  const bw = Math.max(1.5, Math.round(s * 0.025));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${r}" fill="rgb(${BG.r},${BG.g},${BG.b})"/>
  <path d="M${cx} ${leafTop}
    C${cx} ${leafTop} ${cx - leafW} ${Math.round(cy * 0.7)} ${cx - leafW * 0.7} ${Math.round(cy * 1.05)}
    C${cx - leafW * 0.3} ${leafBottom} ${cx + leafW * 0.3} ${leafBottom} ${cx + leafW * 0.7} ${Math.round(cy * 1.05)}
    C${cx + leafW} ${Math.round(cy * 0.7)} ${cx} ${leafTop} ${cx} ${leafTop}Z"
    fill="rgb(${LEAF.r},${LEAF.g},${LEAF.b})"/>
  <line x1="${stemX1}" y1="${stemY1}" x2="${stemX1}" y2="${stemY2}" stroke="rgb(${STEM.r},${STEM.g},${STEM.b})" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${stemX1}" y1="${Math.round(stemY2 + (stemY1 - stemY2) * 0.35)}" x2="${stemX1 - branchLen}" y2="${Math.round(stemY2 + (stemY1 - stemY2) * 0.35) - branchLen}" stroke="rgb(${STEM.r},${STEM.g},${STEM.b})" stroke-width="${bw}" stroke-linecap="round"/>
  <line x1="${stemX1}" y1="${Math.round(stemY2 + (stemY1 - stemY2) * 0.6)}" x2="${stemX1 + branchLen}" y2="${Math.round(stemY2 + (stemY1 - stemY2) * 0.6) - branchLen}" stroke="rgb(${STEM.r},${STEM.g},${STEM.b})" stroke-width="${bw}" stroke-linecap="round"/>
</svg>`;

  return Buffer.from(svg);
}

async function generate(size: number): Promise<void> {
  const svgBuf = makeSvg(size);
  const outPath = path.join(OUT_DIR, `icon-${size}.png`);
  await sharp(svgBuf).png().toFile(outPath);
  console.log(`✓ icon-${size}.png`);
}

await generate(192);
await generate(512);
console.log("Icons generated →", OUT_DIR);
