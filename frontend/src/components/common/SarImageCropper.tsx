import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CropBox } from '../../types/dashboard';
import { autoDetectCapillaryDampingROI, extractCroppedImageDataUrl } from '../../services/sarClassifier';

interface SarImageCropperProps {
  imageSrc: string;
  fileName?: string;
  onApplyCrop: (croppedDataUrl: string, cropBox: CropBox, isAuto: boolean) => void;
  onCancel: () => void;
  initialCropBox?: CropBox | null;
}

type DragMode = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' | null;

export const SarImageCropper: React.FC<SarImageCropperProps> = ({
  imageSrc,
  fileName = 'SAR Scene',
  onApplyCrop,
  onCancel,
  initialCropBox = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number; left: number; top: number }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });

  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, width: 400, height: 400 });
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(false);
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    startCrop: CropBox;
    mode: DragMode;
  }>({
    startX: 0,
    startY: 0,
    startCrop: { x: 0, y: 0, width: 400, height: 400 },
    mode: null,
  });

  // Load natural image dimensions and establish initial crop box
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      setImageDimensions({ width: origW, height: origH });

      if (initialCropBox && initialCropBox.width > 0 && initialCropBox.height > 0) {
        setCropBox(initialCropBox);
      } else {
        // Try auto-detecting capillary wave damping hotspot
        try {
          const detected = autoDetectCapillaryDampingROI(img);
          setCropBox(detected);
          setIsAutoDetected(true);
          setAutoDetectNotice('🎯 Auto-detected candidate oil slick ROI (capillary wave damping hotspot)');
        } catch {
          // Default center square
          const minDim = Math.min(origW, origH);
          const size = Math.round(minDim * 0.75);
          setCropBox({
            x: Math.round((origW - size) / 2),
            y: Math.round((origH - size) / 2),
            width: size,
            height: size,
          });
        }
      }
    };
    img.src = imageSrc;
  }, [imageSrc, initialCropBox]);

  // Update display dimensions when container or window resizes
  const updateDisplayDimensions = useCallback(() => {
    if (!containerRef.current || !imageDimensions) return;
    const cWidth = containerRef.current.clientWidth - 40;
    const cHeight = containerRef.current.clientHeight - 40;

    if (cWidth <= 0 || cHeight <= 0) return;

    const imgAspect = imageDimensions.width / imageDimensions.height;
    const containerAspect = cWidth / cHeight;

    let dispW = 0;
    let dispH = 0;

    if (imgAspect > containerAspect) {
      dispW = cWidth;
      dispH = cWidth / imgAspect;
    } else {
      dispH = cHeight;
      dispW = cHeight * imgAspect;
    }

    const dispLeft = Math.round((containerRef.current.clientWidth - dispW) / 2);
    const dispTop = Math.round((containerRef.current.clientHeight - dispH) / 2);

    setDisplayDimensions({
      width: dispW,
      height: dispH,
      left: dispLeft,
      top: dispTop,
    });
  }, [imageDimensions]);

  useEffect(() => {
    updateDisplayDimensions();
    window.addEventListener('resize', updateDisplayDimensions);
    return () => window.removeEventListener('resize', updateDisplayDimensions);
  }, [updateDisplayDimensions]);

  // Convert natural crop coordinates to display pixels
  const scale = imageDimensions && displayDimensions.width > 0
    ? displayDimensions.width / imageDimensions.width
    : 1;

  const boxDispX = Math.round(cropBox.x * scale);
  const boxDispY = Math.round(cropBox.y * scale);
  const boxDispW = Math.max(30, Math.round(cropBox.width * scale));
  const boxDispH = Math.max(30, Math.round(cropBox.height * scale));

  // Drag & Resize Handlers
  const handlePointerDown = (mode: DragMode, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropBox },
      mode,
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!dragStartRef.current.mode || !imageDimensions || scale <= 0) return;

      const deltaX = (moveEvt.clientX - dragStartRef.current.startX) / scale;
      const deltaY = (moveEvt.clientY - dragStartRef.current.startY) / scale;
      const { startCrop, mode: activeMode } = dragStartRef.current;
      const maxW = imageDimensions.width;
      const maxH = imageDimensions.height;
      const minBox = 64; // Minimum crop size in image pixels

      let newX = startCrop.x;
      let newY = startCrop.y;
      let newW = startCrop.width;
      let newH = startCrop.height;

      if (activeMode === 'move') {
        newX = Math.max(0, Math.min(maxW - newW, Math.round(startCrop.x + deltaX)));
        newY = Math.max(0, Math.min(maxH - newH, Math.round(startCrop.y + deltaY)));
      } else {
        if (lockAspectRatio) {
          // Uniform 1:1 square resize
          let sizeDelta = 0;
          if (activeMode === 'se') {
            sizeDelta = Math.max(deltaX, deltaY);
            newW = Math.max(minBox, Math.min(maxW - startCrop.x, maxH - startCrop.y, startCrop.width + sizeDelta));
            newH = newW;
          } else if (activeMode === 'nw') {
            sizeDelta = Math.min(deltaX, deltaY);
            const proposedSize = Math.max(minBox, startCrop.width - sizeDelta);
            const clampedSize = Math.min(proposedSize, startCrop.x + startCrop.width, startCrop.y + startCrop.height);
            newX = startCrop.x + startCrop.width - clampedSize;
            newY = startCrop.y + startCrop.height - clampedSize;
            newW = clampedSize;
            newH = clampedSize;
          } else if (activeMode === 'ne') {
            sizeDelta = Math.max(deltaX, -deltaY);
            const proposedSize = Math.max(minBox, Math.min(maxW - startCrop.x, startCrop.y + startCrop.height, startCrop.width + sizeDelta));
            newY = startCrop.y + startCrop.height - proposedSize;
            newW = proposedSize;
            newH = proposedSize;
          } else if (activeMode === 'sw') {
            sizeDelta = Math.max(-deltaX, deltaY);
            const proposedSize = Math.max(minBox, Math.min(startCrop.x + startCrop.width, maxH - startCrop.y, startCrop.width + sizeDelta));
            newX = startCrop.x + startCrop.width - proposedSize;
            newW = proposedSize;
            newH = proposedSize;
          } else if (activeMode === 'e' || activeMode === 's') {
            const delta = activeMode === 'e' ? deltaX : deltaY;
            newW = Math.max(minBox, Math.min(maxW - startCrop.x, maxH - startCrop.y, startCrop.width + delta));
            newH = newW;
          } else if (activeMode === 'w' || activeMode === 'n') {
            const delta = activeMode === 'w' ? -deltaX : -deltaY;
            const proposedSize = Math.max(minBox, Math.min(startCrop.x + startCrop.width, startCrop.y + startCrop.height, startCrop.width + delta));
            newX = startCrop.x + startCrop.width - proposedSize;
            newY = startCrop.y + startCrop.height - proposedSize;
            newW = proposedSize;
            newH = proposedSize;
          }
        } else {
          // Freeform resize
          if (activeMode.includes('e')) {
            newW = Math.max(minBox, Math.min(maxW - startCrop.x, startCrop.width + deltaX));
          }
          if (activeMode.includes('s')) {
            newH = Math.max(minBox, Math.min(maxH - startCrop.y, startCrop.height + deltaY));
          }
          if (activeMode.includes('w')) {
            const proposedW = Math.max(minBox, startCrop.width - deltaX);
            const clampedW = Math.min(proposedW, startCrop.x + startCrop.width);
            newX = startCrop.x + startCrop.width - clampedW;
            newW = clampedW;
          }
          if (activeMode.includes('n')) {
            const proposedH = Math.max(minBox, startCrop.height - deltaY);
            const clampedH = Math.min(proposedH, startCrop.y + startCrop.height);
            newY = startCrop.y + startCrop.height - clampedH;
            newH = clampedH;
          }
        }
      }

      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
      setIsAutoDetected(false);
    };

    const handlePointerUp = () => {
      dragStartRef.current.mode = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Preset Handlers
  const handleAutoDetectROI = () => {
    if (!imageRef.current) return;
    try {
      const detected = autoDetectCapillaryDampingROI(imageRef.current);
      setCropBox(detected);
      setIsAutoDetected(true);
      setAutoDetectNotice('🎯 Auto-detected candidate oil slick ROI (capillary wave damping hotspot)');
      setTimeout(() => setAutoDetectNotice(null), 4000);
    } catch (err) {
      console.warn('Auto-detection failed:', err);
    }
  };

  const handleCenterSquare = () => {
    if (!imageDimensions) return;
    const minDim = Math.min(imageDimensions.width, imageDimensions.height);
    const size = Math.round(minDim * 0.75);
    setCropBox({
      x: Math.round((imageDimensions.width - size) / 2),
      y: Math.round((imageDimensions.height - size) / 2),
      width: size,
      height: size,
    });
    setIsAutoDetected(false);
  };

  const handleFullFit = () => {
    if (!imageDimensions) return;
    const size = Math.min(imageDimensions.width, imageDimensions.height);
    setCropBox({
      x: Math.round((imageDimensions.width - size) / 2),
      y: Math.round((imageDimensions.height - size) / 2),
      width: size,
      height: size,
    });
    setIsAutoDetected(false);
  };

  const handleQuadrant = (quad: 'tl' | 'tr' | 'bl' | 'br' | 'c') => {
    if (!imageDimensions) return;
    const size = Math.round(Math.min(imageDimensions.width, imageDimensions.height) * 0.5);
    let qx = 0;
    let qy = 0;

    if (quad === 'tr') {
      qx = imageDimensions.width - size;
    } else if (quad === 'bl') {
      qy = imageDimensions.height - size;
    } else if (quad === 'br') {
      qx = imageDimensions.width - size;
      qy = imageDimensions.height - size;
    } else if (quad === 'c') {
      qx = Math.round((imageDimensions.width - size) / 2);
      qy = Math.round((imageDimensions.height - size) / 2);
    }

    setCropBox({ x: qx, y: qy, width: size, height: size });
    setIsAutoDetected(false);
  };

  const handleApply = () => {
    if (!imageRef.current) return;
    try {
      const croppedDataUrl = extractCroppedImageDataUrl(imageRef.current, cropBox, 800);
      onApplyCrop(croppedDataUrl, cropBox, isAutoDetected);
    } catch (err) {
      console.error('Failed to extract crop:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          background: 'var(--bg-surface)',
          borderRadius: 18,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 1. STUDIO HEADER */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-raised)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--accent)' }}>
                crop
              </span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                SAR Oil Spill ROI Cropper & Alignment Studio
              </h2>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  fontWeight: 700,
                }}
              >
                1:1 Model Compatible (400×400 / 512×512)
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Targeting: <strong style={{ color: 'var(--text-secondary)' }}>{fileName}</strong>
              {imageDimensions && (
                <span> · Natural Resolution: {imageDimensions.width} × {imageDimensions.height} px</span>
              )}
            </p>
          </div>

          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close Cropper (Esc)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
          </button>
        </div>

        {/* 2. PRESETS TOOLBAR */}
        <div
          style={{
            padding: '10px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            background: 'var(--bg-surface)',
          }}
        >
          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleAutoDetectROI}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                background: isAutoDetected ? 'var(--accent)' : 'rgba(37, 99, 235, 0.08)',
                color: isAutoDetected ? '#FFFFFF' : 'var(--accent)',
                border: '1px solid rgba(37, 99, 235, 0.35)',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Automatically scan image for capillary wave damping hotspot and snap crop box"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_fix_high</span>
              <span>🎯 Auto-Detect Slick ROI</span>
            </button>

            <button
              onClick={handleCenterSquare}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 11px',
                borderRadius: 8,
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Center a 1:1 square crop window"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>crop_square</span>
              <span>Center 1:1</span>
            </button>

            <button
              onClick={handleFullFit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 11px',
                borderRadius: 8,
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Fit maximum square dimension"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>aspect_ratio</span>
              <span>Max Fit</span>
            </button>

            {/* Quadrant Quick Jumps */}
            <div style={{ display: 'inline-flex', gap: 2, background: 'var(--bg-raised)', padding: 2, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              {(['tl', 'tr', 'c', 'bl', 'br'] as const).map((q) => {
                const labels: Record<string, string> = { tl: '↖ TL', tr: '↗ TR', c: '• C', bl: '↙ BL', br: '↘ BR' };
                return (
                  <button
                    key={q}
                    onClick={() => handleQuadrant(q)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 10.5,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title={`Jump to ${labels[q]} quadrant`}
                  >
                    {labels[q]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Lock Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lockAspectRatio}
                onChange={(e) => setLockAspectRatio(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <span>Lock 1:1 Aspect Ratio (Neural Net Optimal)</span>
            </label>
          </div>
        </div>

        {autoDetectNotice && (
          <div
            style={{
              padding: '6px 20px',
              background: 'rgba(16, 185, 129, 0.12)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#059669',
              fontSize: 11.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
            {autoDetectNotice}
          </div>
        )}

        {/* 3. INTERACTIVE CANVAS VIEWPORT */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 380,
            maxHeight: 520,
            background: '#0B0F19',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          {displayDimensions.width > 0 && (
            <div
              style={{
                position: 'relative',
                width: displayDimensions.width,
                height: displayDimensions.height,
                boxShadow: '0 0 20px rgba(0,0,0,0.5)',
              }}
            >
              {/* Background Image */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop Target"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />

              {/* Darkened Mask Outside the Crop Box */}
              {/* Top Mask */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: boxDispY,
                  background: 'rgba(11, 15, 25, 0.70)',
                  pointerEvents: 'none',
                }}
              />
              {/* Bottom Mask */}
              <div
                style={{
                  position: 'absolute',
                  top: boxDispY + boxDispH,
                  left: 0,
                  width: '100%',
                  bottom: 0,
                  background: 'rgba(11, 15, 25, 0.70)',
                  pointerEvents: 'none',
                }}
              />
              {/* Left Mask */}
              <div
                style={{
                  position: 'absolute',
                  top: boxDispY,
                  left: 0,
                  width: boxDispX,
                  height: boxDispH,
                  background: 'rgba(11, 15, 25, 0.70)',
                  pointerEvents: 'none',
                }}
              />
              {/* Right Mask */}
              <div
                style={{
                  position: 'absolute',
                  top: boxDispY,
                  left: boxDispX + boxDispW,
                  right: 0,
                  height: boxDispH,
                  background: 'rgba(11, 15, 25, 0.70)',
                  pointerEvents: 'none',
                }}
              />

              {/* Active Crop Box */}
              <div
                style={{
                  position: 'absolute',
                  left: boxDispX,
                  top: boxDispY,
                  width: boxDispW,
                  height: boxDispH,
                  border: '2px solid #38BDF8',
                  boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.8), 0 0 14px rgba(56, 189, 248, 0.5)',
                  cursor: 'move',
                  boxSizing: 'border-box',
                }}
                onPointerDown={(e) => handlePointerDown('move', e)}
              >
                {/* Rule-of-Thirds Grid */}
                <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, borderTop: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, borderTop: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, borderLeft: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, borderLeft: '1px dashed rgba(255, 255, 255, 0.35)', pointerEvents: 'none' }} />

                {/* Radar Crosshair Reticle */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 7, left: 0, right: 0, height: 2, background: 'rgba(56, 189, 248, 0.8)' }} />
                  <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'rgba(56, 189, 248, 0.8)' }} />
                </div>

                {/* Live Dimensions Chip inside Crop Box */}
                <div
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(4px)',
                    color: '#38BDF8',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{cropBox.width} × {cropBox.height} px</span>
                  {Math.abs(cropBox.width - cropBox.height) <= 2 && (
                    <span style={{ color: '#10B981' }}>✓ 1:1</span>
                  )}
                </div>

                {/* 8 Resize Handles */}
                {/* Corner Handles */}
                <div
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: -6,
                    width: 12,
                    height: 12,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'nwse-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('nw', e)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 12,
                    height: 12,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'nesw-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('ne', e)}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 12,
                    height: 12,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'nwse-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('se', e)}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    left: -6,
                    width: 12,
                    height: 12,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'nesw-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('sw', e)}
                />

                {/* Edge Handles */}
                <div
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 10,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'ns-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('n', e)}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 10,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'ns-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('s', e)}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: -5,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 10,
                    height: 16,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'ew-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('w', e)}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: -5,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 10,
                    height: 16,
                    background: '#FFFFFF',
                    border: '2px solid #0284C7',
                    borderRadius: 2,
                    cursor: 'ew-resize',
                  }}
                  onPointerDown={(e) => handlePointerDown('e', e)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. FOOTER & CONFIRMATION BAR */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Metadata & Status */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
            <div>
              ROI Size: <strong style={{ color: 'var(--text-primary)' }}>{cropBox.width} × {cropBox.height} px</strong>
            </div>
            <div>
              Offset: <span className="mono">({cropBox.x}, {cropBox.y})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#10B981' }}>check_circle</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>Aspect: 1:1 Distort-Free</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleApply}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                border: '1px solid rgba(37, 99, 235, 0.6)',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
              <span>Crop & Run Detection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
