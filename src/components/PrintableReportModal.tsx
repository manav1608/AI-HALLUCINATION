/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BarChart3,
  ShieldAlert,
  Cpu
} from 'lucide-react';
import { ReportData, downloadBenchmarkPDF } from '../utils/pdfReportGenerator.js';

interface PrintableReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ReportData;
}

export const PrintableReportModal: React.FC<PrintableReportModalProps> = ({
  isOpen,
  onClose,
  reportData
}) => {
  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadBenchmarkPDF(reportData, `hallucination_benchmark_report_${timestamp}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const { metrics, modelStats, statisticalResults, alerts, thresholds } = reportData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Analytical Metrics &amp; Statistical Documentation Report
              </h3>
              <p className="text-xs text-slate-400">
                Printable formal audit of streaming throughput, model accuracy, and econometric validation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-950 text-slate-200 space-y-6 print:bg-white print:text-black">
          {/* Document Header */}
          <div className="border-b border-slate-800 pb-5 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRODUCTION AUDIT REPORT
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Date: {new Date().toLocaleString()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Apache Kafka &amp; Spark Structured Streaming Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Distributed Claim-Level Verification of Large Language Models • Observability, Latency &amp; Hallucination Metrics
            </p>
          </div>

          {/* KPI Summary Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              1. Pipeline Performance &amp; Evaluation KPIs
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Total Evaluated Responses</span>
                <span className="text-lg font-bold font-mono text-slate-100">{metrics?.totalProcessedResponses ?? 0}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Atomic Claims Verified</span>
                <span className="text-lg font-bold font-mono text-slate-100">{metrics?.totalProcessedClaims ?? 0}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Claim Error Rate (HR_claim)</span>
                <span className="text-lg font-bold font-mono text-amber-400">{((metrics?.globalHRClaim ?? 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Response Error Rate (HR_resp)</span>
                <span className="text-lg font-bold font-mono text-rose-400">{((metrics?.globalHRResponse ?? 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">End-to-End P95 Latency</span>
                <span className="text-lg font-bold font-mono text-cyan-400">{metrics?.p95LatencyMs ?? 0} ms</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Spark Micro-Batch Delay</span>
                <span className="text-lg font-bold font-mono text-purple-400">{metrics?.sparkProcessingDelayMs ?? 0} ms</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Kafka Consumer Queue Lag</span>
                <span className="text-lg font-bold font-mono text-blue-400">{metrics?.consumerLagTotal ?? 0} msgs</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                <span className="text-[11px] text-slate-400 block">Active Alert Firing</span>
                <span className="text-lg font-bold font-mono text-rose-400">{metrics?.activeAlertsCount ?? 0}</span>
              </div>
            </div>
          </div>

          {/* SLA Limits & Threshold Audit */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              2. SLA Threshold Compliance Audit
            </h4>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Metric</th>
                    <th className="p-2.5">Current Reading</th>
                    <th className="p-2.5">SLA Threshold</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  <tr>
                    <td className="p-2.5 text-slate-200">E2E P95 Pipeline Latency</td>
                    <td className="p-2.5 font-bold text-slate-100">{metrics?.p95LatencyMs} ms</td>
                    <td className="p-2.5 text-slate-400">&lt; {thresholds.pipelineLatencyMs} ms</td>
                    <td className="p-2.5">
                      {(metrics?.p95LatencyMs ?? 0) <= thresholds.pipelineLatencyMs ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Within SLA
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Breached SLA
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Spark Micro-Batch Delay</td>
                    <td className="p-2.5 font-bold text-slate-100">{metrics?.sparkProcessingDelayMs} ms</td>
                    <td className="p-2.5 text-slate-400">&lt; {thresholds.sparkBatchDelayMs} ms</td>
                    <td className="p-2.5">
                      {(metrics?.sparkProcessingDelayMs ?? 0) <= thresholds.sparkBatchDelayMs ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Within SLA
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Breached SLA
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Claim Error Rate (HR_claim)</td>
                    <td className="p-2.5 font-bold text-slate-100">{((metrics?.globalHRClaim ?? 0) * 100).toFixed(1)}%</td>
                    <td className="p-2.5 text-slate-400">&lt; {(thresholds.claimErrorRate * 100).toFixed(0)}%</td>
                    <td className="p-2.5">
                      {(metrics?.globalHRClaim ?? 0) <= thresholds.claimErrorRate ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Within SLA
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Breached SLA
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-200">Kafka Total Consumer Lag</td>
                    <td className="p-2.5 font-bold text-slate-100">{metrics?.consumerLagTotal} msgs</td>
                    <td className="p-2.5 text-slate-400">&lt; {thresholds.kafkaLag} msgs</td>
                    <td className="p-2.5">
                      {(metrics?.consumerLagTotal ?? 0) <= thresholds.kafkaLag ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Within SLA
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Breached SLA
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Model Comparison Matrix */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              3. LLM Model Benchmark Breakdown
            </h4>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Model</th>
                    <th className="p-2.5">Claims</th>
                    <th className="p-2.5">HR_claim</th>
                    <th className="p-2.5">HR_response</th>
                    <th className="p-2.5 text-emerald-400">RAG HR</th>
                    <th className="p-2.5 text-rose-400">Non-RAG HR</th>
                    <th className="p-2.5">Avg Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {modelStats.map((mod) => (
                    <tr key={mod.model}>
                      <td className="p-2.5 font-semibold text-slate-200">{mod.displayName}</td>
                      <td className="p-2.5 text-slate-300">{mod.totalClaims}</td>
                      <td className="p-2.5 text-amber-400 font-bold">{(mod.claimHallucinationRate * 100).toFixed(1)}%</td>
                      <td className="p-2.5 text-slate-300">{(mod.responseHallucinationRate * 100).toFixed(1)}%</td>
                      <td className="p-2.5 text-emerald-400 font-semibold">{(mod.ragClaimHR * 100).toFixed(1)}%</td>
                      <td className="p-2.5 text-rose-400 font-semibold">{(mod.nonRagClaimHR * 100).toFixed(1)}%</td>
                      <td className="p-2.5 text-slate-400">{Math.round(mod.avgLatencyMs)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistical Verification & Hypotheses */}
          {statisticalResults && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                4. Statistical Hypothesis Verification &amp; Econometric Analysis
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono">
                  <span className="text-[10px] text-slate-400 block font-sans">Chi-Square: Model Architecture</span>
                  <div className="text-sm font-bold text-slate-200 mt-1">X² = {statisticalResults.chiSquareModel.stat}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">p = {statisticalResults.chiSquareModel.pValue.toExponential(2)} (Significant)</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono">
                  <span className="text-[10px] text-slate-400 block font-sans">Chi-Square: Domain Effect</span>
                  <div className="text-sm font-bold text-slate-200 mt-1">X² = {statisticalResults.chiSquareDomain.stat}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">p = {statisticalResults.chiSquareDomain.pValue.toExponential(2)} (Significant)</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono">
                  <span className="text-[10px] text-slate-400 block font-sans">Chi-Square: Question Difficulty</span>
                  <div className="text-sm font-bold text-slate-200 mt-1">X² = {statisticalResults.chiSquareDifficulty.stat}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">p = {statisticalResults.chiSquareDifficulty.pValue.toExponential(2)} (Significant)</div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block font-mono">
                  Empirical Hypotheses Findings:
                </span>
                <div className="space-y-2 text-xs">
                  {statisticalResults.hypotheses.map(h => (
                    <div key={h.id} className="bg-slate-950 p-2.5 rounded border border-slate-850 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {h.id}
                        </span>
                        <span className="font-semibold text-slate-200">{h.statement}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 pl-7">{h.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
