import React, { useState } from 'react';
import type { AttributionWeights } from '../../types/dashboard';

export const AttributionView: React.FC = () => {
  const [weights, setWeights] = useState<AttributionWeights>({
    dist: 0.30,
    time: 0.25,
    gap: 0.20,
    type: 0.15,
  });

  const [scores, setScores] = useState<[number, number, number]>([0.82, 0.61, 0.34]);

  const recalculate = () => {
    const { dist, time, gap, type } = weights;
    const total = dist + time + gap + type || 1;

    const s1 = Math.min(1.0, (dist * 0.92 + time * 0.85 + gap * 0.90 + type * 0.95) / total);
    const s2 = Math.min(1.0, (dist * 0.65 + time * 0.70 + gap * 0.50 + type * 0.80) / total);
    const s3 = Math.min(1.0, (dist * 0.35 + time * 0.40 + gap * 0.20 + type * 0.70) / total);

    setScores([s1, s2, s3]);
  };

  return (
    <div id="tab-attribution" className="tab-content visible">
      {/* PAGE HEADER */}
      <div className="page-header" style={{ paddingTop: 'var(--sp-4)' }}>
        <div>
          <div className="flex items-center gap-3">
            <div className="page-title">Vessel Attribution &amp; Sensitivity Tuner</div>
            <span className="id-tag">EXPLAINABLE ML</span>
          </div>
          <div className="page-subtitle">
            Spatiotemporal intersection between AIS trajectories and backward drift origin envelope
          </div>
        </div>
      </div>

      <div className="content-area" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* WHAT-IF ATTRIBUTION WEIGHT TUNER */}
          <div className="weight-tuner">
            <div className="tuner-header">
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                Attribution Sensitivity Weights: S = Σ (wi · Si)
              </span>
              <button
                className="btn btn-primary"
                onClick={recalculate}
                style={{ padding: '4px 12px', fontSize: 11 }}
              >
                Recalculate Ranking
              </button>
            </div>

            <div className="tuner-grid">
              <div className="tuner-slider-wrap">
                <div className="tuner-lbl">
                  <span>Spatial Proximity (w_dist)</span>
                  <span className="mono fw-700">{weights.dist.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.dist}
                  className="tuner-input"
                  onChange={(e) => setWeights({ ...weights, dist: parseFloat(e.target.value) })}
                />
              </div>

              <div className="tuner-slider-wrap">
                <div className="tuner-lbl">
                  <span>Temporal Alignment (w_time)</span>
                  <span className="mono fw-700">{weights.time.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.time}
                  className="tuner-input"
                  onChange={(e) => setWeights({ ...weights, time: parseFloat(e.target.value) })}
                />
              </div>

              <div className="tuner-slider-wrap">
                <div className="tuner-lbl">
                  <span>AIS Silence Gap (w_gap)</span>
                  <span className="mono fw-700">{weights.gap.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.gap}
                  className="tuner-input"
                  onChange={(e) => setWeights({ ...weights, gap: parseFloat(e.target.value) })}
                />
              </div>

              <div className="tuner-slider-wrap">
                <div className="tuner-lbl">
                  <span>Vessel Type Risk Prior (w_type)</span>
                  <span className="mono fw-700">{weights.type.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={weights.type}
                  className="tuner-input"
                  onChange={(e) => setWeights({ ...weights, type: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* RANKED CANDIDATES */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_list_numbered</span>
                Ranked Candidate Vessels
              </span>
              <span className="text-xs text-muted">Spatiotemporal Search Window: T - 72h to 0h</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="vessel-row bb">
                <div className="v-rank r1">1</div>
                <div className="vessel-info">
                  <div className="v-name" style={{ color: 'var(--vessel-color)' }}>CRUDE ATLAS</div>
                  <div className="v-mmsi">MMSI: 419001234 · IMO: 9412345 · Flag: India · Crude Oil Tanker</div>
                  <div className="v-meta">CPA: 1.2 nm from envelope centroid · Speed: 4.1 kn · AIS Gap: 4h 35m (suspicious)</div>
                </div>
                <div className="score-col">
                  <div className="score-val sc-h">{scores[0].toFixed(2)}</div>
                  <div className="score-lbl">Attribution Score</div>
                </div>
              </div>

              <div className="vessel-row bb">
                <div className="v-rank r2">2</div>
                <div className="vessel-info">
                  <div className="v-name">MARITIME KOHISTAN</div>
                  <div className="v-mmsi">MMSI: 419005678 · IMO: 9523456 · Flag: India · Product Tanker</div>
                  <div className="v-meta">CPA: 3.8 nm from centroid · Speed: 12.4 kn · AIS Gap: 3h 33m</div>
                </div>
                <div className="score-col">
                  <div className="score-val sc-m">{scores[1].toFixed(2)}</div>
                  <div className="score-lbl">Attribution Score</div>
                </div>
              </div>

              <div className="vessel-row">
                <div className="v-rank r3">3</div>
                <div className="vessel-info">
                  <div className="v-name">GULF NAVIGATOR</div>
                  <div className="v-mmsi">MMSI: 419007890 · IMO: 9634567 · Flag: Panama · Chemical Tanker</div>
                  <div className="v-meta">CPA: 7.1 nm from centroid · Speed: 13.7 kn · AIS Gap: 1h 22m (normal shadow)</div>
                </div>
                <div className="score-col">
                  <div className="score-val sc-l">{scores[2].toFixed(2)}</div>
                  <div className="score-lbl">Attribution Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>gavel</span>
                Legal &amp; Evidentiary Disclaimer
              </span>
            </div>
            <div className="panel-body">
              <div className="prob-note">
                <strong>Important Legal Notice:</strong> Spill Sense attribution scores reflect statistical correlation and
                hydrodynamic consistency. Under MARPOL 73/78 Annex I and Section 356 of the Indian Merchant Shipping Act
                1958, physical oil sampling and maritime inspection by Indian Coast Guard / Mercantile Marine Department
                (MMD) officers remain mandatory for statutory enforcement.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
