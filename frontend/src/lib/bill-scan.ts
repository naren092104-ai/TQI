/**
 * TQI Bill Scanner — Google Drive style receipt detection
 * 
 * Uses Canny-like edge detection + contour finding to locate the largest
 * rectangular document (receipt) and applies perspective correction.
 * Original colors preserved at full quality.
 */

export const BILL_PIPELINE_STEPS = [
  { id: "scan",           label: "Capture Frame" },
  { id: "detect",         label: "Detect Receipt Edges" },
  { id: "capture",        label: "Crop & Straighten" },
  { id: "straighten",     label: "Perspective Correction" },
  { id: "save",           label: "Save Image" },
  { id: "attach_expense", label: "Attach to Entry" },
] as const;

export type BillPipelineStepId = (typeof BILL_PIPELINE_STEPS)[number]["id"];
export type BillPipelineResult  = { originalUrl: string; processedUrl: string };
export type BillPipelineProgress = (id: BillPipelineStepId, s: "active" | "done" | "pending") => void;

// ── Low-level image helpers ──────────────────────────────────────────────────

function toGray(data: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

function gaussianBlur(src: Float32Array, w: number, h: number): Float32Array {
  // 5×5 Gaussian kernel σ≈1.4
  const K = [0.0625, 0.25, 0.375, 0.25, 0.0625];
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) {
        const nx = Math.max(0, Math.min(w - 1, x + k));
        s += K[k + 2] * src[y * w + nx];
      }
      tmp[y * w + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) {
        const ny = Math.max(0, Math.min(h - 1, y + k));
        s += K[k + 2] * tmp[ny * w + x];
      }
      out[y * w + x] = s;
    }
  }
  return out;
}

/** Canny-style edge detection (simplified: Sobel + double threshold) */
function cannyEdge(gray: Float32Array, w: number, h: number, lo = 30, hi = 80): Uint8Array {
  const edges = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
        - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
        - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
      const gy =
        gray[(y - 1) * w + (x - 1)] + 2 * gray[(y - 1) * w + x] + gray[(y - 1) * w + (x + 1)]
        - gray[(y + 1) * w + (x - 1)] - 2 * gray[(y + 1) * w + x] - gray[(y + 1) * w + (x + 1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * w + x] = mag > hi ? 2 : mag > lo ? 1 : 0;
    }
  }
  // Hysteresis: keep weak edges connected to strong
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (edges[y * w + x] !== 1) continue;
      const neighbors = [
        edges[(y - 1) * w + x], edges[(y + 1) * w + x],
        edges[y * w + (x - 1)], edges[y * w + (x + 1)],
        edges[(y - 1) * w + (x - 1)], edges[(y - 1) * w + (x + 1)],
        edges[(y + 1) * w + (x - 1)], edges[(y + 1) * w + (x + 1)],
      ];
      edges[y * w + x] = neighbors.some(n => n === 2) ? 2 : 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = edges[i] === 2 ? 255 : 0;
  return out;
}

/** Dilate edge map to connect gaps */
function dilate(src: Uint8Array, w: number, h: number, r = 2): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = false;
      outer: for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx; const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && src[ny * w + nx]) { on = true; break outer; }
        }
      }
      out[y * w + x] = on ? 255 : 0;
    }
  }
  return out;
}

// ── Contour / rectangle finding ──────────────────────────────────────────────

interface Pt { x: number; y: number; }
interface Rect { tl: Pt; tr: Pt; br: Pt; bl: Pt; area: number; }

/** Ramer-Douglas-Peucker simplification */
function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointLineDist(pts[i], a, b);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps), ...rdp(pts.slice(idx), eps).slice(1)];
}

function pointLineDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x; const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function contourArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

/** Simple connected-component contour tracing (Moore neighborhood) */
function traceContour(edges: Uint8Array, w: number, h: number): Pt[][] {
  const visited = new Uint8Array(w * h);
  const contours: Pt[][] = [];
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!edges[i] || visited[i]) continue;
      const pts: Pt[] = [];
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        const ci = cy * w + cx;
        if (visited[ci]) continue;
        visited[ci] = 1;
        pts.push({ x: cx, y: cy });
        for (const [dy, dx] of dirs) {
          const nx = cx + dx; const ny = cy + dy;
          if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && edges[ny * w + nx] && !visited[ny * w + nx]) {
            stack.push([nx, ny]);
          }
        }
      }
      if (pts.length > 40) contours.push(pts);
    }
  }
  return contours;
}

function orderCorners(pts: Pt[]): Rect | null {
  if (pts.length !== 4) return null;
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const [top1, top2] = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const [bot1, bot2] = sorted.slice(2).sort((a, b) => a.x - b.x);
  const area = contourArea(pts);
  return { tl: top1, tr: top2, bl: bot1, br: bot2, area };
}

/** Find the largest quadrilateral contour in the edge map */
function findDocumentQuad(edges: Uint8Array, w: number, h: number): Rect | null {
  const minArea = w * h * 0.08; // must cover ≥8% of image
  const contours = traceContour(edges, w, h);
  let best: Rect | null = null;

  for (const pts of contours) {
    if (pts.length < 40) continue;
    const simplified = rdp(pts, 8);
    if (simplified.length < 4 || simplified.length > 20) continue;

    // Try to find a 4-corner approximation
    for (let eps = 5; eps <= 50; eps += 5) {
      const approx = rdp(simplified, eps);
      if (approx.length !== 4) continue;
      const area = contourArea(approx);
      if (area < minArea) break;
      const rect = orderCorners(approx);
      if (rect && (!best || rect.area > best.area)) best = rect;
      break;
    }
  }
  return best;
}

// ── Perspective correction ───────────────────────────────────────────────────

function perspectiveTransform(src: HTMLCanvasElement, quad: Rect, scale: number): HTMLCanvasElement {
  // Scale corners back to original resolution
  const s = 1 / scale;
  const tl = { x: quad.tl.x * s, y: quad.tl.y * s };
  const tr = { x: quad.tr.x * s, y: quad.tr.y * s };
  const bl = { x: quad.bl.x * s, y: quad.bl.y * s };
  const br = { x: quad.br.x * s, y: quad.br.y * s };

  const dstW = Math.round(Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y)));
  const dstH = Math.round(Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y)));

  if (dstW < 50 || dstH < 50) return src;

  const dst = document.createElement("canvas");
  dst.width = dstW;
  dst.height = dstH;
  const ctx = dst.getContext("2d")!;

  // Bilinear sampling using inverse perspective
  // Solve for homography H such that src_pt = H * dst_pt
  const h = computeHomography(
    [tl, tr, br, bl],
    [{ x: 0, y: 0 }, { x: dstW, y: 0 }, { x: dstW, y: dstH }, { x: 0, y: dstH }]
  );
  if (!h) {
    // fallback: simple bounding box crop
    const minX = Math.min(tl.x, bl.x);
    const minY = Math.min(tl.y, tr.y);
    const maxX = Math.max(tr.x, br.x);
    const maxY = Math.max(bl.y, br.y);
    ctx.drawImage(src, minX, minY, maxX - minX, maxY - minY, 0, 0, dstW, dstH);
    return dst;
  }

  const srcData = src.getContext("2d")!.getImageData(0, 0, src.width, src.height).data;
  const dstImgData = ctx.createImageData(dstW, dstH);
  const dstData = dstImgData.data;

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      // Map dst pixel to src using inverse homography
      const denom = h[6] * dx + h[7] * dy + h[8];
      const sx = (h[0] * dx + h[1] * dy + h[2]) / denom;
      const sy = (h[3] * dx + h[4] * dy + h[5]) / denom;
      const ix = Math.round(sx); const iy = Math.round(sy);
      if (ix < 0 || ix >= src.width || iy < 0 || iy >= src.height) continue;
      const si = (iy * src.width + ix) * 4;
      const di = (dy * dstW + dx) * 4;
      dstData[di]     = srcData[si];
      dstData[di + 1] = srcData[si + 1];
      dstData[di + 2] = srcData[si + 2];
      dstData[di + 3] = 255;
    }
  }
  ctx.putImageData(dstImgData, 0, 0);
  return dst;
}

/** Compute 3×3 homography from 4 point correspondences (DLT method) */
function computeHomography(src: Pt[], dst: Pt[]): number[] | null {
  // Build 8×9 matrix A
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([-sx, -sy, -1, 0, 0, 0, dx * sx, dx * sy, dx]);
    A.push([0, 0, 0, -sx, -sy, -1, dy * sx, dy * sy, dy]);
  }
  // SVD via power iteration — simplified: use Gaussian elimination
  // For 4-point homography, we can solve the linear system directly
  try {
    const h = solveLinear8(A);
    return h ? [...h, 1] : null;
  } catch { return null; }
}

function solveLinear8(A: number[][]): number[] | null {
  // Gauss-Jordan elimination on 8×9 augmented matrix
  const M = A.map(row => [...row]);
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = -1;
    for (let row = col; row < M.length; row++) {
      if (Math.abs(M[row][col]) > 1e-10) { pivot = row; break; }
    }
    if (pivot === -1) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const scale = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= scale;
    for (let row = 0; row < M.length; row++) {
      if (row === col) continue;
      const f = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

// ── Auto-rotation ────────────────────────────────────────────────────────────

function autoRotate(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  // Receipts are portrait (taller than wide). If landscape, rotate 90°.
  if (w <= h) return canvas;
  const rot = document.createElement("canvas");
  rot.width = h; rot.height = w;
  const ctx = rot.getContext("2d")!;
  ctx.translate(h / 2, w / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -w / 2, -h / 2);
  return rot;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Load failed"));
    img.src = url;
  });
}

function imgToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return c;
}

const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
const emit = (fn: BillPipelineProgress | undefined, id: BillPipelineStepId, s: "active" | "done") => fn?.(id, s);

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:4000";

/** Try Python backend scanner — returns null if unavailable */
async function tryBackendScan(originalDataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/scan-bill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: originalDataUrl }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.processed) return data.processed as string;
    return null;
  } catch {
    return null;
  }
}

export async function runBillPipeline(
  originalDataUrl: string,
  onProgress?: BillPipelineProgress,
): Promise<BillPipelineResult> {
  try {
    emit(onProgress, "detect", "active");
    await tick();

    // ── Try Python backend first (best quality) ──
    const backendResult = await tryBackendScan(originalDataUrl);
    if (backendResult) {
      emit(onProgress, "detect", "done");
      emit(onProgress, "capture", "active");
      await tick();
      emit(onProgress, "capture", "done");
      emit(onProgress, "straighten", "active");
      await tick();
      emit(onProgress, "straighten", "done");
      emit(onProgress, "save", "active");
      await tick();
      emit(onProgress, "save", "done");
      return { originalUrl: originalDataUrl, processedUrl: backendResult };
    }

    // ── Fallback: browser-based processing ──
    const img = await loadImage(originalDataUrl);
    const src = imgToCanvas(img);
    const { width: W, height: H } = src;

    const maxD = 800;
    const scale = Math.min(1, maxD / Math.max(W, H));
    const sw = Math.round(W * scale);
    const sh = Math.round(H * scale);

    const small = document.createElement("canvas");
    small.width = sw; small.height = sh;
    small.getContext("2d")!.drawImage(src, 0, 0, sw, sh);
    const smallData = small.getContext("2d")!.getImageData(0, 0, sw, sh).data;

    let gray = toGray(smallData, sw * sh);
    gray = gaussianBlur(gray, sw, sh);
    let edges = cannyEdge(gray, sw, sh, 25, 70);
    edges = dilate(edges, sw, sh, 3);

    emit(onProgress, "detect", "done");
    emit(onProgress, "capture", "active");
    await tick();

    const quad = findDocumentQuad(edges, sw, sh);

    emit(onProgress, "capture", "done");
    emit(onProgress, "straighten", "active");
    await tick();

    let result: HTMLCanvasElement;
    if (quad && quad.area > sw * sh * 0.08) {
      result = perspectiveTransform(src, quad, scale);
    } else {
      result = brightCrop(src, gray, sw, sh, scale);
    }
    result = autoRotate(result);

    emit(onProgress, "straighten", "done");
    emit(onProgress, "save", "active");
    await tick();

    const processedUrl = result.toDataURL("image/jpeg", 0.97);
    emit(onProgress, "save", "done");

    return { originalUrl: originalDataUrl, processedUrl };
  } catch (err) {
    console.error("Bill pipeline error:", err);
    return { originalUrl: originalDataUrl, processedUrl: originalDataUrl };
  }
}

/** Fallback: crop to bright content bounding box */
function brightCrop(src: HTMLCanvasElement, gray: Float32Array, sw: number, sh: number, scale: number): HTMLCanvasElement {
  const W = src.width; const H = src.height;
  const threshold = 180;
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (gray[y * sw + x] >= threshold) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  const valid = (maxX - minX) > sw * 0.1 && (maxY - minY) > sh * 0.1;
  if (!valid) return src;

  const pad = Math.floor(Math.min(sw, sh) * 0.02);
  const sx = Math.max(0, Math.floor((minX - pad) / scale));
  const sy = Math.max(0, Math.floor((minY - pad) / scale));
  const ex = Math.min(W, Math.ceil((maxX + pad) / scale));
  const ey = Math.min(H, Math.ceil((maxY + pad) / scale));

  const out = document.createElement("canvas");
  out.width = ex - sx; out.height = ey - sy;
  out.getContext("2d")!.drawImage(src, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// ── Camera helpers ────────────────────────────────────────────────────────────

export function sampleVideoFrame(video: HTMLVideoElement, w = 96, h = 72): ImageData | null {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function frameMotionScore(a: ImageData, b: ImageData): number {
  let diff = 0;
  const len = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < len; i += 4) {
    diff += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return diff / (len / 4) / 3;
}

export function frameContentScore(frame: ImageData): number {
  let bright = 0;
  const pixels = frame.data.length / 4;
  for (let i = 0; i < frame.data.length; i += 4) {
    const g = 0.299 * frame.data[i] + 0.587 * frame.data[i + 1] + 0.114 * frame.data[i + 2];
    if (g > 150 && g < 245) bright++;
  }
  return bright / pixels;
}

export function detectBillInFrame(frame: ImageData, threshold = 0.14): boolean {
  return frameContentScore(frame) >= threshold;
}
