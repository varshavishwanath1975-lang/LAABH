import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const Dashboard = ({ onSelectProject }) => {
  const { token } = useAuth();
  
  const [projects, setProjects] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [ministry, setMinistry] = useState('');
  const [sector, setSector] = useState('');
  const [riskBand, setRiskBand] = useState('');
  const [delayedOnly, setDelayedOnly] = useState(false);

  // Filter options from API
  const [ministriesList, setMinistriesList] = useState([]);
  const [sectorsList, setSectorsList] = useState([]);

  // Fetch projects from server API
  const fetchProjects = () => {
    if (!token) return;
    setLoading(true);

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    if (search) queryParams.append('search', search);
    if (ministry) queryParams.append('ministry', ministry);
    if (sector) queryParams.append('sector', sector);
    if (riskBand) queryParams.append('risk_band', riskBand);
    if (delayedOnly) queryParams.append('delayed_only', 'true');

    fetch(`/api/projects?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.data || []);
        setTotalCount(data.total || 0);

        if (data.filter_options) {
          setMinistriesList(data.filter_options.ministries || []);
          setSectorsList(data.filter_options.sectors || []);
        }
      })
      .catch((err) => console.error('Error fetching projects:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, [token, page, limit, ministry, sector, riskBand, delayedOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProjects();
  };

  // KPI Calculations from current page / API data
  const totalOutlay = projects.reduce((sum, p) => sum + (p.revised_cost || p.original_cost || 0), 0);
  const avgProgress = projects.length ? (projects.reduce((sum, p) => sum + (p.physical_progress || 0), 0) / projects.length) : 0;
  const avgRisk = projects.length ? (projects.reduce((sum, p) => sum + (p.predictive_risk_index || 0), 0) / projects.length) : 0;
  const highRiskCount = projects.filter((p) => (p.predictive_risk_index || 0) >= 30).length;

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const getRiskBadge = (risk) => {
    const val = parseFloat(risk || 0);
    if (val >= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-red-950/80 text-red-300 border border-red-700/50">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          HIGH RISK ({val.toFixed(1)})
        </span>
      );
    } else if (val >= 15) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          MEDIUM RISK ({val.toFixed(1)})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          LOW RISK ({val.toFixed(1)})
        </span>
      );
    }
  };

  return (
    <div className="dashboard-container space-y-6">
      {/* 1. KPI Cards Row (Preserving current look) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="metric-card bg-gray-900/60 border border-gray-800 p-4 rounded-xl">
          <div className="text-xs font-medium text-gray-400">Total Filtered Projects</div>
          <div className="text-2xl font-bold text-amber-400 my-1">
            {totalCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">MoSPI Ongoing Registry</div>
        </div>

        <div className="metric-card bg-gray-900/60 border border-gray-800 p-4 rounded-xl">
          <div className="text-xs font-medium text-gray-400">Sample Revised Outlay</div>
          <div className="text-2xl font-bold text-gray-100 my-1">
            ₹{totalOutlay.toFixed(1)} Cr
          </div>
          <div className="text-xs text-gray-500">Current View Total</div>
        </div>

        <div className="metric-card bg-gray-900/60 border border-gray-800 p-4 rounded-xl">
          <div className="text-xs font-medium text-gray-400">Avg Physical Progress</div>
          <div className="text-2xl font-bold text-emerald-400 my-1">
            {avgProgress.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Work Completed</div>
        </div>

        <div className="metric-card bg-gray-900/60 border border-gray-800 p-4 rounded-xl">
          <div className="text-xs font-medium text-gray-400">Avg Predictive Risk</div>
          <div className="text-2xl font-bold text-red-400 my-1">
            {avgRisk.toFixed(1)} / 100
          </div>
          <div className="text-xs text-gray-500">Calibrated ML Index</div>
        </div>

        <div className="metric-card bg-gray-900/60 border border-gray-800 p-4 rounded-xl">
          <div className="text-xs font-medium text-gray-400">High Risk Projects</div>
          <div className="text-2xl font-bold text-red-500 my-1">
            {highRiskCount}
          </div>
          <div className="text-xs text-gray-500">Risk Score ≥ 30</div>
        </div>
      </div>

      {/* 2. Filters Bar */}
      <div className="filter-bar bg-gray-900/40 border border-gray-800 p-4 rounded-xl space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search Project ID, Name or Ministry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <select
              value={ministry}
              onChange={(e) => { setMinistry(e.target.value); setPage(1); }}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Ministries</option>
              {ministriesList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={sector}
              onChange={(e) => { setSector(e.target.value); setPage(1); }}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Sectors</option>
              {sectorsList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={riskBand}
              onChange={(e) => { setRiskBand(e.target.value); setPage(1); }}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Risk Bands</option>
              <option value="HIGH">High Risk (≥ 30)</option>
              <option value="MEDIUM">Medium Risk (15-30)</option>
              <option value="LOW">Low Risk (&lt; 15)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="delayedOnly"
              checked={delayedOnly}
              onChange={(e) => { setDelayedOnly(e.target.checked); setPage(1); }}
              className="rounded bg-gray-950 border-gray-800 text-amber-500 focus:ring-0"
            />
            <label htmlFor="delayedOnly" className="text-xs text-gray-300 font-medium cursor-pointer">
              Ongoing / Delayed Only
            </label>
          </div>
        </form>
      </div>

      {/* 3. Project Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading project registry from API...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No projects match the selected filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const riskVal = parseFloat(proj.predictive_risk_index || 0);
            const recovVal = parseFloat(proj.recoverability_score || 0);
            const progVal = parseFloat(proj.physical_progress || 0);

            return (
              <div
                key={proj.id}
                className="project-card bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {/* CRITICAL FIX: Stop legacy code / ProjectId wrapping mid-code */}
                    <span className="font-mono text-xs text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 whitespace-nowrap overflow-hidden text-ellipsis">
                      ID #{proj.id}
                    </span>
                    {getRiskBadge(riskVal)}
                  </div>

                  <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 mb-2" title={proj.project_name}>
                    {proj.project_name}
                  </h3>

                  <div className="space-y-1 text-xs text-gray-400 mb-3">
                    <div className="flex items-center justify-between">
                      <span>Ministry:</span>
                      <span className="text-gray-200 truncate max-w-[180px]">{proj.line_ministry || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Sector:</span>
                      <span className="text-gray-200 truncate max-w-[180px]">{proj.sector_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Revised Outlay:</span>
                      <span className="text-amber-300 font-mono">₹{parseFloat(proj.revised_cost || proj.original_cost || 0).toFixed(1)} Cr</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-gray-400">Physical Progress</span>
                      <span className="text-emerald-400 font-bold">{progVal.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-950 rounded-full h-2 overflow-hidden border border-gray-800">
                      <div
                        className="bg-gradient-to-r from-emerald-600 to-amber-500 h-2 rounded-full"
                        style={{ width: `${Math.min(progVal, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-gray-400">Recoverability: </span>
                    <span className="font-mono text-emerald-400 font-semibold">{recovVal.toFixed(1)}/100</span>
                  </div>

                  <button
                    onClick={() => onSelectProject(proj.id)}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    Diagnose & Simulate →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Server-Side Pagination Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800 text-xs">
        <div className="text-gray-400">
          Showing <span className="text-gray-200 font-mono">{((page - 1) * limit) + 1}</span> to{' '}
          <span className="text-gray-200 font-mono">{Math.min(page * limit, totalCount)}</span> of{' '}
          <span className="text-amber-400 font-mono">{totalCount}</span> projects
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-gray-900 border border-gray-800 rounded disabled:opacity-50 hover:border-amber-500"
          >
            ← Previous
          </button>

          <span className="text-gray-300 font-mono px-2">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-gray-900 border border-gray-800 rounded disabled:opacity-50 hover:border-amber-500"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};
