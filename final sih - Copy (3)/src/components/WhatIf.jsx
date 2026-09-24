import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/* ─── helpers ─── */
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const riskBand = (v) => {
  if (v >= 35) return { label: 'HIGH RISK',   hex: '#ef4444', track: '#7f1d1d', text: 'text-red-400',    bg: 'bg-red-500',    border: 'border-red-600'    };
  if (v >= 20) return { label: 'MEDIUM RISK', hex: '#f59e0b', track: '#78350f', text: 'text-amber-400',  bg: 'bg-amber-500',  border: 'border-amber-600'  };
  return         { label: 'LOW RISK',    hex: '#10b981', track: '#064e3b', text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-600' };
};

/* ─── Semi-circle gauge ─── */
const ArcGauge = ({ value, sub, dimmed = false }) => {
  const W = 200, H = 118;
  const cx = W / 2, cy = H - 10;
  const r  = 80;
  const pct = clamp(value / 100, 0, 1);
  const circ = Math.PI * r;
  const offset = circ * (1 - pct);
  const deg  = -180 + pct * 180;
  const rad  = (deg * Math.PI) / 180;
  const col  = riskBand(value);

  return (
    <div className={`flex flex-col items-center transition-opacity duration-300 ${dimmed ? 'opacity-35' : 'opacity-100'}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 180, display: 'block' }}>
        {/* Track */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={col.track} strokeWidth="12" strokeLinecap="round" />
        {/* Arc */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
          fill="none" stroke={col.hex} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(.4,0,.2,1), stroke 0.4s ease' }}
        />
        {/* Needle */}
        <line x1={cx} y1={cy}
          x2={cx + (r - 20) * Math.cos(rad)} y2={cy + (r - 20) * Math.sin(rad)}
          stroke={col.hex} strokeWidth="3" strokeLinecap="round"
          style={{ transition: 'x2 0.5s cubic-bezier(.4,0,.2,1), y2 0.5s cubic-bezier(.4,0,.2,1)' }}
        />
        <circle cx={cx} cy={cy} r="5" fill={col.hex} style={{ transition: 'fill 0.4s' }} />
        {/* Labels */}
        <text x={cx - r + 4} y={cy + 18} textAnchor="middle" fontSize="9" fill="#52525b">0</text>
        <text x={cx + r - 4} y={cy + 18} textAnchor="middle" fontSize="9" fill="#52525b">100</text>
        {/* Value */}
        <text x={cx} y={cy - 26} textAnchor="middle" fontSize="28" fontWeight="800"
          fill={col.hex} fontFamily="monospace"
          style={{ transition: 'fill 0.4s' }}>
          {value.toFixed(1)}
        </text>
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="10" fill="#71717a">/ 100</text>
      </svg>
      <span className={`text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded border mt-1 ${col.text} ${col.border} bg-transparent`}>
        {col.label}
      </span>
      {sub && <span className="text-[10px] text-gray-500 mt-0.5">{sub}</span>}
    </div>
  );
};

/* ─── Lever slider ─── */
const LeverSlider = ({ label, value, min, max, step, onChange, displayFn, color, tooltip, badge }) => {
  const [showTip, setShowTip] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;
  const COLORS = { emerald: '#10b981', amber: '#f59e0b', blue: '#3b82f6', purple: '#a855f7' };
  const TEXTS  = { emerald: 'text-emerald-400', amber: 'text-amber-400', blue: 'text-blue-400', purple: 'text-purple-400' };
  const tc = COLORS[color] || '#f59e0b';
  const tx = TEXTS[color]  || 'text-amber-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs font-semibold text-gray-200 truncate">{label}</span>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-px rounded bg-purple-950 text-purple-400 border border-purple-800/60 uppercase tracking-wide">
              {badge}
            </span>
          )}
          <button type="button"
            onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}
            className="w-4 h-4 shrink-0 rounded-full bg-gray-800 border border-gray-700 text-[9px] text-gray-500 flex items-center justify-center hover:border-amber-500 hover:text-amber-400 transition-colors">
            ?
          </button>
        </div>
        <span className={`text-xs font-bold font-mono shrink-0 ${tx}`}>{displayFn(value)}</span>
      </div>
      {showTip && tooltip && (
        <div className="text-[10px] text-gray-300 bg-gray-900 border border-amber-700/40 rounded px-2.5 py-2 leading-relaxed shadow-lg">
          {tooltip}
        </div>
      )}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="wif-slider w-full cursor-pointer"
        style={{ '--thumb-color': tc, '--fill-pct': `${pct}%` }}
      />
      <div className="flex justify-between text-[9px] text-gray-600 font-mono">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
};

/* ─── SHAP row ─── */
const ShapRow = ({ name, baseVal, simVal, delta }) => {
  if (Math.abs(delta) < 0.0005 && Math.abs(baseVal) < 0.005) return null;
  const label = name.replace(/_june|_freq/g, '').replace(/_/g, ' ');
  const improved = delta < 0;

  return (
    <div className="grid grid-cols-12 items-center gap-2 py-1.5 border-b border-gray-800/40 text-xs">
      <div className="col-span-4 text-[10px] text-gray-300 capitalize truncate" title={name}>{label}</div>
      {[{ val: baseVal }, { val: simVal }].map(({ val }, i) => (
        <div key={i} className="col-span-3 flex items-center gap-1">
          <div className="flex-1 bg-gray-950 h-2 rounded overflow-hidden border border-gray-800">
            <div className={`h-full ${val >= 0 ? 'bg-red-500' : 'bg-emerald-500'} rounded`}
              style={{ width: `${Math.min(Math.abs(val) * 350, 100)}%`, minWidth: 1 }} />
          </div>
          <span className={`text-[9px] font-mono w-12 text-right ${val >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {val > 0 ? '+' : ''}{val.toFixed(3)}
          </span>
        </div>
      ))}
      <div className={`col-span-2 text-[10px] font-bold font-mono text-right ${improved ? 'text-emerald-400' : 'text-red-400'}`}>
        {delta > 0 ? '+' : ''}{delta.toFixed(3)}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export const WhatIf = ({ projectId, onBack }) => {
  const { token } = useAuth();

  const [project,   setProject]  = useState(null);
  const [snapshot,  setSnapshot] = useState(null);
  const [loading,   setLoading]  = useState(true);

  /* Levers */
  const [execVel,     setExecVel]     = useState(2.0);
  const [expRate,     setExpRate]     = useState(0.8);
  const [scheduleExt, setScheduleExt] = useState(0);
  const [compDate,    setCompDate]    = useState('2026-12-31');
  const [monsoon,     setMonsoon]     = useState(1.0);

  /* Results */
  const [simResult,  setSimResult]  = useState(null);
  const [ranked,     setRanked]     = useState([]);
  const [simulating, setSimulating] = useState(false);
  const [simError,   setSimError]   = useState(null);
  const [toastMsg,   setToastMsg]   = useState('');
  const [activeTab,  setActiveTab]  = useState('output');

  const debounceRef    = useRef(null);
  const baseMonthsRef  = useRef(12.0);

  /* ── Fetch project ── */
  useEffect(() => {
    if (!projectId || !token) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setProject(d.project);
        setSnapshot(d.snapshot);
        if (d.snapshot?.raw_data_json) {
          const raw = JSON.parse(d.snapshot.raw_data_json);
          if (raw.execution_velocity != null) setExecVel(parseFloat(raw.execution_velocity));
          if (raw.monsoon_overlap    != null) setMonsoon(parseFloat(raw.monsoon_overlap));
          if (raw.months_to_anticipated_completion != null) {
            baseMonthsRef.current = parseFloat(raw.months_to_anticipated_completion);
          }
          const expend  = parseFloat(d.snapshot.expenditure || 0);
          const revCost = parseFloat(d.snapshot.revised_cost || 1);
          if (revCost > 0) setExpRate(parseFloat(Math.min(expend / revCost, 2.0).toFixed(2)));
          if (d.snapshot.revised_end_date) setCompDate(d.snapshot.revised_end_date.slice(0, 10));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch(`/api/projects/${projectId}/interventions/ranked`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setRanked(d.ranked_interventions || []))
      .catch(console.error);
  }, [projectId, token]);

  /* ── Schedule extension slider ── */
  const handleExtSliderChange = (ext) => {
    setScheduleExt(ext);
    const refDt = new Date('2026-06-30');
    refDt.setDate(refDt.getDate() + Math.round(((baseMonthsRef.current || 12) + ext) * 30.44));
    setCompDate(refDt.toISOString().slice(0, 10));
  };

  const handleDateChange = (str) => {
    setCompDate(str);
    try {
      const diff = Math.max((new Date(str) - new Date('2026-06-30')) / (1000 * 60 * 60 * 24 * 30.44), 1);
      setScheduleExt(Math.min(Math.max(Math.round(diff - (baseMonthsRef.current || 12)), 0), 36));
    } catch (_) {}
  };

  /* ── Simulation ── */
  const runSim = useCallback(() => {
    if (!projectId || !token) return;
    setSimulating(true);
    setSimError(null);
    fetch(`/api/projects/${projectId}/whatif`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        execution_velocity:      parseFloat(execVel),
        expenditure_rate:        parseFloat(expRate),
        revised_completion_date: compDate,
        monsoon_overlap:         parseFloat(monsoon),
      }),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSimResult)
      .catch(e => setSimError(e.message))
      .finally(() => setSimulating(false));
  }, [projectId, token, execVel, expRate, compDate, monsoon]);

  /* 180 ms debounce */
  useEffect(() => {
    if (!projectId || !token) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSim, 180);
    return () => clearTimeout(debounceRef.current);
  }, [runSim]);

  /* ── Reset ── */
  const handleReset = () => {
    if (snapshot?.raw_data_json) {
      const raw = JSON.parse(snapshot.raw_data_json);
      if (raw.execution_velocity != null) setExecVel(parseFloat(raw.execution_velocity));
      if (raw.monsoon_overlap    != null) setMonsoon(parseFloat(raw.monsoon_overlap));
    } else {
      setExecVel(2.0); setMonsoon(1.0);
    }
    setScheduleExt(0);
    const expend  = parseFloat(snapshot?.expenditure || 0);
    const revCost = parseFloat(snapshot?.revised_cost || 1);
    setExpRate(revCost > 0 ? parseFloat(Math.min(expend / revCost, 2.0).toFixed(2)) : 0.8);
    if (snapshot?.revised_end_date) setCompDate(snapshot.revised_end_date.slice(0, 10));
    else setCompDate('2026-12-31');
    toast('Reset to actual MoSPI baseline values');
  };

  /* ── Apply ranked intervention ── */
  const applyIntervention = (item) => {
    if (item.lever_changes?.execution_velocity != null)
      setExecVel(parseFloat(item.lever_changes.execution_velocity.toFixed(2)));
    if (item.lever_changes?.expenditure_rate != null)
      setExpRate(parseFloat(item.lever_changes.expenditure_rate.toFixed(2)));
    if (item.lever_changes?.monsoon_overlap != null)
      setMonsoon(parseFloat(item.lever_changes.monsoon_overlap));
    if (item.lever_changes?.revised_completion_date)
      handleDateChange(item.lever_changes.revised_completion_date);
    else if (item.lever_changes?.months_to_anticipated_completion != null) {
      const mo = item.lever_changes.months_to_anticipated_completion;
      const dt = new Date('2026-06-30');
      dt.setDate(dt.getDate() + Math.round(mo * 30.44));
      handleDateChange(dt.toISOString().slice(0, 10));
    }
    setActiveTab('output');
    toast(`Applied: "${item.intervention_name}"`);
  };

  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading simulation engine…</span>
      </div>
    );
  }

  /* ─── Derived metrics ─── */
  const liveBase       = simResult?.baseline_predictive_risk_index  ?? null;
  const liveSim        = simResult?.simulated_predictive_risk_index ?? null;
  const riskDelta      = simResult?.risk_reduction ?? 0;
  
  // Baseline project duration (months to 100% completion at baseline velocity)
  const baseProjMonths = simResult?.baseline_completion_months_remaining 
    ?? (snapshot?.physical_progress ? (100 - parseFloat(snapshot.physical_progress)) / 2.0 : 18.0);
  // Simulated project duration (months to 100% completion at current slider velocity)
  const projMonths     = simResult?.projected_completion_months_remaining ?? baseProjMonths;
  
  // Dynamic months saved
  const monthsSavedVal = (simResult?.months_saved != null) 
    ? simResult.months_saved 
    : (baseProjMonths - projMonths);

  // SHAP data
  const shBase = simResult?.shap_baseline  ?? {};
  const shSim  = simResult?.shap_simulated ?? {};
  const shapRows = Object.keys(shBase)
    .map(k => ({ name: k, baseVal: shBase[k], simVal: shSim[k] ?? 0, delta: (shSim[k] ?? 0) - shBase[k] }))
    .filter(r => Math.abs(r.delta) > 0.0005 || Math.abs(r.baseVal) > 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10);

  const leverInsights = simResult?.lever_insights ?? [];

  const TABS = [
    { id: 'output',        label: '📊 Risk Output' },
    { id: 'shap',          label: '🧠 SHAP Attribution' },
    { id: 'interventions', label: `⚡ Interventions (${ranked.length})` },
  ];

  return (
    <div className="whatif-container space-y-4" style={{ maxWidth: '100%', overflowX: 'hidden' }}>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-amber-950/90 border border-amber-600 text-amber-300 text-xs px-4 py-2.5 rounded-lg shadow-xl animate-fadeIn flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-gray-800">
        <div className="min-w-0">
          <button onClick={onBack} className="text-xs text-amber-400 hover:underline mb-1 inline-flex items-center gap-1">
            ← Back to Registry
          </button>
          <h2 className="text-lg font-bold text-gray-100 flex flex-wrap items-center gap-2">
            🧪 What-If Policy Simulator
            <span className="font-mono text-xs text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
              #{projectId}
            </span>
            {simulating && (
              <span className="text-xs text-amber-400 animate-pulse font-normal flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Re-scoring…
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            XGBoost + LightGBM ensemble · SHAP TreeExplainer ·{' '}
            <strong className="text-gray-200">{project?.project_name}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-center px-3 py-1.5 bg-amber-950/40 border border-amber-700/40 rounded-lg">
            <div className="text-amber-400 font-bold text-[9px] uppercase tracking-wider">AI Model</div>
            <div className="text-[9px] text-amber-300/70 font-mono">Calibrated Ensemble</div>
          </div>
        </div>
      </div>

      {simError && (
        <div className="bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2 text-xs text-red-300">
          ⚠ Simulation error: {simError}. Verify the backend API is running on port 8000.
        </div>
      )}

      {/* ══ HERO METRICS BAND ══ */}
      {(liveBase != null || projMonths != null) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Risk Delta */}
          <div className={`rounded-xl p-4 border text-center ${
            riskDelta > 0.1
              ? 'bg-emerald-950/40 border-emerald-700/50'
              : riskDelta < -0.1
                ? 'bg-red-950/40 border-red-700/50'
                : 'bg-gray-900/60 border-gray-800'
          }`}>
            <div className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1">AI Risk Delta</div>
            <div className={`text-3xl font-black font-mono leading-none ${
              riskDelta > 0.1 ? 'text-emerald-400' : riskDelta < -0.1 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {riskDelta > 0.1 ? '▼ ' : riskDelta < -0.1 ? '▲ ' : ''}
              {Math.abs(riskDelta).toFixed(2)}
            </div>
            <div className={`text-[10px] font-semibold mt-1 ${
              riskDelta > 0.1 ? 'text-emerald-400' : riskDelta < -0.1 ? 'text-red-400' : 'text-gray-500'
            }`}>
              {riskDelta > 0.1 ? 'pts RISK REDUCED' : riskDelta < -0.1 ? 'pts RISK ADDED' : 'No change'}
            </div>
            <div className="flex justify-center gap-2 mt-2 text-[10px] font-mono text-gray-500">
              <span>Base: <span className="text-gray-300">{liveBase?.toFixed(1)}</span></span>
              <span>→</span>
              <span>Sim: <span className={liveSim < liveBase ? 'text-emerald-400' : 'text-red-400'}>{liveSim?.toFixed(1)}</span></span>
            </div>
          </div>

          {/* Months Delta — HERO PANEL */}
          <div className={`rounded-xl p-4 border text-center transition-all ${
            monthsSavedVal > 0.2
              ? 'bg-emerald-950/50 border-emerald-600/60'
              : monthsSavedVal < -0.2
                ? 'bg-red-950/50 border-red-600/60'
                : 'bg-gray-900/60 border-gray-800'
          }`}>
            <div className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1">Timeline Impact</div>
            <div className={`text-4xl font-black font-mono leading-none ${
              monthsSavedVal > 0.2 ? 'text-emerald-300' : monthsSavedVal < -0.2 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {monthsSavedVal > 0.2 ? '−' : monthsSavedVal < -0.2 ? '+' : ''}
              {Math.abs(monthsSavedVal).toFixed(1)}
            </div>
            <div className={`text-xs font-bold mt-1 ${
              monthsSavedVal > 0.2 ? 'text-emerald-400' : monthsSavedVal < -0.2 ? 'text-red-400' : 'text-gray-500'
            }`}>
              {monthsSavedVal > 0.2
                ? `MONTHS SAVED`
                : monthsSavedVal < -0.2
                  ? `MONTHS ADDED`
                  : 'Baseline pace'}
            </div>
            <div className="flex justify-center gap-2 mt-2 text-[10px] font-mono text-gray-500">
              <span>Base: <span className="text-gray-300">{baseProjMonths.toFixed(1)} mo</span></span>
              <span>→</span>
              <span>Sim: <span className={projMonths < baseProjMonths ? 'text-emerald-400' : 'text-red-400'}>{projMonths.toFixed(1)} mo</span></span>
            </div>
          </div>

          {/* Projected Completion */}
          <div className="rounded-xl p-4 border bg-gray-900/60 border-gray-800 text-center">
            <div className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1">Projected Completion</div>
            <div className="text-3xl font-black font-mono leading-none text-purple-400">
              {projMonths != null ? projMonths.toFixed(1) : '—'}
            </div>
            <div className="text-[10px] font-semibold text-purple-300/80 mt-1">months remaining</div>
            <div className="text-[9px] text-gray-600 mt-2 font-mono">
              Target: {compDate}
            </div>
          </div>
        </div>
      )}

      {/* ══ MAIN TWO-COLUMN LAYOUT ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ═══ LEFT: LEVERS ═══ */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-4 min-w-0">
          <div className="flex items-center justify-between pb-1 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-100">Policy Levers</h3>
              <p className="text-[10px] text-gray-500">Drag any slider to simulate — AI recalculates instantly</p>
            </div>
            <button onClick={handleReset}
              className="text-[10px] font-mono text-gray-400 hover:text-amber-400 border border-gray-800 hover:border-amber-700/40 px-2 py-1 rounded transition-colors">
              ↺ Reset
            </button>
          </div>

          {/* Lever 1: Schedule Extension */}
          <div className="p-3 bg-gray-950/80 rounded-lg border border-purple-900/40 space-y-2">
            <LeverSlider
              label="Schedule Extension"
              value={scheduleExt} min={0} max={36} step={1}
              onChange={handleExtSliderChange}
              displayFn={v => v === 0 ? 'No Extension' : `+${v} Months Extended`}
              color="purple"
              badge="TOP DRIVER"
              tooltip="The #1 AI model feature. Extending the completion date gives more months to finish, directly slashing the delay risk index. Each additional month reduces risk by ~0.1–0.3 pts."
            />
            <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 border-t border-gray-800/60 font-mono">
              <span>Target date:</span>
              <input type="date" value={compDate}
                onChange={e => handleDateChange(e.target.value)}
                min="2026-07-01" max="2032-12-31"
                className="bg-gray-900 border border-gray-800 rounded px-2 py-0.5 text-[11px] text-purple-300 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Lever 2: Execution Velocity */}
          <div className="p-3 bg-gray-950/80 rounded-lg border border-emerald-900/40 space-y-2">
            <LeverSlider
              label="Monthly Execution Velocity"
              value={execVel} min={0.1} max={6.0} step={0.1}
              onChange={setExecVel}
              displayFn={v => `${parseFloat(v).toFixed(1)}%/mo`}
              color="emerald"
              badge="VELOCITY"
              tooltip="Physical construction progress achieved per month. Effective range: 0.1% to 5%. Above 5% shows diminishing returns in the model."
            />
            {snapshot && (() => {
              const raw = snapshot.raw_data_json ? JSON.parse(snapshot.raw_data_json) : {};
              const actual = parseFloat(raw.execution_velocity || 0);
              const prog = parseFloat(snapshot.physical_progress || 0);
              const monthsRem = Math.max((baseMonthsRef.current || 12) + scheduleExt, 1);
              const reqVel = (100 - prog) / monthsRem;
              return (
                <div className="text-[10px] text-gray-400 flex justify-between font-mono pt-1 border-t border-gray-800/60">
                  <span>Actual: <strong className="text-gray-300">{actual.toFixed(2)}%/mo</strong></span>
                  <span>Required: <strong className={reqVel > execVel ? 'text-red-400' : 'text-emerald-400'}>{reqVel.toFixed(2)}%/mo</strong></span>
                </div>
              );
            })()}
          </div>

          {/* Lever 3: Expenditure Rate */}
          <div className="p-3 bg-gray-950/80 rounded-lg border border-amber-900/40 space-y-2">
            <LeverSlider
              label="Financial Disbursement Rate"
              value={expRate} min={0.10} max={1.50} step={0.05}
              onChange={setExpRate}
              displayFn={v => `${parseFloat(v).toFixed(2)}× of revised cost`}
              color="amber"
              badge="FINANCE"
              tooltip="Expenditure ÷ revised cost ratio. Sweet spot: 0.65×–0.85×. Below 0.5 = contractor payment bottleneck. Above 1.0 = cost overrun territory."
            />
            <div className="text-[9px] text-gray-600 font-mono pt-1 border-t border-gray-800/60">
              {expRate < 0.5 ? '⚠ Severe payment backlog risk' :
               expRate < 0.65 ? '⚠ Below optimal disbursement' :
               expRate <= 0.85 ? '✓ Optimal synchronised disbursement' :
               expRate <= 1.0 ? '⚡ Near full utilisation' :
               '🔴 Cost overrun zone'}
            </div>
          </div>

          {/* Lever 4: Monsoon */}
          <div className="p-3 bg-gray-950/80 rounded-lg border border-blue-900/40 space-y-2">
            <LeverSlider
              label="Monsoon Overlap"
              value={monsoon} min={0} max={3} step={1}
              onChange={setMonsoon}
              displayFn={v => `${parseInt(v)} Month${parseInt(v) !== 1 ? 's' : ''}`}
              color="blue"
              tooltip="Active outdoor construction months overlapping monsoon season. Pre-scheduling earthworks before monsoon reduces stoppage risk. Model shows near-zero sensitivity — schedule extension is far more impactful."
            />
          </div>

          {/* Recalculate button */}
          <button onClick={runSim} disabled={simulating}
            className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-2">
            <span>⚡</span>
            <span>{simulating ? 'Re-scoring AI models…' : 'Recalculate AI Models'}</span>
          </button>
        </div>

        {/* ═══ RIGHT: GAUGES + TABS ═══ */}
        <div className="space-y-4 min-w-0">

          {/* Gauge row */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-3">
              <h3 className="text-sm font-bold text-gray-100">Predictive Risk Index</h3>
              <span className="text-[10px] text-gray-400 font-mono">Live XGBoost · LightGBM</span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Baseline</span>
                {liveBase != null
                  ? <ArcGauge value={liveBase} sub="Current State" />
                  : <div className="text-xs text-gray-600 py-10">Initializing…</div>}
              </div>

              <div className="flex flex-col items-center gap-3">
                <span className="text-2xl text-gray-600 font-mono">→</span>
                {simResult ? (
                  <div className={`rounded-lg px-2 py-2 border text-center w-full ${
                    riskDelta > 0.1 ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : riskDelta < -0.1 ? 'bg-red-950/60 border-red-700 text-red-300'
                    : 'bg-gray-950 border-gray-800 text-gray-400'
                  }`}>
                    <div className="text-lg font-black font-mono leading-none">
                      {riskDelta > 0.1 ? '▼' : riskDelta < -0.1 ? '▲' : '—'}
                    </div>
                    <div className="text-[10px] font-bold font-mono">{Math.abs(riskDelta).toFixed(2)}</div>
                    <div className="text-[9px] uppercase tracking-wide mt-0.5">
                      {riskDelta > 0.1 ? 'reduced' : riskDelta < -0.1 ? 'increased' : 'no change'}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600 text-center">drag a lever</div>
                )}
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Simulated</span>
                {liveSim != null
                  ? <ArcGauge value={liveSim} sub="With Levers Applied" />
                  : <ArcGauge value={liveBase ?? 0} sub="With Levers Applied" dimmed />}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-800">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${
                    activeTab === t.id
                      ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/20'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─ Tab: Risk Output ─ */}
            {activeTab === 'output' && (
              <div className="p-4 space-y-4">
                {/* Param summary */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Execution Velocity', val: `${parseFloat(execVel).toFixed(1)}%/mo`, color: 'text-emerald-400' },
                    { label: 'Disbursement Rate',  val: `${parseFloat(expRate).toFixed(2)}×`,    color: 'text-amber-400'  },
                    { label: 'Monsoon Overlap',    val: `${parseInt(monsoon)} mo`,                color: 'text-blue-400'   },
                    { label: 'Schedule Ext.',      val: scheduleExt === 0 ? 'None' : `+${scheduleExt} mo`, color: 'text-purple-400' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                      <div className="text-[9px] text-gray-500 mb-0.5">{item.label}</div>
                      <div className={`text-sm font-bold font-mono ${item.color}`}>{item.val}</div>
                    </div>
                  ))}
                </div>

                {/* Lever insights */}
                {leverInsights.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Feature Sensitivity</h4>
                    {leverInsights.map((ins, i) => (
                      <div key={i} className="bg-gray-950 border border-gray-800/80 rounded-lg p-3 flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${ins.lever === 'none' ? 'bg-gray-600' : 'bg-amber-400'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-200">{ins.label}</span>
                            {ins.change !== '–' && (
                              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-px rounded">{ins.change}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{ins.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {leverInsights.length === 0 && !simResult && (
                  <div className="text-center py-6 text-gray-500 text-xs">
                    Drag any lever on the left — AI insights will appear here instantly.
                  </div>
                )}
              </div>
            )}

            {/* ─ Tab: SHAP Attribution ─ */}
            {activeTab === 'shap' && (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-gray-800">
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">SHAP TreeExplainer Attribution</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Real ML feature attributions. Negative Δ = lever <em>reduced</em> this feature's delay risk contribution.
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                    TreeExplainer Active
                  </span>
                </div>
                {shapRows.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">Adjust sliders to see live SHAP shifts.</div>
                ) : (
                  <div className="space-y-0">
                    <div className="grid grid-cols-12 gap-2 text-[9px] text-gray-500 font-semibold pb-2 border-b border-gray-800">
                      <span className="col-span-4">Feature</span>
                      <span className="col-span-3 text-center">Baseline SHAP</span>
                      <span className="col-span-3 text-center">Simulated SHAP</span>
                      <span className="col-span-2 text-right">Δ</span>
                    </div>
                    {shapRows.map(r => <ShapRow key={r.name} {...r} />)}
                    <div className="flex items-center justify-between pt-2 text-[9px] text-gray-600 italic">
                      <span>Red = risk-increasing · Green = risk-decreasing</span>
                      <span>Δ = Simulated − Baseline</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─ Tab: Ranked Interventions ─ */}
            {activeTab === 'interventions' && (
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-800">
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">AI-Ranked Intervention Packages</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ML-evaluated combinations, sorted by maximum risk reduction. Click "Apply" to load into levers.
                    </p>
                  </div>
                  <span className="text-[9px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded shrink-0">
                    By Risk Reduction
                  </span>
                </div>
                {ranked.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs">Computing optimal candidates…</div>
                ) : (
                  <div className="space-y-2">
                    {ranked.map((item, idx) => {
                      const maxR = ranked[0]?.risk_reduction || 1;
                      return (
                        <div key={idx} className="bg-gray-950 border border-gray-800 rounded-lg p-3 hover:border-amber-600/50 transition-colors">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[11px] font-bold font-mono text-amber-400 shrink-0">#{idx + 1}</span>
                              <span className="text-xs font-semibold text-gray-200 truncate">{item.intervention_name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold font-mono ${item.risk_reduction > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.risk_reduction > 0 ? '▼ -' : '▲ +'}{Math.abs(item.risk_reduction).toFixed(2)} pts
                              </span>
                              <button onClick={() => applyIntervention(item)}
                                className="btn-secondary text-[10px] py-1 px-2 text-amber-400 hover:border-amber-500">
                                Apply →
                              </button>
                            </div>
                          </div>
                          <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden mb-1.5">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${item.risk_reduction > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(Math.abs(item.risk_reduction / maxR) * 100, 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>New: <strong className="text-emerald-400">{item.new_risk?.toFixed(2)}</strong></span>
                            <span>Base: {item.baseline_risk?.toFixed(2)}</span>
                            {item.projected_months && (
                              <span className="text-purple-400">{item.projected_months.toFixed(1)} mo left</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-[9px] text-amber-400/70 italic bg-amber-950/20 border border-amber-900/30 rounded px-3 py-2 leading-relaxed">
            * Outcomes are generated by the trained XGBoost + LightGBM ensemble. They represent model-implied risk probabilities, not deterministic guarantees.
          </p>
        </div>
      </div>
    </div>
  );
};
