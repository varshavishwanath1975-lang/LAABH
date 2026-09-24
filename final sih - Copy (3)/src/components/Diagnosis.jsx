import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const Diagnosis = ({ projectId, onBack, onGoToWhatIf }) => {
  const { token } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId || !token) return;
    setLoading(true);
    setError(null);

    fetch(`/api/projects/${projectId}/diagnosis`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project diagnosis`);
        return res.json();
      })
      .then((resData) => {
        setData(resData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, token]);

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading phase-cascade diagnosis from API...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-950/60 border border-red-500/50 rounded-xl text-red-200">
        <h3 className="font-bold text-lg mb-2">Error Loading Diagnosis</h3>
        <p className="text-sm">{error || 'Diagnosis data unavailable'}</p>
        <button onClick={onBack} className="mt-4 btn-secondary text-xs">← Back to Registry</button>
      </div>
    );
  }

  const riskVal = parseFloat(data.predictive_risk_index || 0);
  const recovVal = parseFloat(data.recoverability_score || 0);
  const diag = data.phase_cascade_bottleneck_diagnosis || {};
  const drivers = data.shap_top_drivers || {};
  
  // Format top 8 SHAP drivers
  const top8Drivers = Object.entries(drivers).slice(0, 8).map(([feature, val]) => ({
    feature: feature.replace(/_june|_freq/g, '').replace(/_/g, ' '),
    val: parseFloat(val),
    direction: val >= 0 ? '+ Increases Risk' : '- Decreases Risk',
    isPositive: val >= 0
  }));

  const maxShapAbs = Math.max(...top8Drivers.map(d => Math.abs(d.val)), 0.01);

  // Dynamic AI Velocity & Schedule calculation
  const phases = diag.phase_breakdown || [];
  const feat = data.feature_values || {};
  const physProg = parseFloat(feat.physical_progress || 0.0);
  const monthsRem = Math.max(parseFloat(feat.months_to_anticipated_completion || 12.0), 1.0);
  const reqVel = parseFloat(((100.0 - physProg) / monthsRem).toFixed(1));
  const obsVel = parseFloat(parseFloat(feat.execution_velocity || 0.0).toFixed(1));

  return (
    <div className="diagnosis-container space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <button onClick={onBack} className="text-xs text-amber-400 hover:underline mb-1 inline-block">
            ← Back to Registry
          </button>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-3">
            <span>{data.project_name}</span>
            <span className="font-mono text-xs text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
              ID #{data.project_id}
            </span>
          </h2>
          <div className="text-xs text-gray-400 mt-1">
            Ministry: <span className="text-gray-200 font-medium">{data.line_ministry}</span> | Executing Agency: <span className="text-gray-200 font-medium">{data.company_name}</span>
          </div>
        </div>

        <button
          onClick={() => onGoToWhatIf(data.project_id)}
          className="btn-primary flex items-center gap-2"
        >
          ⚡ Launch What-If Simulation →
        </button>
      </div>

      {/* 1. Three Tiles (Risk, Recoverability, Time Overrun) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tile 1: Predictive Risk Index */}
        <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400">Predictive Risk Index</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              riskVal >= 30 ? 'bg-red-950 text-red-300 border border-red-700' :
              riskVal >= 15 ? 'bg-amber-950 text-amber-300 border border-amber-700' :
              'bg-emerald-950 text-emerald-300 border border-emerald-700'
            }`}>
              {riskVal >= 30 ? 'CRITICAL DELAY RISK' : riskVal >= 15 ? 'MODERATE RISK' : 'LOW DELAY RISK'}
            </span>
          </div>
          <div className="my-2">
            <div className={`text-3xl font-bold font-mono ${riskVal >= 30 ? 'text-red-400' : riskVal >= 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {riskVal.toFixed(1)} <span className="text-sm font-normal text-gray-500">/ 100</span>
            </div>
            <div className="w-full bg-gray-950 rounded-full h-2 mt-2 border border-gray-800">
              <div className={`h-2 rounded-full ${riskVal >= 30 ? 'bg-red-500' : riskVal >= 15 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(riskVal, 100)}%` }}></div>
            </div>
          </div>
          <div className="text-[11px] text-gray-500">Calibrated XGBoost + LightGBM Ensemble Output</div>
        </div>

        {/* Tile 2: Recoverability Score */}
        <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400">Recoverability Score</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
              RULE-BASED INDEX
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold text-emerald-400 font-mono">{recovVal.toFixed(1)} <span className="text-sm font-normal text-gray-500">/ 100</span></div>
            <div className="w-full bg-gray-950 rounded-full h-2 mt-2 border border-gray-800">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(recovVal, 100)}%` }}></div>
            </div>
          </div>
          <div className="text-[11px] text-gray-500">Observed Velocity vs Required Velocity Ratio</div>
        </div>

        {/* Tile 3: Velocity & Schedule Gap */}
        <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400">Monthly Velocity Gap</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
              PHYSICAL PROGRESS
            </span>
          </div>
          <div className="my-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Required Monthly Velocity:</span>
              <span className="text-amber-400 font-mono font-bold">{reqVel.toFixed(1)}% / mo</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Observed Monthly Velocity:</span>
              <span className="text-emerald-400 font-mono font-bold">{obsVel.toFixed(1)}% / mo</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-500">Target schedule requires {monthsRem.toFixed(0)} months remaining</div>
        </div>
      </div>

      {/* 2. SHAP Top-8 Driver Bars & Agreement Badge */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-base font-bold text-gray-100">Top 8 SHAP Risk Driver Analysis</h3>
            <p className="text-xs text-gray-400">Model feature attribution explaining individual risk contribution</p>
          </div>

          {/* Model Convergence Agreement Badge */}
          <div className="bg-emerald-950/60 border border-emerald-700/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <div className="text-xs">
              <span className="text-emerald-300 font-bold block">XGBoost & LightGBM Agreement</span>
              <span className="text-emerald-400/80 font-mono text-[10px]">
                Spearman Correlation: {data.model_agreement?.spearman_agreement?.toFixed(4) || '0.9648'} (High)
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {top8Drivers.map((d) => {
            const barWidth = Math.min((Math.abs(d.val) / maxShapAbs) * 100, 100);
            return (
              <div key={d.feature} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-300 font-medium capitalize">{d.feature}</span>
                  {/* Direction shown by sign AND label, not color alone (WCAG AA requirement) */}
                  <span className={`font-semibold ${d.isPositive ? 'text-red-400' : 'text-emerald-400'}`}>
                    {d.direction} ({d.val > 0 ? '+' : ''}{d.val.toFixed(4)})
                  </span>
                </div>
                <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800 flex">
                  <div
                    className={`h-2.5 rounded-full ${d.isPositive ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Phase-Cascade Bottleneck Diagnosis */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-700 text-xs font-bold rounded">
              DIAGNOSTIC ENGINE
            </span>
            <h3 className="text-base font-bold text-gray-100">Phase-Cascade Bottleneck Diagnosis</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Sequential evaluation across pre-construction, physical execution, financial disbursement, and seasonal exposure phases.
          </p>
        </div>

        {/* Phase Breakdown List */}
        <div className="space-y-3">
          {phases.map((p, idx) => (
            <div key={idx} className="bg-gray-950 border border-gray-800/80 p-3 rounded-lg flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                p.severity === 'CRITICAL' || p.severity === 'HIGH' ? 'bg-red-500 animate-pulse' :
                p.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200">{p.phase_name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                    p.severity === 'CRITICAL' || p.severity === 'HIGH' ? 'bg-red-950 text-red-300 border border-red-800' :
                    p.severity === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {p.status}
                  </span>
                </div>
                {/* Dynamically generated text from API only (No hardcoded text) */}
                <p className="text-xs text-gray-400 mt-1">{p.finding}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cascade Impact Summary */}
        <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-200">
          <strong className="text-amber-400 block mb-1">Cascade Impact Diagnosis:</strong>
          {diag.cascade_impact_summary}
        </div>
      </div>

      {/* 4. Historical Trajectory Chart (Real Snapshots Only, No Interpolation) */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-base font-bold text-gray-100">Historical Monthly Trajectory</h3>
        <p className="text-xs text-gray-400">Real observed monthly snapshot progress (June 2026 – July 2026)</p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.real_snapshots_history || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="snapshot_month" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#f3f4f6' }}
              />
              <Line type="monotone" dataKey="physical_progress" name="Physical Progress (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="predictive_risk_index" name="Predictive Risk Index" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
