/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Database,
  Search,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { StreamEvent, AtomicClaim } from '../types.js';

interface ClaimInspectorModalProps {
  event: StreamEvent | null;
  onClose: () => void;
}

export const ClaimInspectorModal: React.FC<ClaimInspectorModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md ${event.responseHallucinated ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
              {event.responseHallucinated ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm">
                  Claim-Level Factual Verification Inspector
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {event.id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Decomposition into atomic factual units &amp; NLI cross-examination against KILT Wikipedia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Source Benchmark</span>
              <span className="font-medium text-slate-200">{event.sourceDataset}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Domain: {event.domain}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Evaluating Model</span>
              <span className="font-medium text-slate-200 font-mono">{event.model}</span>
              <span className={`text-[10px] font-semibold block mt-0.5 ${event.retrievalEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                {event.retrievalEnabled ? '✓ RAG Grounded' : '✗ No Retrieval (Parametric)'}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Claim Hallucination (HR_claim)</span>
              <span className={`text-base font-bold font-mono ${event.claims.some(c => c.status === 'refuted') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {((event.claims.filter(c => c.status === 'refuted').length / Math.max(event.claims.length, 1)) * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Severity Score: {event.severityScore.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">End-to-End Latency</span>
              <span className="font-medium text-slate-200 font-mono">{event.e2eLatencyMs} ms</span>
              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                <span>Kafka {event.kafkaLatencyMs}ms | Spark {event.sparkProcessingMs}ms</span>
              </div>
            </div>
          </div>

          {/* Question & Raw Response */}
          <div className="space-y-2">
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-indigo-400 block mb-1">Question / Prompt:</span>
              <p className="text-sm font-medium text-slate-100">{event.questionText}</p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                Generated Model Response ({event.model}):
              </span>
              <p className="text-xs leading-relaxed text-slate-300 font-sans">{event.responseText}</p>
            </div>
          </div>

          {/* Atomic Claims Decomposition */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Decomposed Atomic Factual Claims ({event.claims.length})</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Evaluated via Apache Spark NLI Entailment UDF
              </span>
            </div>

            <div className="space-y-3">
              {event.claims.map((claim: AtomicClaim, idx: number) => {
                const isSup = claim.status === 'supported';
                const isRef = claim.status === 'refuted';
                const isUnk = claim.status === 'unknown';

                return (
                  <div
                    key={`${claim.id || 'claim'}-${idx}`}
                    className={`rounded-lg border p-3.5 space-y-2 transition-all ${
                      isRef
                        ? 'bg-rose-950/20 border-rose-800/40'
                        : isSup
                        ? 'bg-emerald-950/15 border-emerald-800/40'
                        : 'bg-amber-950/15 border-amber-800/40'
                    }`}
                  >
                    {/* Claim Title & Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                          C{idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-slate-100 text-xs leading-snug">{claim.claimText}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                              Type: {claim.claimType}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Confidence: {(claim.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status pill */}
                      <div className="shrink-0">
                        {isSup && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SUPPORTED</span>
                          </span>
                        )}
                        {isRef && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>REFUTED</span>
                          </span>
                        )}
                        {isUnk && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>INSUFFICIENT EVIDENCE</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* NLI Probabilities Progress Bars */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2 rounded-md border border-slate-800/80">
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                          <span>Entailment:</span>
                          <span className="font-mono font-medium text-emerald-400">
                            {(claim.entailmentScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${claim.entailmentScore * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                          <span>Contradiction:</span>
                          <span className="font-mono font-medium text-rose-400">
                            {(claim.contradictionScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-rose-500 h-full rounded-full transition-all"
                            style={{ width: `${claim.contradictionScore * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5 text-slate-400">
                          <span>Neutral / Unknown:</span>
                          <span className="font-mono font-medium text-amber-400">
                            {(claim.neutralScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${claim.neutralScore * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Retrieved Evidence Passage */}
                    {claim.evidence && claim.evidence.length > 0 && (
                      <div className="bg-slate-950/90 border border-slate-800 rounded-md p-2.5 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Database className="w-3 h-3" />
                            <span>Retrieved Corpus: KILT Wikipedia ({claim.evidence[0].documentId})</span>
                          </span>
                          <span>BM25 Score: {claim.evidence[0].bm25Score.toFixed(1)}</span>
                        </div>
                        <p className="italic text-slate-300 font-serif">
                          "{claim.evidence[0].evidenceText}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Research Insight Callout */}
          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-3.5 space-y-1.5">
            <h5 className="font-semibold text-indigo-300 text-xs flex items-center gap-1.5">
              <span>Scientific Finding (RQ5: Claim-Level vs Response-Level Precision)</span>
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Binary response evaluation assigns a simple {event.responseHallucinated ? '"Failed / Hallucinated"' : '"Passed"'} verdict to this entire response. However, atomic claim analysis reveals that{' '}
              <strong className="text-white">
                {event.claims.filter(c => c.status === 'supported').length} out of {event.claims.length} claims
              </strong>{' '}
              ({((event.claims.filter(c => c.status === 'supported').length / Math.max(event.claims.length, 1)) * 100).toFixed(0)}%)
              were empirically factual and backed by peer-reviewed evidence. This proves that claim-level decomposition preserves nuanced veracity rather than discarding partially correct model responses.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
