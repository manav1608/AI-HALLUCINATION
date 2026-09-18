/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import {
  BarChart3,
  Activity,
  AlertTriangle,
  Terminal,
  FileCode,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Server,
  Zap,
  Clock,
  Layers,
  Sliders,
  Gauge,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Bell,
  Sparkles,
  ArrowUpRight,
  History,
  FileText,
  Download,
  Search,
  Filter,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  PipelineMetrics,
  SparkMicroBatch,
  KafkaPartitionStats,
  PrometheusAlert,
  ModelComparisonStats,
  AlertThresholds,
  AlertHistoryEvent,
  KafkaPartitionLagPoint,
  DomainComparisonStats,
  DifficultyStats,
  StatisticalResults
} from '../types.js';
import { formatBytes, formatTimestamp } from '../utils/formatters.js';
import { KafkaPartitionLagD3 } from './KafkaPartitionLagD3.js';
import { PrintableReportModal } from './PrintableReportModal.js';

interface GrafanaDashboardProps {
  metrics: PipelineMetrics | null;
  batches: SparkMicroBatch[];
  partitions: KafkaPartitionStats[];
  alerts: PrometheusAlert[];
  modelStats: ModelComparisonStats[];
  thresholds?: AlertThresholds;
  onUpdateThresholds?: (thresholds: AlertThresholds) => void;
  alertHistory?: AlertHistoryEvent[];
  kafkaLagHistory?: KafkaPartitionLagPoint[];
  domainStats?: DomainComparisonStats[];
  difficultyStats?: DifficultyStats[];
  statisticalResults?: StatisticalResults | null;
}

const defaultThresholds: AlertThresholds = {
  pipelineLatencyMs: 650,
  sparkBatchDelayMs: 2000,
  claimErrorRate: 0.35,
  responseErrorRate: 0.45,
  kafkaLag: 250,
};

export const GrafanaDashboard: React.FC<GrafanaDashboardProps> = ({
  metrics,
  batches,
  partitions,
  alerts,
  modelStats,
  thresholds,
  onUpdateThresholds,
  alertHistory = [],
  kafkaLagHistory = [],
  domainStats = [],
  difficultyStats = [],
  statisticalResults = null
}) => {
  const [subView, setSubView] = useState<'panels' | 'alert_history' | 'promql' | 'metrics_exporter'>('panels');
  const [timeRange, setTimeRange] = useState('Last 15 minutes');
  const [refreshInterval, setRefreshInterval] = useState('5s');

  // Threshold controls state
  const [localThresholds, setLocalThresholds] = useState<AlertThresholds>(
    thresholds || defaultThresholds
  );
  const [showThresholdManager, setShowThresholdManager] = useState(true);
  const [activePreset, setActivePreset] = useState<string>('Standard');

  // Interactive SLA Latency & Instability Overlay state
  const [showInstabilityOverlay, setShowInstabilityOverlay] = useState<boolean>(true);
  const [selectedInstabilityPoint, setSelectedInstabilityPoint] = useState<any>(null);

  // Alert History UI state
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [alertStatusFilter, setAlertStatusFilter] = useState<'all' | 'firing' | 'resolved'>('all');
  const [alertSearchQuery, setAlertSearchQuery] = useState('');
  const [showAlertHistoryDrawer, setShowAlertHistoryDrawer] = useState(true);

  // Printable Report Modal state
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (thresholds) {
      setLocalThresholds(thresholds);
    }
  }, [thresholds]);

  const handleThresholdChange = (key: keyof AlertThresholds, value: number) => {
    const updated = { ...localThresholds, [key]: value };
    setLocalThresholds(updated);
    setActivePreset('Custom');
    if (onUpdateThresholds) {
      onUpdateThresholds(updated);
    }
  };

  const applyPreset = (name: string, preset: AlertThresholds) => {
    setLocalThresholds(preset);
    setActivePreset(name);
    if (onUpdateThresholds) {
      onUpdateThresholds(preset);
    }
  };

  const PRESET_PROFILES: { name: string; desc: string; thresholds: AlertThresholds }[] = [
    {
      name: 'Strict SLA',
      desc: 'Tight latency & low error tolerance for mission-critical apps',
      thresholds: {
        pipelineLatencyMs: 450,
        sparkBatchDelayMs: 1200,
        claimErrorRate: 0.20,
        responseErrorRate: 0.30,
        kafkaLag: 150,
      }
    },
    {
      name: 'Standard',
      desc: 'Balanced production baseline for continuous real-time analytics',
      thresholds: {
        pipelineLatencyMs: 650,
        sparkBatchDelayMs: 2000,
        claimErrorRate: 0.35,
        responseErrorRate: 0.45,
        kafkaLag: 250,
      }
    },
    {
      name: 'High Throughput',
      desc: 'Relaxed latency limits accommodating bursty ingestion spikes',
      thresholds: {
        pipelineLatencyMs: 1100,
        sparkBatchDelayMs: 3500,
        claimErrorRate: 0.50,
        responseErrorRate: 0.60,
        kafkaLag: 450,
      }
    },
    {
      name: 'Trigger Alerts Test',
      desc: 'Sensitive limits to immediately test alert firing & Alertmanager routing',
      thresholds: {
        pipelineLatencyMs: 300,
        sparkBatchDelayMs: 400,
        claimErrorRate: 0.12,
        responseErrorRate: 0.22,
        kafkaLag: 40,
      }
    }
  ];

  // PromQL console state
  const [promQuery, setPromQuery] = useState('rate(kafka_records_consumed_total[1m])');
  const [promResult, setPromResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  // Raw Prometheus metrics text state
  const [rawMetricsText, setRawMetricsText] = useState('');
  const [copiedMetrics, setCopiedMetrics] = useState(false);

  // Fetch raw metrics text when viewing exporter
  useEffect(() => {
    if (subView === 'metrics_exporter') {
      fetch('/api/metrics')
        .then((res) => res.text())
        .then((text) => setRawMetricsText(text))
        .catch((err) => setRawMetricsText(`Error fetching metrics: ${err.message}`));
    }
  }, [subView, metrics]);

  // Execute PromQL query
  const handleExecutePromQL = async (queryToRun?: string) => {
    const q = queryToRun || promQuery;
    setIsQuerying(true);
    try {
      const res = await fetch(`/api/prometheus/query?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPromResult(data);
    } catch (err: any) {
      setPromResult({ status: 'error', error: err.message });
    } finally {
      setIsQuerying(false);
    }
  };

  useEffect(() => {
    handleExecutePromQL(promQuery);
  }, []);

  const handleCopyMetrics = () => {
    navigator.clipboard.writeText(rawMetricsText);
    setCopiedMetrics(true);
    setTimeout(() => setCopiedMetrics(false), 2000);
  };

  // Prepare timeseries chart data from batches
  const batchTimeseriesData = [...batches].reverse().map((b) => ({
    time: formatTimestamp(b.timestamp),
    durationMs: b.durationMs,
    records: b.recordsProcessed,
    claims: b.claimsProcessed,
    shuffleMB: Number((b.shuffleReadBytes / (1024 * 1024)).toFixed(2)),
    spillMB: b.memorySpillMb,
    slaThreshold: localThresholds.sparkBatchDelayMs,
  }));

  // Fallback initial alert history if server hasn't accumulated transitions yet
  const effectiveAlertHistory: AlertHistoryEvent[] = useMemo(() => {
    if (alertHistory && alertHistory.length > 0) {
      return alertHistory;
    }
    // Seeded history events for immediate observability demonstration
    const now = Date.now();
    return [
      {
        id: 'HIST-E2E-001',
        alertId: 'ALT-E2E-LATENCY',
        name: 'PipelineEndToEndLatencyHigh',
        metric: 'pipeline_e2e_latency_ms',
        severity: 'critical',
        state: 'firing',
        timestamp: now - 1000 * 60 * 3, // 3m ago
        value: 785,
        threshold: localThresholds.pipelineLatencyMs,
        unit: 'ms',
        description: `E2E P95 latency (785ms) exceeded configured SLA threshold (${localThresholds.pipelineLatencyMs}ms). NLI cross-encoder model contention detected.`,
      },
      {
        id: 'HIST-KAFKA-002',
        alertId: 'ALT-KAFKA-LAG',
        name: 'KafkaConsumerLagHigh',
        metric: 'sum(kafka_consumer_lag)',
        severity: 'warning',
        state: 'resolved',
        timestamp: now - 1000 * 60 * 11, // 11m ago
        resolvedAt: now - 1000 * 60 * 7, // 7m ago
        durationSec: 240,
        value: 295,
        threshold: localThresholds.kafkaLag,
        unit: 'msgs',
        description: `Consumer lag peaked at 295 msgs across partitions 1 & 2 before Spark backpressure scaling cleared buffer backlog.`,
      },
      {
        id: 'HIST-SPARK-003',
        alertId: 'ALT-SPARK-DELAY',
        name: 'SparkMicroBatchDelayHigh',
        metric: 'spark_streaming_batch_duration_ms',
        severity: 'warning',
        state: 'resolved',
        timestamp: now - 1000 * 60 * 25, // 25m ago
        resolvedAt: now - 1000 * 60 * 22, // 22m ago
        durationSec: 180,
        value: 2350,
        threshold: localThresholds.sparkBatchDelayMs,
        unit: 'ms',
        description: `Micro-batch processing duration (2350ms) exceeded SLA limit due to Wikipedia KILT broadcast table re-indexing.`,
      }
    ];
  }, [alertHistory, localThresholds.pipelineLatencyMs, localThresholds.kafkaLag, localThresholds.sparkBatchDelayMs]);

  // Filter alert history
  const filteredAlertHistory = useMemo(() => {
    return effectiveAlertHistory.filter((evt) => {
      const state = evt.state || evt.status || 'resolved';
      const name = evt.name || evt.alertname || '';
      const metric = evt.metric || '';
      if (alertSeverityFilter !== 'all' && evt.severity !== alertSeverityFilter) {
        return false;
      }
      if (alertStatusFilter !== 'all' && state !== alertStatusFilter) {
        return false;
      }
      if (alertSearchQuery.trim()) {
        const query = alertSearchQuery.toLowerCase();
        const matchesName = name.toLowerCase().includes(query);
        const matchesDesc = (evt.description || '').toLowerCase().includes(query);
        const matchesMetric = metric.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesMetric) return false;
      }
      return true;
    });
  }, [effectiveAlertHistory, alertSeverityFilter, alertStatusFilter, alertSearchQuery]);

  // Latency timeseries with real-time instability zones compared to user-defined threshold
  const currentP95 = metrics?.p95LatencyMs || 580;
  const currentP99 = metrics?.p99LatencyMs || 790;
  const currentAvg = metrics?.avgE2ELatencyMs || 320;
  const latencyLimit = localThresholds.pipelineLatencyMs;

  const latencyTrendData = useMemo(() => {
    // 12 timeline steps from 22m ago to now
    const timelineOffsets = [
      { label: '22m ago', offset: -110, spike: 0 },
      { label: '20m ago', offset: -90, spike: 0 },
      { label: '18m ago', offset: -70, spike: 0 },
      { label: '16m ago', offset: +40, spike: 85 },   // Instability window 1 start
      { label: '14m ago', offset: +110, spike: 140 }, // Peak instability spike
      { label: '12m ago', offset: +35, spike: 65 },   // Instability recovery
      { label: '10m ago', offset: -50, spike: 0 },
      { label: '8m ago', offset: -75, spike: 0 },
      { label: '6m ago', offset: -45, spike: 0 },
      { label: '4m ago', offset: -20, spike: currentP95 > latencyLimit ? 50 : 0 },
      { label: '2m ago', offset: -10, spike: currentP95 > latencyLimit ? 35 : 0 },
      { label: 'now', offset: 0, spike: 0 }
    ];

    return timelineOffsets.map((step) => {
      // Calculate P95 anchored on current metrics
      const p95Val = Math.max(180, currentP95 + step.offset + step.spike);
      const p50Val = Math.max(110, Math.round(p95Val * 0.52));
      const p99Val = Math.max(p95Val + 60, Math.round(p95Val * 1.25));
      const isBreached = p95Val > latencyLimit;
      const breachDelta = Math.max(0, p95Val - latencyLimit);

      return {
        time: step.label,
        p50: p50Val,
        p95: p95Val,
        p99: p99Val,
        threshold: latencyLimit,
        isBreached,
        breachDelta,
        excessLatency: isBreached ? breachDelta : 0,
        instabilityShade: isBreached ? p95Val : null,
        status: isBreached ? 'UNSTABLE' : 'STABLE'
      };
    });
  }, [currentP95, latencyLimit]);

  // Instability analysis calculations
  const instabilityAnalysis = useMemo(() => {
    const breaches = latencyTrendData.filter((d) => d.isBreached);
    const breachCount = breaches.length;
    const maxBreach = breaches.reduce((max, b) => Math.max(max, b.breachDelta), 0);
    const peakLatency = breaches.reduce((max, b) => Math.max(max, b.p95), 0);
    const compliancePct = Math.round(((latencyTrendData.length - breachCount) / latencyTrendData.length) * 100);
    const isCurrentlyUnstable = latencyTrendData[latencyTrendData.length - 1]?.isBreached || false;

    return {
      breachCount,
      maxBreach,
      peakLatency,
      compliancePct,
      isCurrentlyUnstable
    };
  }, [latencyTrendData]);

  // Model comparison data for panel
  const modelHallucinationChartData = modelStats.map((m) => ({
    name: m.model,
    claimHR: Number((m.claimHallucinationRate * 100).toFixed(1)),
    ragHR: Number((m.ragClaimHR * 100).toFixed(1)),
    nonRagHR: Number((m.nonRagClaimHR * 100).toFixed(1)),
    responseHR: Number((m.responseHallucinationRate * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      {/* Grafana Navigation & View Switcher Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-100 text-sm">
                Grafana &amp; Prometheus Telemetry Platform
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20">
                PROMETHEUS v2.51.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              End-to-End Distributed Stream Observability, SLA Monitoring, &amp; Alertmanager
            </p>
          </div>
        </div>

        {/* Sub-view switch & Threshold Tuner toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSubView('panels')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                subView === 'panels'
                  ? 'bg-orange-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Grafana Panels</span>
            </button>

            <button
              onClick={() => setSubView('alert_history')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                subView === 'alert_history'
                  ? 'bg-orange-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Alert History</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                effectiveAlertHistory.filter(a => (a.state || a.status) === 'firing').length > 0
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {effectiveAlertHistory.length}
              </span>
            </button>

            <button
              onClick={() => setSubView('promql')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                subView === 'promql'
                  ? 'bg-orange-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>PromQL Explorer</span>
            </button>

            <button
              onClick={() => setSubView('metrics_exporter')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                subView === 'metrics_exporter'
                  ? 'bg-orange-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>/api/metrics</span>
            </button>
          </div>

          {/* Export PDF Report Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all border border-indigo-500/50"
            title="Export analytical metrics and statistics as printable PDF report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          {/* Visual Threshold Tuner Toggle */}
          <button
            onClick={() => setShowThresholdManager(!showThresholdManager)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              showThresholdManager
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm ring-1 ring-amber-500/30'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Toggle Visual Alert Threshold Limits & SLA Configuration"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Threshold Tuner</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/30 text-amber-200">
              {activePreset}
            </span>
            {showThresholdManager ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Timepicker */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="Last 5 minutes">Last 5 minutes</option>
            <option value="Last 15 minutes">Last 15 minutes</option>
            <option value="Last 1 hour">Last 1 hour</option>
            <option value="Last 6 hours">Last 6 hours</option>
          </select>
        </div>
      </div>

      {/* VIEW 1: GRAFANA PANELS GRID */}
      {subView === 'panels' && (
        <div className="space-y-6">
          {/* SECTION A: VISUAL ALERT THRESHOLDS & SLA GOVERNANCE */}
          {showThresholdManager && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 shadow-lg space-y-5">
              {/* Header with Presets & Action Buttons */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-800 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-100 text-sm">
                      Visual Alert Threshold &amp; SLA Limit Governance
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-amber-500/30">
                      LIVE EVALUATION
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Interactively adjust pipeline latency ceilings, Spark micro-batch SLA targets, and error rate alert triggers. Changes propagate dynamically to Prometheus rules and charts.
                  </p>
                </div>

                {/* Preset Profiles */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
                  </span>
                  {PRESET_PROFILES.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset.name, preset.thresholds)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                        activePreset === preset.name
                          ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                      title={preset.desc}
                    >
                      {preset.name}
                    </button>
                  ))}
                  <button
                    onClick={() => applyPreset('Standard', defaultThresholds)}
                    className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                    title="Reset to default thresholds"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Threshold Sliders & Controls Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Column 1: Pipeline Latency Thresholds */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                        Pipeline Latency &amp; Execution SLA Limits
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Response &amp; Compute Time</span>
                  </div>

                  {/* Latency Threshold 1: End-to-End P95 Latency */}
                  {(() => {
                    const currentP95 = metrics?.p95LatencyMs || 0;
                    const limit = localThresholds.pipelineLatencyMs;
                    const isBreached = currentP95 > limit;
                    const usagePercent = Math.min(100, Math.round((currentP95 / limit) * 100));

                    return (
                      <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-200 text-xs block">
                              P95 End-to-End Latency SLA Limit
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              pipeline_e2e_latency_ms&#123;quantile="0.95"&#125;
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                              isBreached
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isBreached ? 'Alert Firing' : 'Within SLA'}
                          </span>
                        </div>

                        {/* Current vs Limit Numbers */}
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400">
                            Current P95: <strong className={isBreached ? 'text-rose-400' : 'text-blue-400'}>{currentP95} ms</strong>
                          </span>
                          <span className="text-slate-300 font-semibold">
                            Alert Threshold: <strong className="text-amber-400">{limit} ms</strong>
                          </span>
                        </div>

                        {/* Gauge bar */}
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isBreached ? 'bg-rose-500' : usagePercent > 80 ? 'bg-amber-400' : 'bg-blue-500'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>

                        {/* Visual Range Slider & Stepper */}
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="200"
                            max="1500"
                            step="25"
                            value={limit}
                            onChange={(e) => handleThresholdChange('pipelineLatencyMs', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleThresholdChange('pipelineLatencyMs', Math.max(200, limit - 50))}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                              title="Decrease 50ms"
                            >
                              -50
                            </button>
                            <input
                              type="number"
                              min="200"
                              max="1500"
                              step="25"
                              value={limit}
                              onChange={(e) => handleThresholdChange('pipelineLatencyMs', Number(e.target.value))}
                              className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 text-xs font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleThresholdChange('pipelineLatencyMs', Math.min(1500, limit + 50))}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                              title="Increase 50ms"
                            >
                              +50
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Latency Threshold 2: Spark Micro-Batch Processing Duration */}
                  {(() => {
                    const currentDelay = metrics?.sparkProcessingDelayMs || 0;
                    const limit = localThresholds.sparkBatchDelayMs;
                    const isBreached = currentDelay > limit;
                    const usagePercent = Math.min(100, Math.round((currentDelay / limit) * 100));

                    return (
                      <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-200 text-xs block">
                              Spark Micro-Batch Duration Limit
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              spark_streaming_batch_duration_ms
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                              isBreached
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isBreached ? 'Alert Firing' : 'Within SLA'}
                          </span>
                        </div>

                        {/* Current vs Limit Numbers */}
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400">
                            Current Batch Delay: <strong className={isBreached ? 'text-rose-400' : 'text-purple-400'}>{currentDelay} ms</strong>
                          </span>
                          <span className="text-slate-300 font-semibold">
                            Alert Threshold: <strong className="text-amber-400">{limit} ms</strong>
                          </span>
                        </div>

                        {/* Gauge bar */}
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isBreached ? 'bg-rose-500' : usagePercent > 80 ? 'bg-amber-400' : 'bg-purple-500'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>

                        {/* Visual Range Slider & Stepper */}
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="400"
                            max="4000"
                            step="50"
                            value={limit}
                            onChange={(e) => handleThresholdChange('sparkBatchDelayMs', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleThresholdChange('sparkBatchDelayMs', Math.max(400, limit - 100))}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                              title="Decrease 100ms"
                            >
                              -100
                            </button>
                            <input
                              type="number"
                              min="400"
                              max="4000"
                              step="50"
                              value={limit}
                              onChange={(e) => handleThresholdChange('sparkBatchDelayMs', Number(e.target.value))}
                              className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 text-xs font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleThresholdChange('sparkBatchDelayMs', Math.min(4000, limit + 100))}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                              title="Increase 100ms"
                            >
                              +100
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Column 2: Error Rate & Buffer Queue Thresholds */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                        Factuality Error Rates &amp; Queue Tolerances
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Model Quality &amp; Backpressure</span>
                  </div>

                  {/* Error Threshold 1: Claim-Level Factuality Error Rate */}
                  {(() => {
                    const currentClaimHr = (metrics?.globalHRClaim || 0) * 100;
                    const limitPercent = Math.round(localThresholds.claimErrorRate * 100);
                    const isBreached = currentClaimHr > limitPercent;
                    const usagePercent = Math.min(100, Math.round((currentClaimHr / limitPercent) * 100));

                    return (
                      <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-200 text-xs block">
                              Claim Error Rate (HR_claim) Limit
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              sum(claims_refuted_total) / sum(claims_verifiable_total)
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                              isBreached
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isBreached ? 'Alert Firing' : 'Within Tolerance'}
                          </span>
                        </div>

                        {/* Current vs Limit Numbers */}
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400">
                            Current Claim Error: <strong className={isBreached ? 'text-rose-400' : 'text-orange-400'}>{currentClaimHr.toFixed(1)}%</strong>
                          </span>
                          <span className="text-slate-300 font-semibold">
                            Alert Threshold: <strong className="text-amber-400">{limitPercent}%</strong>
                          </span>
                        </div>

                        {/* Gauge bar */}
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isBreached ? 'bg-rose-500' : usagePercent > 80 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>

                        {/* Visual Range Slider & Stepper */}
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="5"
                            max="75"
                            step="1"
                            value={limitPercent}
                            onChange={(e) => handleThresholdChange('claimErrorRate', Number(e.target.value) / 100)}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleThresholdChange('claimErrorRate', Math.max(0.05, (limitPercent - 5) / 100))}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                              title="Decrease 5%"
                            >
                              -5%
                            </button>
                            <input
                              type="number"
                              min="5"
                              max="75"
                              step="1"
                              value={limitPercent}
                              onChange={(e) => handleThresholdChange('claimErrorRate', Number(e.target.value) / 100)}
                              className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-300 text-xs font-mono text-center focus:outline-none focus:border-amber-500"
                            />
                            <button
                              onClick={() => handleThresholdChange('claimErrorRate', Math.min(0.75, (limitPercent + 5) / 100))}
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                              title="Increase 5%"
                            >
                              +5%
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Error Threshold 2: Full Response Error Rate & Kafka Lag */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Response Error Rate */}
                    {(() => {
                      const currentRespHr = (metrics?.globalHRResponse || 0) * 100;
                      const limitPercent = Math.round(localThresholds.responseErrorRate * 100);
                      const isBreached = currentRespHr > limitPercent;

                      return (
                        <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 text-xs">Response HR Limit</span>
                            <span className={`text-[10px] font-mono font-bold ${isBreached ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isBreached ? 'Firing' : 'OK'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                            <span>Now: <strong className={isBreached ? 'text-rose-400' : 'text-slate-300'}>{currentRespHr.toFixed(1)}%</strong></span>
                            <span>Limit: <strong className="text-amber-400">{limitPercent}%</strong></span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="85"
                            step="1"
                            value={limitPercent}
                            onChange={(e) => handleThresholdChange('responseErrorRate', Number(e.target.value) / 100)}
                            className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      );
                    })()}

                    {/* Kafka Lag Threshold */}
                    {(() => {
                      const currentLag = metrics?.consumerLagTotal || 0;
                      const limitLag = localThresholds.kafkaLag;
                      const isBreached = currentLag > limitLag;

                      return (
                        <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 text-xs">Kafka Lag Limit</span>
                            <span className={`text-[10px] font-mono font-bold ${isBreached ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isBreached ? 'Firing' : 'OK'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                            <span>Now: <strong className={isBreached ? 'text-rose-400' : 'text-cyan-400'}>{currentLag} msgs</strong></span>
                            <span>Limit: <strong className="text-amber-400">{limitLag} msgs</strong></span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="600"
                            step="10"
                            value={limitLag}
                            onChange={(e) => handleThresholdChange('kafkaLag', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION B: PROMETHEUS ALERT RULES STATUS STRIP WITH DIRECT ADJUSTMENT */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-slate-100 text-xs">
                  Prometheus Alert Rules &amp; Alertmanager Status
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400">
                  Evaluating {alerts.length} Rules dynamically
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {alerts.map((al) => {
                const isFiring = al.state === 'firing';

                // Map alert to corresponding threshold control
                let sliderControl = null;
                if (al.id === 'ALT-E2E-LATENCY') {
                  sliderControl = (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Tune Limit:</span>
                        <strong className="text-amber-400">{localThresholds.pipelineLatencyMs} ms</strong>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="1500"
                        step="25"
                        value={localThresholds.pipelineLatencyMs}
                        onChange={(e) => handleThresholdChange('pipelineLatencyMs', Number(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  );
                } else if (al.id === 'ALT-SPARK-DELAY') {
                  sliderControl = (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Tune Limit:</span>
                        <strong className="text-amber-400">{localThresholds.sparkBatchDelayMs} ms</strong>
                      </div>
                      <input
                        type="range"
                        min="400"
                        max="4000"
                        step="50"
                        value={localThresholds.sparkBatchDelayMs}
                        onChange={(e) => handleThresholdChange('sparkBatchDelayMs', Number(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  );
                } else if (al.id === 'ALT-HIGH-HR') {
                  sliderControl = (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Tune Limit:</span>
                        <strong className="text-amber-400">{(localThresholds.claimErrorRate * 100).toFixed(0)}%</strong>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="75"
                        step="1"
                        value={Math.round(localThresholds.claimErrorRate * 100)}
                        onChange={(e) => handleThresholdChange('claimErrorRate', Number(e.target.value) / 100)}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  );
                } else if (al.id === 'ALT-RESP-HR') {
                  sliderControl = (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Tune Limit:</span>
                        <strong className="text-amber-400">{(localThresholds.responseErrorRate * 100).toFixed(0)}%</strong>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="85"
                        step="1"
                        value={Math.round(localThresholds.responseErrorRate * 100)}
                        onChange={(e) => handleThresholdChange('responseErrorRate', Number(e.target.value) / 100)}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  );
                } else if (al.id === 'ALT-KAFKA-LAG') {
                  sliderControl = (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Tune Limit:</span>
                        <strong className="text-amber-400">{localThresholds.kafkaLag} msgs</strong>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="600"
                        step="10"
                        value={localThresholds.kafkaLag}
                        onChange={(e) => handleThresholdChange('kafkaLag', Number(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={al.id}
                    className={`rounded-lg border p-3 space-y-1.5 text-xs transition-all flex flex-col justify-between ${
                      isFiring
                        ? 'bg-rose-950/30 border-rose-600/60 shadow-sm ring-1 ring-rose-500/20'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-200 truncate text-[11px]">
                          {al.alertname}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isFiring
                              ? 'bg-rose-500 text-white animate-pulse'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {al.state}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-1">{al.description}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-slate-800/80">
                        <span className="text-slate-400">
                          Current: <strong className={isFiring ? 'text-rose-400 font-bold' : 'text-slate-200'}>{al.currentVal} {al.unit}</strong>
                        </span>
                        <span className="text-slate-400">Limit: {al.threshold} {al.unit}</span>
                      </div>

                      {sliderControl}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION C: PERSISTED PROMETHEUS ALERT HISTORY TABLE & AUDIT LOG */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-orange-400" />
                <h3 className="font-semibold text-slate-100 text-xs">
                  Alert History &amp; Prometheus State Transitions Journal
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {filteredAlertHistory.length} Events
                </span>
                {filteredAlertHistory.some(a => a.state === 'firing') && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Firing In Window
                  </span>
                )}
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Severity Filter */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px]">
                  {(['all', 'critical', 'warning'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setAlertSeverityFilter(sev)}
                      className={`px-2 py-0.5 rounded capitalize transition-colors ${
                        alertSeverityFilter === sev
                          ? 'bg-slate-800 text-amber-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px]">
                  {(['all', 'firing', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setAlertStatusFilter(st)}
                      className={`px-2 py-0.5 rounded capitalize transition-colors ${
                        alertStatusFilter === st
                          ? st === 'firing'
                            ? 'bg-rose-600 text-white font-semibold'
                            : st === 'resolved'
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'bg-slate-800 text-slate-200 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Toggle Collapsible */}
                <button
                  onClick={() => setShowAlertHistoryDrawer(!showAlertHistoryDrawer)}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded text-xs flex items-center gap-1"
                >
                  {showAlertHistoryDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span>{showAlertHistoryDrawer ? 'Collapse' : 'Expand'}</span>
                </button>
              </div>
            </div>

            {showAlertHistoryDrawer && (
              <div className="space-y-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search alert history by rule name, metric, or resolution diagnostic..."
                    value={alertSearchQuery}
                    onChange={(e) => setAlertSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                {/* Alert History Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-3">Timestamp / Age</th>
                        <th className="py-2 px-3">Alert Rule &amp; Metric</th>
                        <th className="py-2 px-3">Severity</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Value vs Limit</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 px-3">Resolution &amp; Diagnosis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredAlertHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500 text-xs font-sans">
                            No alert events match the selected severity and status filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredAlertHistory.map((evt, idx) => {
                          const isFiring = evt.state === 'firing';
                          const ageMin = Math.round((Date.now() - evt.timestamp) / (1000 * 60));
                          return (
                            <tr
                              key={`${evt.id}-${idx}`}
                              className={`hover:bg-slate-800/40 transition-colors ${
                                isFiring ? 'bg-rose-950/15' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 text-slate-300 text-[11px] whitespace-nowrap">
                                <div>{formatTimestamp(evt.timestamp)}</div>
                                <div className="text-[10px] text-slate-500">{ageMin <= 0 ? 'just now' : `${ageMin}m ago`}</div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-semibold text-slate-200">{evt.name}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{evt.metric}</div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    evt.severity === 'critical'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {evt.severity}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                                    isFiring
                                      ? 'bg-rose-500 text-white animate-pulse'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}
                                >
                                  {isFiring ? <AlertCircle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                  {evt.state}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                                <span className={isFiring ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                  {evt.value} {evt.unit}
                                </span>{' '}
                                <span className="text-slate-500">/</span>{' '}
                                <span className="text-slate-400">{evt.threshold} {evt.unit}</span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                                {evt.durationSec ? `${evt.durationSec}s` : isFiring ? 'Active' : '–'}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-xs text-slate-300 min-w-[220px]">
                                <p className="line-clamp-2 text-[11px] leading-relaxed">{evt.description}</p>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 6 Panels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel 1: Spark Micro-Batch Execution Time vs SLA */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">
                    Spark Micro-Batch Execution Duration vs SLA ({localThresholds.sparkBatchDelayMs}ms)
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    spark_streaming_batch_duration_ms&#123;app="FactualHallucinationStream"&#125;
                  </span>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-purple-400 font-bold">
                    {metrics?.sparkProcessingDelayMs || 0} ms
                  </span>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={batchTimeseriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" textAnchor="end" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line
                      type="monotone"
                      dataKey="durationMs"
                      name="Batch Duration (ms)"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="slaThreshold"
                      name={`SLA Threshold (${localThresholds.sparkBatchDelayMs}ms)`}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <ReferenceLine
                      y={localThresholds.sparkBatchDelayMs}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{ value: `SLA Limit: ${localThresholds.sparkBatchDelayMs}ms`, fill: '#fb7185', fontSize: 10, position: 'top' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Panel 2: End-to-End Latency Quantiles with Interactive SLA Instability Overlay */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-100 text-xs">
                      Pipeline Latency Percentiles &amp; SLA Instability
                    </h4>
                    {instabilityAnalysis.breachCount > 0 ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {instabilityAnalysis.breachCount} Spikes
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 100% Compliant
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    pipeline_e2e_latency_ms&#123;quantile=~"0.5|0.95|0.99"&#125;
                  </span>
                </div>

                {/* Instability Overlay Toggle & Current Reading */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInstabilityOverlay(!showInstabilityOverlay)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                      showInstabilityOverlay
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-sm'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Toggle visual instability zone overlay highlighting latency breaches"
                  >
                    {showInstabilityOverlay ? <Eye className="w-3 h-3 text-rose-400" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
                    <span>Instability Overlay</span>
                  </button>

                  <div className="text-right font-mono text-xs">
                    <span className={metrics?.p95LatencyMs && metrics.p95LatencyMs > localThresholds.pipelineLatencyMs ? 'text-rose-400 font-bold' : 'text-blue-400 font-bold'}>
                      p95: {metrics?.p95LatencyMs || 0} ms
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const dataPoint = payload[0].payload;
                          const isBreach = dataPoint.isBreached;
                          return (
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 shadow-xl text-xs space-y-1.5 font-mono">
                              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 font-semibold text-slate-200">
                                <span>{label}</span>
                                {isBreach ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-bold">
                                    <AlertTriangle className="w-2.5 h-2.5" /> SLA BREACH (+{dataPoint.breachDelta}ms)
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                                    WITHIN SLA
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-1">
                                <span className="text-slate-400">P99 Latency:</span>
                                <span className="text-pink-400 text-right">{dataPoint.p99} ms</span>
                                <span className="text-slate-400">P95 Latency:</span>
                                <span className={isBreach ? 'text-rose-400 font-bold text-right' : 'text-blue-400 text-right'}>
                                  {dataPoint.p95} ms
                                </span>
                                <span className="text-slate-400">P50 Median:</span>
                                <span className="text-emerald-400 text-right">{dataPoint.p50} ms</span>
                                <span className="text-slate-400">SLA Threshold:</span>
                                <span className="text-rose-400 text-right">{dataPoint.threshold} ms</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />

                    {/* Instability Zones Highlighted with ReferenceArea */}
                    {showInstabilityOverlay && (
                      <>
                        <ReferenceArea
                          {...({
                            x1: "16m ago",
                            x2: "12m ago",
                            fill: "#f43f5e",
                            fillOpacity: 0.16,
                            stroke: "#f43f5e",
                            strokeDasharray: "3 3"
                          } as any)}
                        />
                        {instabilityAnalysis.isCurrentlyUnstable && (
                          <ReferenceArea
                            {...({
                              x1: "4m ago",
                              x2: "now",
                              fill: "#f43f5e",
                              fillOpacity: 0.16,
                              stroke: "#f43f5e",
                              strokeDasharray: "3 3"
                            } as any)}
                          />
                        )}
                      </>
                    )}

                    <ReferenceLine
                      y={localThresholds.pipelineLatencyMs}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `SLA Limit: ${localThresholds.pipelineLatencyMs}ms`,
                        fill: '#fb7185',
                        fontSize: 10,
                        position: 'insideTopLeft'
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="p99"
                      name="p99 (ms)"
                      stroke="#ec4899"
                      fill="#ec4899"
                      fillOpacity={0.12}
                    />
                    <Area
                      type="monotone"
                      dataKey="p95"
                      name="p95 (ms)"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.25}
                    />
                    <Area
                      type="monotone"
                      dataKey="p50"
                      name="p50 Median (ms)"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.35}
                    />

                    {/* When Instability Overlay is active, add excess latency spike line */}
                    {showInstabilityOverlay && (
                      <Line
                        type="monotone"
                        dataKey="excessLatency"
                        name="Instability Spike (ms > SLA)"
                        stroke="#f43f5e"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#f43f5e', stroke: '#fff', strokeWidth: 1 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive SLA & Instability Diagnostic Center */}
              {showInstabilityOverlay && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">SLA Compliance</div>
                      <div className={`text-sm font-mono font-bold ${instabilityAnalysis.compliancePct >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {instabilityAnalysis.compliancePct}%
                      </div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">Instability Spikes</div>
                      <div className={`text-sm font-mono font-bold ${instabilityAnalysis.breachCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {instabilityAnalysis.breachCount} windows
                      </div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">Max Excursion</div>
                      <div className="text-sm font-mono font-bold text-pink-400">
                        {instabilityAnalysis.maxBreach > 0 ? `+${instabilityAnalysis.maxBreach} ms` : 'Nominal'}
                      </div>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">P95 / SLA Limit</div>
                      <div className="text-sm font-mono font-bold text-slate-200">
                        {metrics?.p95LatencyMs || 0} / {localThresholds.pipelineLatencyMs} ms
                      </div>
                    </div>
                  </div>

                  {/* Interactive Inline Sensitivity Scrubber */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>Adjust SLA Sensitivity to test instability detection:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="250"
                        max="1000"
                        step="25"
                        value={localThresholds.pipelineLatencyMs}
                        onChange={(e) => handleThresholdChange('pipelineLatencyMs', Number(e.target.value))}
                        className="w-36 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-rose-500"
                      />
                      <span className="text-xs font-mono font-bold text-rose-400 w-16 text-right">
                        {localThresholds.pipelineLatencyMs} ms
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Panel 3: Kafka Broker Throughput & Total Consumer Lag */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">
                    Kafka Broker Throughput &amp; Total Consumer Lag
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    kafka_records_consumed_total + sum(kafka_consumer_lag)
                  </span>
                </div>
                <span className="text-cyan-400 font-mono text-xs font-bold">
                  {metrics?.consumerLagTotal || 0} msgs lag
                </span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={partitions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="partitionId"
                      stroke="#64748b"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val, i) => `Part ${val}`}
                    />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="consumerLag" name="Consumer Lag (msgs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="msgRateSec" name="Ingestion Rate (msg/s)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Panel 4: Claim-Level Hallucination Rate by Model with Dynamic ReferenceLine */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="font-semibold text-slate-100 text-xs">
                    Model Hallucination Rate: Non-RAG vs RAG Grounded
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    llm_hallucination_rate_claim&#123;condition=~"rag|non_rag"&#125;
                  </span>
                </div>
                <span className="text-rose-400 font-mono text-xs font-bold">
                  {((metrics?.globalHRClaim || 0) * 100).toFixed(1)}% global
                </span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelHallucinationChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <ReferenceLine
                      y={Number((localThresholds.claimErrorRate * 100).toFixed(1))}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{ value: `Claim Error Limit: ${(localThresholds.claimErrorRate * 100).toFixed(0)}%`, fill: '#fb7185', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <Bar dataKey="nonRagHR" name="Non-RAG Claim HR (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ragHR" name="RAG Grounded Claim HR (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* FEATURED OBSERVABILITY PANEL: REAL-TIME D3 KAFKA CONSUMER LAG TRENDS */}
          <div className="pt-2">
            <KafkaPartitionLagD3
              history={kafkaLagHistory}
              currentPartitions={partitions}
              thresholdLimit={localThresholds.kafkaLag}
            />
          </div>
        </div>
      )}

      {/* VIEW 2: PROMQL INTERACTIVE QUERY CONSOLE */}
      {subView === 'promql' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-orange-400" />
              <span>Prometheus PromQL Expression Browser &amp; Query Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute live PromQL vector queries against the pipeline metrics registry
            </p>
          </div>

          {/* Preset PromQL Queries */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 block">Example PromQL Queries:</span>
            <div className="flex flex-wrap gap-2">
              {[
                'rate(kafka_records_consumed_total[1m])',
                'spark_streaming_batch_duration_ms',
                'llm_hallucination_rate_claim{model="llama-3-70b"}',
                'kafka_consumer_lag',
                'sum(claims_refuted_total) / sum(claims_verifiable_total)'
              ].map((query) => (
                <button
                  key={query}
                  onClick={() => {
                    setPromQuery(query);
                    handleExecutePromQL(query);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-cyan-300 transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>

          {/* Query Input Box */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={promQuery}
                onChange={(e) => setPromQuery(e.target.value)}
                placeholder="Enter PromQL query (e.g. spark_streaming_batch_duration_ms)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              onClick={() => handleExecutePromQL()}
              disabled={isQuerying}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isQuerying ? 'animate-spin' : ''}`} />
              <span>Execute</span>
            </button>
          </div>

          {/* Query Results */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">Result Format: application/json</span>
              <span className="text-emerald-400 font-mono">Status: 200 OK</span>
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-300 overflow-x-auto max-h-96">
              {promResult ? JSON.stringify(promResult, null, 2) : 'No query executed yet.'}
            </pre>
          </div>
        </div>
      )}

      {/* VIEW 3: RAW PROMETHEUS METRICS EXPORTER PREVIEW */}
      {subView === 'metrics_exporter' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <FileCode className="w-4 h-4 text-orange-400" />
                <span>Standard OpenMetrics / Prometheus Text Exporter (/api/metrics)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Scraped by Prometheus server every scrape_interval (default 5s)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyMetrics}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                {copiedMetrics ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMetrics ? 'Copied!' : 'Copy Metrics'}</span>
              </button>

              <a
                href="/api/metrics"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition-colors"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-[600px] leading-relaxed">
            {rawMetricsText || 'Loading live metrics exporter...'}
          </pre>
        </div>
      )}

      {/* VIEW 4: DEDICATED PROMETHEUS ALERT HISTORY & AUDIT LOG CONSOLE */}
      {subView === 'alert_history' && (
        <div className="space-y-5">
          {/* Header Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
                    <History className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-100 text-sm">
                    Prometheus Alert History &amp; SLA Incident Audit Log
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    ALERTMANAGER PERSISTENCE
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Chronological journal of alert threshold firing states, duration, trigger values, and automated/manual resolution logs.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Audit PDF</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Recorded Incidents</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-0.5">
                  {effectiveAlertHistory.length}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Currently Firing</div>
                <div className={`text-base font-bold font-mono mt-0.5 ${
                  effectiveAlertHistory.filter(a => (a.state || a.status) === 'firing').length > 0
                    ? 'text-rose-400 animate-pulse'
                    : 'text-emerald-400'
                }`}>
                  {effectiveAlertHistory.filter(a => (a.state || a.status) === 'firing').length} Active
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Resolved Incidents</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {effectiveAlertHistory.filter(a => (a.state || a.status) === 'resolved').length} Resolved
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Avg Recovery Time</div>
                <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
                  {Math.round(
                    effectiveAlertHistory.filter(a => a.durationSec).reduce((acc, a) => acc + (a.durationSec || 0), 0) /
                    Math.max(1, effectiveAlertHistory.filter(a => a.durationSec).length)
                  )}s
                </div>
              </div>
            </div>

            {/* Controls: Search and Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter alert history by rule name, metric, or description..."
                  value={alertSearchQuery}
                  onChange={(e) => setAlertSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                {/* Severity Filter */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 px-1.5 uppercase">Sev:</span>
                  {(['all', 'critical', 'warning'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setAlertSeverityFilter(sev)}
                      className={`px-2 py-0.5 rounded capitalize transition-colors text-[11px] ${
                        alertSeverityFilter === sev
                          ? 'bg-slate-800 text-amber-300 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-500 px-1.5 uppercase">State:</span>
                  {(['all', 'firing', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setAlertStatusFilter(st)}
                      className={`px-2 py-0.5 rounded capitalize transition-colors text-[11px] ${
                        alertStatusFilter === st
                          ? st === 'firing'
                            ? 'bg-rose-600 text-white font-semibold'
                            : st === 'resolved'
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'bg-slate-800 text-slate-200 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Full-Page History Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4">Event ID / Time</th>
                    <th className="py-3 px-4">Alert Rule &amp; PromQL Target</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Observed vs Limit</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Root Cause &amp; Resolution Diagnosis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono">
                  {filteredAlertHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500 text-xs font-sans">
                        No alerts found matching search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAlertHistory.map((evt, idx) => {
                      const isFiring = evt.state === 'firing';
                      const ageMin = Math.round((Date.now() - evt.timestamp) / (1000 * 60));
                      return (
                        <tr
                          key={`${evt.id}-${idx}`}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isFiring ? 'bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-slate-300 font-semibold">{evt.id}</div>
                            <div className="text-[11px] text-slate-400">{formatTimestamp(evt.timestamp)}</div>
                            <div className="text-[10px] text-slate-500">{ageMin <= 0 ? 'just now' : `${ageMin}m ago`}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-200">{evt.name}</div>
                            <code className="text-[10px] text-cyan-300/80 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {evt.metric}
                            </code>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                evt.severity === 'critical'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {evt.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                                isFiring
                                  ? 'bg-rose-500 text-white animate-pulse'
                                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isFiring ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {evt.state}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs">
                            <div className={isFiring ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                              {evt.value} {evt.unit}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Threshold: {evt.threshold} {evt.unit}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-300">
                            {evt.durationSec ? `${evt.durationSec}s` : isFiring ? (
                              <span className="text-rose-400 font-semibold animate-pulse">Active Incident</span>
                            ) : (
                              '–'
                            )}
                          </td>
                          <td className="py-3 px-4 font-sans text-xs text-slate-300 min-w-[280px]">
                            <p className="text-[11px] leading-relaxed text-slate-300">{evt.description}</p>
                            {evt.resolvedAt && (
                              <div className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Resolved at {formatTimestamp(evt.resolvedAt)}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable PDF Report Modal */}
      <PrintableReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        metrics={metrics}
        batches={batches}
        modelStats={modelStats}
        domainStats={domainStats}
        difficultyStats={difficultyStats}
        statisticalResults={statisticalResults}
        thresholds={localThresholds}
      />
    </div>
  );
};
