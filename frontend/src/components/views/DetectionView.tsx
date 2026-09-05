import React, { useState, useEffect, useRef } from 'react';
import type { TabType, SarClassificationResult } from '../../types/dashboard';
import { loadModel, isModelLoaded, classifyImage, generateOcclusionMap } from '../../services/sarClassifier';

interface DetectionViewProps {
  onSelectTab?: (tab: TabType) => void;
}

export const DetectionView: React.FC<DetectionViewProps> = ({ onSelectTab }) => {
  const [modelStatus, setModelStatus] = useState<'loading' | 'loaded' | 'demo'>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SarClassificationResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [isGeneratingHeatmap, setIsGeneratingHeatmap] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadModel().then(() => {
      setModelStatus(isModelLoaded() ? 'loaded' : 'demo');
    });
  }, []);

  const handleImageUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    handleImageSelect(url);
  };

  const handleImageSelect = (url: string) => {
    setSelectedImage(url);
    setResult(null);
    setHeatmapUrl(null);
    setIsProcessing(true);
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = async () => {
      try {
        const res = await classifyImage(img);
        setResult(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    };
    img.onerror = () => setIsProcessing(false);
    img.src = url;
  };

  const handleGenerateHeatmap = async () => {
    if (!selectedImage) return;
    setIsGeneratingHeatmap(true);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = async () => {
      try {
        const url = await generateOcclusionMap(img);
        setHeatmapUrl(url);
      } catch (err) {
        console.error(err);
      } finally {
        setIsGeneratingHeatmap(false);
      }
    };
    img.src = selectedImage;
  };

  const class1Images = Array.from({ length: 10 }, (_, i) => `/demo-sar/class_1_${i + 1}.jpg`);
  const class0Images = Array.from({ length: 10 }, (_, i) => `/demo-sar/class_0_${i + 1}.jpg`);

  return (
    <div className="view-container glass" style={{ padding: 'var(--sp-6)', overflowY: 'auto', height: '100%' }}>
      <header style={{ marginBottom: 'var(--sp-6)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>🛰️ SAR Oil Spill Detection Lab</h1>
        <p style={{ color: 'var(--text-muted)' }}>CSIRO Sentinel-1 SAR Binary Classification • ONNX Runtime WebAssembly Inference</p>
        <div style={{ marginTop: 'var(--sp-3)', display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.05)' }}>
          <div className={`sd ${modelStatus === 'loaded' ? 'ok' : modelStatus === 'demo' ? 'warn' : ''}`}></div>
          <span style={{ fontSize: '0.85rem' }}>
            {modelStatus === 'loading' ? 'Loading ONNX Model...' : modelStatus === 'loaded' ? 'ONNX Model Loaded (WASM)' : 'Demo Mode (Model Not Found)'}
          </span>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)', marginBottom: 'var(--sp-6)' }}>
        {/* Upload Zone */}
        <div 
          style={{ 
            border: '2px dashed rgba(255,255,255,0.2)', 
            borderRadius: 'var(--radius-lg)', 
            padding: 'var(--sp-8)', 
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleImageUpload(e.dataTransfer.files[0]);
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.5, marginBottom: 'var(--sp-3)' }}>cloud_upload</span>
          <p>Drop a SAR image here or click to upload</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>Accepts .jpg, .png, .tif</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".jpg,.jpeg,.png,.tif,.tiff" 
            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} 
          />
        </div>

        {/* Gallery */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>Try Sample Images</h3>
          
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: '0.85rem', marginBottom: 'var(--sp-2)', color: 'var(--text-muted)' }}>🛢️ Oil Spill Samples (Class 1)</div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', paddingBottom: 'var(--sp-2)' }}>
              {class1Images.map((src, i) => (
                <img 
                  key={`c1-${i}`} 
                  src={src} 
                  alt={`Class 1 Sample ${i+1}`}
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius)', cursor: 'pointer', border: selectedImage === src ? '2px solid var(--accent)' : 'none' }}
                  onClick={() => handleImageSelect(src)}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', marginBottom: 'var(--sp-2)', color: 'var(--text-muted)' }}>🌊 Clean Ocean Samples (Class 0)</div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', overflowX: 'auto', paddingBottom: 'var(--sp-2)' }}>
              {class0Images.map((src, i) => (
                <img 
                  key={`c0-${i}`} 
                  src={src} 
                  alt={`Class 0 Sample ${i+1}`}
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius)', cursor: 'pointer', border: selectedImage === src ? '2px solid var(--accent)' : 'none' }}
                  onClick={() => handleImageSelect(src)}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {isProcessing && (
        <div style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
          <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '2rem' }}>autorenew</span>
          <p style={{ marginTop: 'var(--sp-2)' }}>Classifying Image...</p>
        </div>
      )}

      {result && selectedImage && (
        <section style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ 
            padding: 'var(--sp-4)', 
            background: result.prediction === 'oil_spill' 
              ? 'linear-gradient(90deg, rgba(220, 38, 38, 0.25) 0%, transparent 100%)' 
              : result.prediction === 'invalid_sar'
              ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.3) 0%, rgba(245, 158, 11, 0.2) 100%)'
              : 'linear-gradient(90deg, rgba(22, 163, 74, 0.2) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{ 
                fontSize: '1.5rem', 
                color: result.prediction === 'oil_spill' ? '#ef4444' : result.prediction === 'invalid_sar' ? '#f59e0b' : '#4ade80', 
                margin: '0 0 var(--sp-1) 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {result.prediction === 'oil_spill' && '🛢️ OIL SPILL DETECTED'}
                {result.prediction === 'no_oil' && '✅ CLEAN OCEAN'}
                {result.prediction === 'invalid_sar' && '⚠️ INVALID INPUT: NOT AN OCEAN / SAR RADAR IMAGE'}
              </h2>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {result.prediction === 'invalid_sar' ? (
                  <>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>Reason: {result.rejectionReason}</span>
                    <span>Domain: Out of Distribution (OOD)</span>
                  </>
                ) : (
                  <>
                    <span>Confidence: {(result.confidence * 100).toFixed(1)}%</span>
                    <span>Inference Time: {result.inferenceTimeMs}ms</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ 
              fontSize: result.prediction === 'invalid_sar' ? '1.5rem' : '2.5rem', 
              fontWeight: 'bold',
              color: result.prediction === 'invalid_sar' ? '#f59e0b' : 'inherit'
            }}>
              {result.prediction === 'invalid_sar' ? 'REJECTED' : `${(result.confidence * 100).toFixed(0)}%`}
            </div>
          </div>

          {result.prediction === 'invalid_sar' && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.12)', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '0.85rem' }}>
              <strong>Notice:</strong> This model is calibrated strictly for Synthetic Aperture Radar (SAR) ocean backscatter imagery (Sentinel-1 / ISRO RISAT/EOS-04). Documents, paper receipts, invoices, and standard optical photos are automatically rejected to prevent false positive/negative classifications.
            </div>
          )}

          <div style={{ display: 'flex', gap: '1px', background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ flex: 1, padding: 'var(--sp-4)', background: 'var(--bg-dark)' }}>
              <div style={{ marginBottom: 'var(--sp-2)', fontSize: '0.9rem' }}>
                {result.prediction === 'invalid_sar' ? 'Uploaded Non-Marine Image' : 'Original SAR Image'}
              </div>
              <img src={selectedImage} alt="Selected" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'contain', background: '#000' }} />
            </div>
            <div style={{ flex: 1, padding: 'var(--sp-4)', background: 'var(--bg-dark)' }}>
              <div style={{ marginBottom: 'var(--sp-2)', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
                Attention Map (Occlusion Sensitivity)
                {result.prediction !== 'invalid_sar' && !heatmapUrl && !isGeneratingHeatmap && (
                  <button onClick={handleGenerateHeatmap} style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '4px', cursor: 'pointer', padding: '0 4px', fontSize: '0.8rem' }}>Generate</button>
                )}
              </div>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {result.prediction === 'invalid_sar' ? (
                  <div style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#f59e0b', marginBottom: '8px' }}>block</span>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Attention Map Disabled</p>
                    <p style={{ marginTop: '4px' }}>Input was flagged as non-marine / document image. Please upload a verified SAR ocean scene.</p>
                  </div>
                ) : (
                  <>
                    <img src={selectedImage} alt="Selected" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                    {isGeneratingHeatmap && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 2 }}>
                        <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: '2rem' }}>autorenew</span>
                      </div>
                    )}
                    {heatmapUrl && (
                      <img src={heatmapUrl} alt="Heatmap" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'screen', opacity: 0.8, zIndex: 1 }} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div style={{ padding: 'var(--sp-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)' }}>
            <button 
              className="btn" 
              onClick={() => onSelectTab && onSelectTab('drift')} 
              disabled={result.prediction !== 'oil_spill'}
            >
              📊 Feed into Drift Model
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
