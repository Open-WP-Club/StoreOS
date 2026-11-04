import { escapeHtml } from './receipt';
import { formatPrice } from './currency';

// Code128 bar/space widths per symbol value 0..106 (106 = stop, 7 elements).
const P =
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112';
export const CODE128_PATTERNS: string[] = P.split(' ');

const START_B = 104;
const STOP = 106;

/** Symbol values (start, data, checksum, stop) for Code128 set B; null if not printable ASCII. */
// ponytail: set B only (no digit-pair set C compression); add C if label width gets tight.
export function code128Values(text: string): number[] | null {
  if (!text) return null;
  const vals = [START_B];
  let sum = START_B;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return null;
    vals.push(c - 32);
    sum += (c - 32) * (i + 1);
  }
  vals.push(sum % 103, STOP);
  return vals;
}

/** Module widths (alternating bar/space, starting with a bar) for the whole symbol. */
export function code128Modules(text: string): number[] | null {
  const vals = code128Values(text);
  return vals && vals.flatMap((v) => [...(CODE128_PATTERNS[v] as string)].map(Number));
}

/** Inline SVG (stretches to its box) with 10-module quiet zones; '' if text isn't encodable. */
export function code128Svg(text: string): string {
  const mods = code128Modules(text);
  if (!mods) return '';
  const quiet = 10;
  let x = quiet;
  let rects = '';
  mods.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="1"/>`;
    x += w;
  });
  const total = x + quiet;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 1" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
}

export interface LabelSize {
  id: string;
  name: string;
  /** mm; for sheets, the label cell size. */
  w: number;
  h: number;
  /** Sheet grid columns (A4); absent for roll/single labels. */
  cols?: number;
}

export const LABEL_SIZES: LabelSize[] = [
  { id: '40x30', name: '40 x 30 mm', w: 40, h: 30 },
  { id: '50x30', name: '50 x 30 mm', w: 50, h: 30 },
  { id: '58roll', name: '58 mm roll', w: 58, h: 35 },
  { id: 'a4', name: 'A4 sheet (3 x 8)', w: 70, h: 37, cols: 3 },
];

export interface LabelProduct {
  name: string;
  sku: string;
  price: string;
}
export interface LabelOptions {
  size: LabelSize;
  showName: boolean;
  showPrice: boolean;
  showSku: boolean;
  copies: number;
  currencySymbol: string | null;
}

/** Hard cap so the HTML stays under the 200 KB receipt:print limit is checked by the caller. */
export function renderLabelsHtml(products: LabelProduct[], o: LabelOptions): string {
  const { size } = o;
  const one = (p: LabelProduct): string => {
    const svg = o.showSku ? code128Svg(p.sku) : '';
    return (
      `<div class="l">` +
      (o.showName ? `<div class="n">${escapeHtml(p.name)}</div>` : '') +
      (svg ? `<div class="bc">${svg}</div>` : '') +
      (o.showSku && p.sku ? `<div class="s">${escapeHtml(p.sku)}</div>` : '') +
      (o.showPrice && p.price !== ''
        ? `<div class="p">${escapeHtml(formatPrice(p.price, o.currencySymbol))}</div>`
        : '') +
      `</div>`
    );
  };
  const cells = products.flatMap((p) =>
    Array.from({ length: Math.max(1, o.copies) }, () => one(p))
  );
  const sheet = size.cols !== undefined;
  const page = sheet ? 'A4' : `${size.w}mm ${size.h}mm`;
  const grid = sheet
    ? `body{display:grid;grid-template-columns:repeat(${size.cols},${size.w}mm);grid-auto-rows:${size.h}mm}`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
@page{size:${page};margin:0}
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000}${grid}
.l{width:${size.w}mm;height:${size.h}mm;padding:1.5mm;overflow:hidden;text-align:center;${sheet ? '' : 'page-break-after:always;'}display:flex;flex-direction:column;justify-content:center;gap:.5mm}
.n{font-size:8pt;font-weight:bold;line-height:1.1;max-height:2.3em;overflow:hidden}
.bc{height:${Math.round(size.h * 0.35)}mm}.bc svg{width:100%;height:100%}
.s{font-size:7pt;font-family:monospace}.p{font-size:11pt;font-weight:bold}
</style></head><body>${cells.join('')}</body></html>`;
}
