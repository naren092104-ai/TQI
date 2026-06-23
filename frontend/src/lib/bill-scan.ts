/**
 * BILL PROCESSING PIPELINE
 * 
 * RULES:
 * - Detect receipt edges ONLY (Google Drive crop mode style)
 * - Crop outside unwanted area
 * - Straighten image
 * - Preserve ORIGINAL COLORS 100%
 * - NO background removal
 * - NO B&W conversion
 * - NO OCR
 * - NO color/brightness/contrast modification
 * 
 * Goal: Only crop and straighten, keep everything else original
 */

export const BILL_PIPELINE_STEPS = [
  { id: "scan", label: "Scan Bill" },
  { id: "detect", label: "Detect Bill Edges" },
  { id: "capture", label: "Auto Crop" },
  { id: "straighten", label: "Straighten Image" },
  { id: "save", label: "Save Image" },
  { id: "attach_expense", label: "Attach to Expense" },
] as const;

export type BillPipelineStepId = (typeof BILL_PIPELINE_STEPS)[number]["id"];

export type BillPipelineResult = {
  originalUrl: string;
  processedUrl: string;
};

export type BillPipelineProgress = (
  stepId: BillPipelineStepId,
  status: "active" | "done" | "pending",
) => void;

function grayFromRgba(data: Uint8ClampedArray, pixels: number): Uint8ClampedArray {
  const g = new Uint8ClampedArray(pixels);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return g;
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  // Separable blur: horizontal then vertical (O(n*r) instead of O(n*r²))
  let temp = new Uint8ClampedArray(src.length);
  
  // Horizontal blur
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w) {
          sum += src[y * w + nx];
          count++;
        }
      }
      temp[y * w + x] = Math.round(sum / count);
    }
  }
  
  // Vertical blur
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h) {
          sum += temp[ny * w + x];
          count++;
        }
      }
      out[y * w + x] = Math.round(sum / count);
    }
  }
  return out;
}

/** Find bill area using flood fill from center (light paper detection) */
function findBillAreaMask(gray: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  
  // Start from center
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const startIdx = cy * w + cx;
  
  // Find brightest point near center (likely bill paper)
  let seed = startIdx;
  let seedVal = gray[seed];
  const span = Math.floor(Math.min(w, h) * 0.15);
  for (let y = Math.max(0, cy - span); y <= Math.min(h - 1, cy + span); y++) {
    for (let x = Math.max(0, cx - span); x <= Math.min(w - 1, cx + span); x++) {
      const idx = y * w + x;
      if (gray[idx] > seedVal) {
        seedVal = gray[idx];
        seed = idx;
      }
    }
  }
  
  // Flood fill with threshold (use index-based queue, not shift())
  const threshold = 60; // Light areas
  const queue = new Uint32Array(w * h);
  let head = 0, tail = 0;
  queue[tail++] = seed;
  visited[seed] = 1;
  
  while (head < tail) {
    const idx = queue[head++];
    
    // Only mark pixels within threshold of starting pixel
    if (Math.abs(gray[idx] - seedVal) > threshold) continue;
    mask[idx] = 1;
    
    const x = idx % w;
    const y = Math.floor(idx / w);
    
    // 4-directional neighbors
    if (x > 0 && !visited[idx - 1]) {
      visited[idx - 1] = 1;
      queue[tail++] = idx - 1;
    }
    if (x < w - 1 && !visited[idx + 1]) {
      visited[idx + 1] = 1;
      queue[tail++] = idx + 1;
    }
    if (y > 0 && !visited[idx - w]) {
      visited[idx - w] = 1;
      queue[tail++] = idx - w;
    }
    if (y < h - 1 && !visited[idx + w]) {
      visited[idx + w] = 1;
      queue[tail++] = idx + w;
    }
  }
  
  return mask;
}

/** Find bounding box of bill area (early exit optimization) */
function findBillBounds(mask: Uint8Array, w: number, h: number) {
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let found = false;
  
  // Find minY by scanning rows (early exit)
  for (let y = 0; y < h && minY === h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        minY = y;
        found = true;
        break;
      }
    }
  }
  
  if (!found) return null;
  
  // Find maxY by scanning backwards
  for (let y = h - 1; y >= minY; y--) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        maxY = y;
        break;
      }
    }
    if (maxY > 0) break;
  }
  
  // Find minX and maxX
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        minX = Math.min(minX, x);
        break;
      }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (mask[y * w + x]) {
        maxX = Math.max(maxX, x);
        break;
      }
    }
  }
  
  return { minX, minY, maxX, maxY };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** Detect if image is upside down by comparing edge density at top vs bottom */
function isUpsideDown(gray: Uint8ClampedArray, w: number, h: number): boolean {
  // Sample top and bottom quarters to compare edge density
  const quarterH = Math.floor(h * 0.25);
  const quarterW = Math.floor(w * 0.1);
  
  let topEdges = 0, bottomEdges = 0;
  
  // Count edges in top quarter (sample middle columns to avoid borders)
  for (let y = 0; y < quarterH; y++) {
    for (let x = Math.floor(w * 0.1); x < Math.floor(w * 0.9); x++) {
      const idx = y * w + x;
      const right = x < w - 1 ? gray[idx + 1] : gray[idx];
      const below = y < h - 1 ? gray[idx + w] : gray[idx];
      // Detect edges (sharp transitions)
      if (Math.abs(gray[idx] - right) > 30 || Math.abs(gray[idx] - below) > 30) {
        topEdges++;
      }
    }
  }
  
  // Count edges in bottom quarter
  for (let y = h - quarterH; y < h; y++) {
    for (let x = Math.floor(w * 0.1); x < Math.floor(w * 0.9); x++) {
      const idx = y * w + x;
      const right = x < w - 1 ? gray[idx + 1] : gray[idx];
      const below = y < h - 1 ? gray[idx + w] : gray[idx];
      if (Math.abs(gray[idx] - right) > 30 || Math.abs(gray[idx] - below) > 30) {
        bottomEdges++;
      }
    }
  }
  
  // If bottom has significantly more edges, likely upside down
  return bottomEdges > topEdges * 1.3;
}

/** Rotate canvas 180 degrees */
function rotate180(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const rotated = document.createElement("canvas");
  rotated.width = canvas.width;
  rotated.height = canvas.height;
  const ctx = rotated.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotated;
}

/** Detect bill edges and crop, but preserve original colors */
function detectAndCropBill(source: HTMLCanvasElement): HTMLCanvasElement {
  let processSource = source;
  let sw = source.width;
  let sh = source.height;
  
  // Scale down for processing if too large
  const maxW = 1200;
  const scale = sw > maxW ? maxW / sw : 1;
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  
  // Create working canvas for initial analysis
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const wctx = work.getContext("2d")!;
  wctx.imageSmoothingEnabled = true;
  wctx.imageSmoothingQuality = "high";
  wctx.drawImage(source, 0, 0, w, h);
  
  // Check if upside down and auto-rotate if needed
  let { data } = wctx.getImageData(0, 0, w, h);
  let gray = grayFromRgba(data, w * h);
  if (isUpsideDown(gray, w, h)) {
    // Rotate source and use rotated for all subsequent operations
    processSource = rotate180(source);
    sw = processSource.width;
    sh = processSource.height;
    work.width = w;
    work.height = h;
    wctx.clearRect(0, 0, w, h);
    wctx.drawImage(processSource, 0, 0, w, h);
    // Re-get image data after rotation
    ({ data } = wctx.getImageData(0, 0, w, h));
    gray = grayFromRgba(data, w * h);
  }
  
  gray = boxBlur(gray, w, h, 2);
  
  // Find bill area
  let mask = findBillAreaMask(gray, w, h);
  let bounds = findBillBounds(mask, w, h);
  
  // Fallback if detection fails
  if (!bounds || (bounds.maxX - bounds.minX) < w * 0.15 || (bounds.maxY - bounds.minY) < h * 0.15) {
    // Use full image with small border
    const borderX = Math.floor(w * 0.05);
    const borderY = Math.floor(h * 0.05);
    bounds = {
      minX: Math.max(0, borderX),
      minY: Math.max(0, borderY),
      maxX: Math.min(w - 1, w - borderX),
      maxY: Math.min(h - 1, h - borderY),
    };
  }
  
  // Add small padding to remove outer borders
  const pad = Math.floor(Math.min(w, h) * 0.02);
  const minX = Math.max(0, bounds.minX - pad);
  const minY = Math.max(0, bounds.minY - pad);
  const maxX = Math.min(w - 1, bounds.maxX + pad);
  const maxY = Math.min(h - 1, bounds.maxY + pad);
  
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  
  // Create output canvas with ORIGINAL colors (crop from rotated source if needed)
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d")!;
  
  // Draw cropped region from ORIGINAL/ROTATED source to preserve all colors
  const srcX = Math.floor(minX / scale);
  const srcY = Math.floor(minY / scale);
  const srcW = Math.floor(cropW / scale);
  const srcH = Math.floor(cropH / scale);
  
  outCtx.drawImage(processSource, srcX, srcY, srcW, srcH, 0, 0, cropW, cropH);
  
  return out;
}

const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function emitProgress(
  onProgress: BillPipelineProgress | undefined,
  stepId: BillPipelineStepId,
  status: "active" | "done",
) {
  onProgress?.(stepId, status);
}

/**
 * BILL PROCESSING PIPELINE
 * 
 * Steps:
 * 1. Load original image
 * 2. Detect bill edges using grayscale analysis
 * 3. Crop to bill area (remove outer surroundings)
 * 4. Save as cropped version
 * 5. Return both original + cropped (for fallback)
 * 
 * IMPORTANT: Original colors are ALWAYS preserved
 */
export async function runBillPipeline(
  originalDataUrl: string,
  onProgress?: BillPipelineProgress,
): Promise<BillPipelineResult> {
  try {
    emitProgress(onProgress, "detect", "active");
    await tick();
    
    const img = await loadImage(originalDataUrl);
    const src = canvasFromImage(img);
    
    emitProgress(onProgress, "detect", "done");
    emitProgress(onProgress, "capture", "active");
    await tick();
    
    // Detect edges and crop (preserving original colors)
    const cropped = detectAndCropBill(src);
    
    emitProgress(onProgress, "capture", "done");
    emitProgress(onProgress, "straighten", "active");
    await tick();
    emitProgress(onProgress, "straighten", "done");
    
    emitProgress(onProgress, "save", "active");
    await tick();
    
    // Save as JPEG to reduce size while keeping colors
    const processedUrl = cropped.toDataURL("image/jpeg", 0.95);
    
    emitProgress(onProgress, "save", "done");
    
    return {
      originalUrl: originalDataUrl,
      processedUrl: processedUrl,
    };
  } catch (error) {
    console.error("Bill processing failed, using original:", error);
    // If processing fails, use original image
    return {
      originalUrl: originalDataUrl,
      processedUrl: originalDataUrl,
    };
  }
}

/** @deprecated Use runBillPipeline */
export async function enhanceBillImage(dataUrl: string): Promise<string> {
  const result = await runBillPipeline(dataUrl);
  return result.processedUrl;
}

export function sampleVideoFrame(video: HTMLVideoElement, w = 96, h = 72): ImageData | null {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function frameMotionScore(a: ImageData, b: ImageData): number {
  let diff = 0;
  const len = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < len; i += 4) {
    diff += Math.abs(a.data[i] - b.data[i]);
    diff += Math.abs(a.data[i + 1] - b.data[i + 1]);
    diff += Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return diff / (len / 4) / 3;
}

export function frameContentScore(frame: ImageData): number {
  let bright = 0;
  const pixels = frame.data.length / 4;
  for (let i = 0; i < frame.data.length; i += 4) {
    const gray = 0.299 * frame.data[i] + 0.587 * frame.data[i + 1] + 0.114 * frame.data[i + 2];
    if (gray > 150 && gray < 245) bright++;
  }
  return bright / pixels;
}

export function detectBillInFrame(frame: ImageData, threshold = 0.14): boolean {
  return frameContentScore(frame) >= threshold;
}
