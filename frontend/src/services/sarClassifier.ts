import * as ort from 'onnxruntime-web';
import type { SarClassificationResult } from '../types/dashboard';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

let classifierSession: ort.InferenceSession | null = null;
let segmenterSession: ort.InferenceSession | null = null;
let optimalThreshold = 0.50;
let modelInputChannels = 2;

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
  if (!classifierSession) {
    try {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/';

      // Load classifier
      classifierSession = await ort.InferenceSession.create('/models/oil_classifier.onnx', {
        executionProviders: ['wasm'],
      });

      // Load model metadata
      try {
        const metaRes = await fetch('/models/model_metadata.json');
        if (metaRes.ok) {
          modelMetadata = await metaRes.json();
          if (modelMetadata?.optimal_threshold) {
            optimalThreshold = modelMetadata.optimal_threshold;
            console.log(`[SAR] Loaded threshold: ${optimalThreshold}`);
          }
          if (modelMetadata?.in_channels) {
            modelInputChannels = modelMetadata.in_channels;
          }
        }
      } catch {
        console.info('[SAR] Using default threshold 0.50');
      }

      console.log(`[SAR] Classifier ready (input: ${classifierSession.inputNames[0]})`);

      // Try loading segmenter
      try {
        segmenterSession = await ort.InferenceSession.create('/models/oil_segmenter.onnx', {
          executionProviders: ['wasm'],
        });
        console.log(`[SAR] Segmenter ready`);
      } catch {
        console.info('[SAR] Segmenter not available, classification only');
      }

    } catch (e) {
      console.warn('Could not load ONNX model. Falling back to demo mode.', e);
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
  let colorDiffSum = 0;

  const grayValues = new Float32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    colorDiffSum += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    grayValues[i] = gray;
    sumBrightness += gray;
    if (gray > 190) brightCount++;
  }

  const meanBrightness = sumBrightness / totalPixels;
  const brightRatio = brightCount / totalPixels;
  const avgColorDiff = colorDiffSum / totalPixels;
  const isColor = avgColorDiff > 28;

  let sharpTransitions = 0;
  const stride = 3;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width - stride; x++) {
      if (Math.abs(grayValues[rowOffset + x + stride] - grayValues[rowOffset + x]) > 85) {
        sharpTransitions++;
      }
    }
  }
  const transitionRatio = sharpTransitions / totalPixels;

  if (brightRatio > 0.30 && transitionRatio > 0.02) {
    return {
      isValid: false,
      reason: 'Paper Document / Printed Invoice (Non-Marine Scene)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }

  if (brightRatio > 0.50 && meanBrightness > 160) {
    return {
      isValid: false,
      reason: 'High-Luminance Non-Marine Surface (White paper/document)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }

  if (meanBrightness < 8) {
    return {
      isValid: false,
      reason: 'Empty / Black Frame (Zero radar backscatter signal)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }

  if (isColor && avgColorDiff > 45) {
    return {
      isValid: false,
      reason: 'Optical Color Camera Photo (SAR models require microwave radar imagery)',
      metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor }
    };
  }

  return { isValid: true, metrics: { meanBrightness, brightRatio, sharpTransitions: transitionRatio, isColor } };
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

  // Demo mode fallback
  if (!classifierSession) {
    await new Promise(r => setTimeout(r, 600));
    const prob = Math.random();
    const isOil = prob >= optimalThreshold;
    return {
      imageFile: imageElement instanceof HTMLImageElement ? imageElement.src : 'canvas',
      prediction: isOil ? 'oil_spill' : 'no_oil',
      confidence: isOil ? prob : 1 - prob,
      inferenceTimeMs: Math.round(performance.now() - start),
      metrics: validation.metrics,
    };
  }

  // Build 2-channel tensor [1, 2, 400, 400]
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

  // Run segmenter ONLY if classifier detects oil
  if (isOil && segmenterSession) {
    const segStart = performance.now();

    try {
      // Use tiled 512x512 inference on the original image
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

  // Resize to 512x512 for segmentation
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 512, 512);

  const imageData = ctx.getImageData(0, 0, 512, 512);
  const data = imageData.data;
  const numPixels = 512 * 512;

  const tensorData = new Float32Array(2 * numPixels);

  // If we have dual-pol rasters, resize them
  if (dualPolRasters?.vvRaster && dualPolRasters?.vhRaster) {
    // Simple nearest-neighbor resize from original to 512x512
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

  // Create mask overlay
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

  // Draw spill boundary
  maskCtx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
  maskCtx.lineWidth = 1;

  const areaPercent = (spillPixels / numPixels) * 100;

  return {
    dataUrl: maskCanvas.toDataURL(),
    areaPercent: Math.round(areaPercent * 10) / 10,
  };
}

export async function generateOcclusionMap(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<string> {
  if (!classifierSession) {
    await new Promise(r => setTimeout(r, 800));
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(100, 100, 200, 200);
    return canvas.toDataURL();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageElement, 0, 0, 400, 400);

  const imageData = ctx.getImageData(0, 0, 400, 400);
  const data = imageData.data;
  const numPixels = 400 * 400;

  const tensorData = new Float32Array(2 * numPixels);
  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const vv = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    tensorData[i] = vv;
    tensorData[numPixels + i] = Math.max(0.0, vv - 0.22);
  }

  // Baseline
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

export function getModelMetadata(): ModelMetadata | null {
  return modelMetadata;
}
