/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Zap,
  Flame,
  Radio,
  BarChart3,
  Layers,
  Cpu,
  Code2
} from 'lucide-react';
import { PipelineMetrics } from '../types.js';

interface HeaderProps {
  activeTab: 'stream' | 'grafana' | 'research' | 'spark' | 'code';
  onSelectTab: (tab: 'stream' | 'grafana' | 'research' | 'spark' | 'code') => void;
  metrics: PipelineMetrics | null;
  onControl: (action: 'pause' | 'resume' | 'set_speed' | 'inject_failure' | 'reset', value?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  metrics,
  onControl
}) => {
  const isPaused = metrics?.isPaused ?? false;
  const speed = metrics?.simulationSpeed ?? 1;
  const failureMode = metrics?.failureMode ?? 'none';
  const activeAlerts = metrics?.activeAlertsCount ?? 0;

  return (
    <header className="border-b border-slate-800 bg-slate-950 text-slate-100 sticky top-0 z-40 shadow-md">
      {/* Top Utility & Control Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80">
        {/* Brand & Project Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-sm text-slate-100">
                Apache Kafka & Spark Streaming Pipeline
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Real-Time LLM Hallucination Profiler
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Distributed Claim-Level Verification with Prometheus &amp; Grafana Observability
            </p>
          </div>
        </div>

        {/* Live Cluster Status & Telemetry Strip */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
            <span className="text-slate-400 font-mono">Stream:</span>
            <span className="font-medium text-slate-200">
              {isPaused ? 'PAUSED' : `${metrics?.currentThroughputMsgSec || 45} msg/s`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400 font-mono">p95 Latency:</span>
            <span className="font-medium text-slate-200">{metrics?.p95LatencyMs || 0} ms</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400 font-mono">Spark Batch:</span>
            <span className="font-medium text-slate-200">{metrics?.sparkProcessingDelayMs || 0} ms</span>
          </div>

          {/* Active Alerts Pill */}
          <button
            onClick={() => onSelectTab('grafana')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-colors ${
              activeAlerts > 0
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${activeAlerts > 0 ? 'text-rose-400 animate-bounce' : 'text-emerald-400'}`} />
            <span>Alerts: {activeAlerts}</span>
          </button>
        </div>

        {/* Engine Controls & Chaos Engineering */}
        <div className="flex items-center gap-2">
          {/* Pause / Resume */}
          <button
            onClick={() => onControl(isPaused ? 'resume' : 'pause')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium border text-xs transition-all ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Simulation Speed */}
          <div className="flex items-center rounded border border-slate-800 bg-slate-900 overflow-hidden">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => onControl('set_speed', s)}
                className={`px-2 py-1 text-[11px] font-mono transition-colors ${
                  speed === s
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Chaos / Fault Injection */}
          <div className="relative flex items-center">
            <label htmlFor="chaos-select" className="sr-only">Chaos Injection</label>
            <select
              id="chaos-select"
              value={failureMode}
              onChange={(e) => onControl('inject_failure', e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="none">⚡ Normal (Healthy)</option>
              <option value="kafka_lag_spike">🔥 Kafka Lag Spike (&gt;400)</option>
              <option value="spark_worker_oom">💥 Spark Worker OOM &amp; Spill</option>
              <option value="nli_timeout">⏱️ NLI Model Slowdown</option>
            </select>
          </div>

          {/* Reset */}
          <button
            onClick={() => onControl('reset')}
            title="Reset Pipeline & Metrics"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto">
        <nav className="flex items-center space-x-1 py-1">
          <button
            onClick={() => onSelectTab('stream')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
              activeTab === 'stream'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Real-Time Stream Analytics</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-1" />
          </button>

          <button
            onClick={() => onSelectTab('grafana')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
              activeTab === 'grafana'
                ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Grafana &amp; Prometheus Observability</span>
            {activeAlerts > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {activeAlerts}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('research')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
              activeTab === 'research'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Hallucination Profiler &amp; Scalability (RQ1–RQ5)</span>
          </button>

          <button
            onClick={() => onSelectTab('spark')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
              activeTab === 'spark'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Spark Cluster &amp; DAG Execution</span>
          </button>

          <button
            onClick={() => onSelectTab('code')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
              activeTab === 'code'
                ? 'border-slate-300 text-slate-100 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Production Pipeline Code &amp; Docker</span>
          </button>
        </nav>

        {/* Direct Prometheus /api/metrics Link */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <a
            href="/api/metrics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400 transition-colors text-[11px] font-mono"
            title="Inspect raw Prometheus OpenMetrics text endpoint"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            <span>/api/metrics</span>
          </a>
        </div>
      </div>
    </header>
  );
};
