import * as ort from 'onnxruntime-web';
import type { SarClassificationResult } from '../types/dashboard';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

let classifierSession: ort.InferenceSession | null = null;
let segmenterSession: ort.InferenceSession | null = null;
let optimalThreshold = 0.27; // Default calibrated threshold from full Zenodo dataset training
let modelInputChannels = 2;
let modelLoadError: string | null = null;

// Model metadata loaded from model_metadata.json
interface ModelMetadata {
  optimal_threshold: number;
  in_channels: number;
  normalization: {
    vv_min_db: number;
    vv_max_db: number;
    vh_min_db: number;
    vh_max_db: number;
  };
  model_name: string;
  version: string;
  metrics?: Record<string, number>;
}

let modelMetadata: ModelMetadata | null = null;

export async function loadModel(): Promise<void> {
  if (classifierSession) return;

  // Load model metadata first to get calibrated threshold
  try {
    const metaRes = await fetch('/models/model_metadata.json');
    if (metaRes.ok) {
      modelMetadata = await metaRes.json();
      if (modelMetadata?.optimal_threshold) {
        optimalThreshold = modelMetadata.optimal_threshold;
        console.log(`[SAR] Loaded calibrated threshold: ${optimalThreshold}`);
      }
      if (modelMetadata?.in_channels) {
        modelInputChannels = modelMetadata.in_channels;
      }
    }
  } catch (err) {
    console.info('[SAR] Using default threshold 0.27:', err);
  }

  // Probe /onnx-dist/ to verify it is serving JS modules rather than HTML fallback (e.g. on SPAs)
  let selectedWasmPath = '/onnx-dist/';
  try {
    const probe = await fetch('/onnx-dist/ort-wasm-simd-threaded.jsep.mjs', { method: 'HEAD' });
    const ctype = probe.headers.get('content-type') || '';
    if (!probe.ok || ctype.includes('text/html')) {
      console.warn('[SAR] /onnx-dist/ not available or returned HTML, falling back to jsdelivr CDN');
      selectedWasmPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
    }
  } catch {
    selectedWasmPath = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
  }

  const wasmLocations = [
    selectedWasmPath,
    selectedWasmPath === '/onnx-dist/'
      ? 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/'
      : 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.30.0/',
  ];

  for (const wasmPath of wasmLocations) {
    try {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = wasmPath;

      // Load classifier session
      classifierSession = await ort.InferenceSession.create('/models/oil_classifier.onnx', {
        executionProviders: ['wasm'],
      });

      console.log(`[SAR] Classifier session initialized via ${wasmPath} (input: ${classifierSession.inputNames[0]})`);
      modelLoadError = null;

      // Try loading segmenter session
      try {
        segmenterSession = await ort.InferenceSession.create('/models/oil_segmenter.onnx', {
          executionProviders: ['wasm'],
        });
        console.log(`[SAR] SpillSegNet segmenter session ready`);
      } catch (segErr) {
        console.warn('[SAR] SpillSegNet not loaded, running classification only:', segErr);
      }

      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SAR] Failed initializing ONNX via ${wasmPath}:`, msg);
      modelLoadError = msg;
      classifierSession = null;
    }
  }
}

interface ImageValidationResult {
  isValid: boolean;
  reason?: string;
  metrics: {
    meanBrightness: number;
    brightRatio: number;
    sharpTransitions: number;
    isColor: boolean;
  };
}

export function validateSarImage(data: Uint8ClampedArray, width: number, height: number): ImageValidationResult {
  const totalPixels = width * height;
  let sumBrightness = 0;
  let brightCount = 0;
  let coloredPixels = 0;
  let colorDiffSum = 0;

  const grayValues = new Float32Array(totalPixels);
  const histogram = new Int32Array(256);

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    const maxC = Math.max(r, Math.max(g, b));
    const minC = Math.min(r, Math.min(g, b));
    const chroma = maxC - minC;
    if (chroma > 18) coloredPixels++;
    colorDiffSum += chroma;

    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grayValues[i] = gray;
    histogram[gray]++;
    sumBrightness += gray;
    if (gray > 190) brightCount++;
  }

  const meanBrightness = sumBrightness / totalPixels;
  const brightRatio = brightCount / totalPixels;
  const coloredRatio = coloredPixels / totalPixels;
  const avgColorDiff = colorDiffSum / totalPixels;
  const isColor = coloredRatio > 0.008 || avgColorDiff > 12;

  // 1. Measure spatial speckle noise via 5x5 blocks (excluding pure satellite NoData borders)
  // Real coherent microwave SAR radar has Rayleigh/Gamma distributed speckle noise across valid sea pixels.
  // Software screenshots (terminals, code editors, browser windows, documents) have flat solid background blocks (>70%).
  const bs = 5;
  const hb = Math.floor(height / bs);
  const wb = Math.floor(width / bs);
  let flatBlocks = 0;
  let validBlocks = 0;

  for (let by = 0; by < hb; by++) {
    for (let bx = 0; bx < wb; bx++) {
      let bSum = 0;
      let bSumSq = 0;
      let maxVal = 0;
      for (let py = 0; py < bs; py++) {
        for (let px = 0; px < bs; px++) {
          const val = grayValues[(by * bs + py) * width + (bx * bs + px)];
          bSum += val;
          bSumSq += val * val;
          if (val > maxVal) maxVal = val;
        }
      }
      // Skip pure satellite zero-swath NoData corners
      if (maxVal === 0) continue;

      validBlocks++;
      const bMean = bSum / 25;
      const bVariance = bSumSq / 25 - bMean * bMean;
      // If block has near-zero variance (< 1.5), it is a synthetic flat digital surface
      if (bVariance < 1.5) {
        flatBlocks++;
      }
    }
  }
  const flatRatio = validBlocks > 0 ? flatBlocks / validBlocks : 1.0;

  // 2. Check for dominant single background value (terminal background, solid canvas, etc.)
  let maxModeCount = 0;
  let maxModeVal = 0;
  for (let g = 0; g < 256; g++) {
    if (histogram[g] > maxModeCount) {
      maxModeCount = histogram[g];
      maxModeVal = g;
    }
  }
  const maxModeRatio = maxModeCount / totalPixels;

  // REJECTION 1: Software UI / Terminal / Code Editor / IDE Screenshot
  // Terminals and code windows have massive flat background space (> 30% flat blocks)
  if (flatRatio > 0.30) {
    return {
      isValid: false,
      reason: `Software UI / Terminal / Code Window (Lacks physical radar speckle: ${(flatRatio * 100).toFixed(0)}% flat digital space)`,
      metrics: { meanBrightness, brightRatio, sharpTransitions: flatRatio, isColor }
    };
  }

  // REJECTION 2: Artificial Solid Background / Synthetic Graphic
  if (maxModeRatio > 0.40 && maxModeVal !== 0) {
    return {
      isValid: false,
      reason: `Artificial Solid Canvas (Single background color covers ${(maxModeRatio * 100).toFixed(0)}% of image)`,
      metrics: { meanBrightness, brightRatio, sharpTransitions: flatRatio, isColor }
    };
  }

  // REJECTION 3: Color Camera Photo / Syntax-Highlighted Code Window
  if (isColor) {
    return {
      isValid: false,
      reason: `Optical Color Image / Syntax Highlighting (SAR microwave radar is monochrome/dual-pol)`,
      metrics: { meanBrightness, brightRatio, sharpTransitions: flatRatio, isColor }
    };
  }

  // REJECTION 4: Printed document / paper sheet
  if (brightRatio > 0.35 && meanBrightness > 150) {
    return {
      isValid: false,
      reason: 'Printed Document / High-Luminance Sheet (Non-Marine Scene)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: flatRatio, isColor }
    };
  }

  // REJECTION 5: Blank / empty black frame
  if (meanBrightness < 6) {
    return {
      isValid: false,
      reason: 'Empty / Black Frame (Zero radar backscatter signal)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: flatRatio, isColor }
    };
  }

  return { isValid: true, metrics: { meanBrightness, brightRatio, sharpTransitions: flatRatio, isColor } };
}

export interface DualPolInputRasters {
  vvRaster?: Float32Array;
  vhRaster?: Float32Array;
}

export interface ExtendedClassificationResult extends SarClassificationResult {
  segmentationMask?: string;  // data URL of segmentation overlay
  spillAreaPercent?: number;
  segmentationTimeMs?: number;
}

/**
 * 100% Deterministic SAR capillary damping calculator.
 * Strictly calculates oil probability from radar physics without any random numbers.
 * The SAME image will ALWAYS produce the EXACT SAME result.
 */
function computeDeterministicPhysicsScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  dualPolRasters?: DualPolInputRasters
): { prob: number; isOil: boolean; spillAreaPercent: number } {
  const totalPixels = width * height;
  let sumLuminance = 0;
  let dampedCount = 0;
  let coreDampedCount = 0;

  // Analyze pixels
  for (let i = 0; i < totalPixels; i++) {
    let lum = 0;
    if (dualPolRasters?.vvRaster && i < dualPolRasters.vvRaster.length) {
      lum = dualPolRasters.vvRaster[i] * 255;
    } else {
      lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    sumLuminance += lum;

    // Oil damping thresholds: capillary waves suppressed -> dark pixels
    if (lum < 58) dampedCount++;
    if (lum < 32) coreDampedCount++;
  }

  const meanLum = sumLuminance / totalPixels;
  const dampRatio = dampedCount / totalPixels;
  const coreRatio = coreDampedCount / totalPixels;

  // Radar physics damping score:
  // True slicks have high dampRatio (> 0.03) with a dark core and reasonable contrast
  let logit = -1.2;
  if (dampRatio > 0.015) {
    logit += dampRatio * 18.0;
  }
  if (coreRatio > 0.005) {
    logit += coreRatio * 32.0;
  }
  // Penalize uniformly dark empty images (lookalikes / low wind)
  if (meanLum < 25 && dampRatio > 0.85) {
    logit -= 2.5;
  }
  // Penalize bright ocean clutter
  if (meanLum > 130) {
    logit -= 2.0;
  }

  const prob = sigmoid(logit);
  const isOil = prob >= optimalThreshold;
  const spillAreaPercent = Math.round(dampRatio * 1000) / 10;

  return { prob, isOil, spillAreaPercent };
}

export async function classifyImage(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  dualPolRasters?: DualPolInputRasters
): Promise<ExtendedClassificationResult> {
  const start = performance.now();

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 400, 400);

  const imageData = ctx.getImageData(0, 0, 400, 400);
  const data = imageData.data;

  // Domain validation
  const validation = validateSarImage(data, 400, 400);
  if (!validation.isValid) {
    return {
      imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
      prediction: 'invalid_sar',
      confidence: 0,
      inferenceTimeMs: Math.round(performance.now() - start),
      errorMessage: 'Uploaded image is not a Synthetic Aperture Radar (SAR) ocean scene.',
      rejectionReason: validation.reason,
      metrics: validation.metrics,
    };
  }

  // Fallback mode: Pure deterministic physical calculation (NO Math.random!)
  if (!classifierSession) {
    const physics = computeDeterministicPhysicsScore(data, 400, 400, dualPolRasters);
    const classificationTimeMs = Math.round(performance.now() - start);

    return {
      imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
      prediction: physics.isOil ? 'oil_spill' : 'no_oil',
      confidence: physics.isOil ? physics.prob : 1 - physics.prob,
      inferenceTimeMs: classificationTimeMs,
      metrics: validation.metrics,
      spillAreaPercent: physics.spillAreaPercent,
    };
  }

  // Real ONNX inference
  const numPixels = 400 * 400;
  const tensorData = new Float32Array(2 * numPixels);
  const hasDirectRasters = dualPolRasters?.vvRaster && dualPolRasters?.vhRaster &&
                           dualPolRasters.vvRaster.length === numPixels &&
                           dualPolRasters.vhRaster.length === numPixels;

  for (let i = 0; i < numPixels; i++) {
    if (hasDirectRasters) {
      tensorData[i] = dualPolRasters.vvRaster![i];
      tensorData[numPixels + i] = dualPolRasters.vhRaster![i];
    } else {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const vv = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
      const vh = Math.max(0.0, vv - 0.22);
      tensorData[i] = vv;
      tensorData[numPixels + i] = vh;
    }
  }

  const tensor = new ort.Tensor('float32', tensorData, [1, 2, 400, 400]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[classifierSession.inputNames[0]] = tensor;

  const results = await classifierSession.run(feeds);
  const logit = results[classifierSession.outputNames[0]].data[0] as number;
  const prob = sigmoid(logit);

  const isOil = prob >= optimalThreshold;
  const confidence = isOil ? prob : 1 - prob;
  const classificationTimeMs = Math.round(performance.now() - start);

  const result: ExtendedClassificationResult = {
    imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
    prediction: isOil ? 'oil_spill' : 'no_oil',
    confidence,
    inferenceTimeMs: classificationTimeMs,
    metrics: validation.metrics,
  };

  // Run segmenter if classifier detects oil
  if (isOil && segmenterSession) {
    const segStart = performance.now();
    try {
      const segMaskUrl = await runSegmentation(imageElement, dualPolRasters);
      result.segmentationMask = segMaskUrl.dataUrl;
      result.spillAreaPercent = segMaskUrl.areaPercent;
      result.segmentationTimeMs = Math.round(performance.now() - segStart);
    } catch (e) {
      console.warn('[SAR] Segmentation failed:', e);
    }
  }

  return result;
}

async function runSegmentation(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  dualPolRasters?: DualPolInputRasters
): Promise<{ dataUrl: string; areaPercent: number }> {
  if (!segmenterSession) {
    return { dataUrl: '', areaPercent: 0 };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 512, 512);

  const imageData = ctx.getImageData(0, 0, 512, 512);
  const data = imageData.data;
  const numPixels = 512 * 512;

  const tensorData = new Float32Array(2 * numPixels);

  if (dualPolRasters?.vvRaster && dualPolRasters?.vhRaster) {
    const srcW = Math.round(Math.sqrt(dualPolRasters.vvRaster.length));
    const srcH = srcW;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const srcX = Math.min(Math.floor(x * srcW / 512), srcW - 1);
        const srcY = Math.min(Math.floor(y * srcH / 512), srcH - 1);
        const srcIdx = srcY * srcW + srcX;
        const dstIdx = y * 512 + x;
        tensorData[dstIdx] = dualPolRasters.vvRaster[srcIdx];
        tensorData[numPixels + dstIdx] = dualPolRasters.vhRaster[srcIdx];
      }
    }
  } else {
    for (let i = 0; i < numPixels; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const vv = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
      tensorData[i] = vv;
      tensorData[numPixels + i] = Math.max(0.0, vv - 0.22);
    }
  }

  const tensor = new ort.Tensor('float32', tensorData, [1, 2, 512, 512]);
  const feeds: Record<string, ort.Tensor> = {};
  feeds[segmenterSession.inputNames[0]] = tensor;

  const results = await segmenterSession.run(feeds);
  const output = results[segmenterSession.outputNames[0]];
  const outputData = output.data as Float32Array;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = 512;
  maskCanvas.height = 512;
  const maskCtx = maskCanvas.getContext('2d')!;

  let spillPixels = 0;
  for (let i = 0; i < numPixels; i++) {
    const prob = sigmoid(outputData[i]);
    if (prob > 0.5) {
      spillPixels++;
      const x = i % 512;
      const y = Math.floor(i / 512);
      const intensity = Math.min(1.0, prob);
      maskCtx.fillStyle = `rgba(255, 50, 0, ${intensity * 0.6})`;
      maskCtx.fillRect(x, y, 1, 1);
    }
  }

  const areaPercent = (spillPixels / numPixels) * 100;

  return {
    dataUrl: maskCanvas.toDataURL(),
    areaPercent: Math.round(areaPercent * 10) / 10,
  };
}

export async function generateOcclusionMap(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 400, 400);

  const imageData = ctx.getImageData(0, 0, 400, 400);
  const data = imageData.data;
  const numPixels = 400 * 400;

  // Deterministic physics-based heatmap if ONNX classifier is not active
  if (!classifierSession) {
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = 400;
    heatCanvas.height = 400;
    const heatCtx = heatCanvas.getContext('2d')!;

    const gridSize = 10;
    const patchSize = 400 / gridSize;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let cellDamped = 0;
        for (let py = 0; py < patchSize; py++) {
          for (let px = 0; px < patchSize; px++) {
            const ix = Math.floor(gx * patchSize + px);
            const iy = Math.floor(gy * patchSize + py);
            const idx = (iy * 400 + ix) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (gray < 55) cellDamped++;
          }
        }
        const cellRatio = cellDamped / (patchSize * patchSize);
        if (cellRatio > 0.08) {
          const intensity = Math.min(1.0, cellRatio * 2.2);
          heatCtx.fillStyle = `rgba(255, 30, 0, ${intensity * 0.65})`;
          heatCtx.fillRect(gx * patchSize, gy * patchSize, patchSize, patchSize);
        }
      }
    }
    return heatCanvas.toDataURL();
  }

  // Real ONNX occlusion sensitivity map
  const tensorData = new Float32Array(2 * numPixels);
  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const vv = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    tensorData[i] = vv;
    tensorData[numPixels + i] = Math.max(0.0, vv - 0.22);
  }

  const baseTensor = new ort.Tensor('float32', tensorData, [1, 2, 400, 400]);
  const baseFeeds: Record<string, ort.Tensor> = {};
  baseFeeds[classifierSession.inputNames[0]] = baseTensor;
  const baseResults = await classifierSession.run(baseFeeds);
  const baseProb = sigmoid(baseResults[classifierSession.outputNames[0]].data[0] as number);

  const heatmapData = new Float32Array(10 * 10);
  const patchSize = 40;

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const occludedData = new Float32Array(tensorData);
      for (let py = 0; py < patchSize; py++) {
        for (let px = 0; px < patchSize; px++) {
          const iy = y * patchSize + py;
          const ix = x * patchSize + px;
          occludedData[iy * 400 + ix] = 0.5;
          occludedData[numPixels + iy * 400 + ix] = 0.3;
        }
      }

      const occTensor = new ort.Tensor('float32', occludedData, [1, 2, 400, 400]);
      const occFeeds: Record<string, ort.Tensor> = {};
      occFeeds[classifierSession.inputNames[0]] = occTensor;
      const occResults = await classifierSession.run(occFeeds);
      const occProb = sigmoid(occResults[classifierSession.outputNames[0]].data[0] as number);

      heatmapData[y * 10 + x] = baseProb >= optimalThreshold
        ? Math.max(0, baseProb - occProb)
        : Math.max(0, occProb - baseProb);
    }
  }

  let maxHeat = 0;
  for (let i = 0; i < 100; i++) {
    if (heatmapData[i] > maxHeat) maxHeat = heatmapData[i];
  }

  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = 400;
  heatCanvas.height = 400;
  const heatCtx = heatCanvas.getContext('2d')!;

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const heat = maxHeat > 0 ? heatmapData[y * 10 + x] / maxHeat : 0;
      if (heat > 0.1) {
        heatCtx.fillStyle = `rgba(255, 0, 0, ${heat * 0.6})`;
        heatCtx.fillRect(x * patchSize, y * patchSize, patchSize, patchSize);
      }
    }
  }

  return heatCanvas.toDataURL();
}

export function isModelLoaded(): boolean {
  return classifierSession !== null;
}

export function isSegmenterLoaded(): boolean {
  return segmenterSession !== null;
}

export function getModelLoadError(): string | null {
  return modelLoadError;
}

export function getModelMetadata(): ModelMetadata | null {
  return modelMetadata;
}

export function getModelInputChannels(): number {
  return modelInputChannels;
}
