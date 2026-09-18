/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Radio,
  Send,
  Sparkles,
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Filter,
  Eye,
  Activity,
  Server,
  Zap,
  Clock,
  Flame,
  Check
} from 'lucide-react';
import {
  StreamEvent,
  SparkMicroBatch,
  KafkaPartitionStats,
  PipelineMetrics,
  LLMModel,
  KnowledgeDomain,
  QuestionDifficulty
} from '../types.js';
import { PRESET_BENCHMARK_QUERIES, PresetQuery } from '../data/presetQueries.js';
import { formatNumber, formatBytes, formatTimestamp } from '../utils/formatters.js';

interface StreamDashboardProps {
  metrics: PipelineMetrics | null;
  events: StreamEvent[];
  batches: SparkMicroBatch[];
  partitions: KafkaPartitionStats[];
  onInspectEvent: (event: StreamEvent) => void;
  onIngestPrompt: (
    question: string,
    model: LLMModel,
    retrieval: boolean,
    domain: KnowledgeDomain,
    difficulty: QuestionDifficulty
  ) => Promise<void>;
}

export const StreamDashboard: React.FC<StreamDashboardProps> = ({
  metrics,
  events,
  batches,
  partitions,
  onInspectEvent,
  onIngestPrompt
}) => {
  // Ingest form state
  const [selectedPreset, setSelectedPreset] = useState<PresetQuery>(PRESET_BENCHMARK_QUERIES[0]);
  const [customQuestion, setCustomQuestion] = useState(PRESET_BENCHMARK_QUERIES[0].question);
  const [selectedModel, setSelectedModel] = useState<LLMModel>('llama-3-70b');
  const [retrievalEnabled, setRetrievalEnabled] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain>('science');
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuestionDifficulty>('easy');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState(false);

  // Filter state for stream waterfall
  const [streamFilter, setStreamFilter] = useState<'all' | 'hallucinated' | 'clean' | 'rag'>('all');

  const handleSelectPreset = (p: PresetQuery) => {
    setSelectedPreset(p);
    setCustomQuestion(p.question);
    setSelectedDomain(p.domain);
    setSelectedDifficulty(p.difficulty);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onIngestPrompt(
        customQuestion,
        selectedModel,
        retrievalEnabled,
        selectedDomain,
        selectedDifficulty
      );
      setSubmittedFeedback(true);
      setTimeout(() => setSubmittedFeedback(false), 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (streamFilter === 'hallucinated') return ev.responseHallucinated;
    if (streamFilter === 'clean') return !ev.responseHallucinated;
    if (streamFilter === 'rag') return ev.retrievalEnabled;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Ingested */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Ingested Responses</span>
            <Database className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {formatNumber(metrics?.totalProcessedResponses || 0)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {metrics?.currentThroughputMsgSec || 45} msg/sec stream
          </span>
        </div>

        {/* Atomic Claims */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Decomposed Claims</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {formatNumber(metrics?.totalProcessedClaims || 0)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            ~3.2 atomic claims / response
          </span>
        </div>

        {/* HR_claim */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>HR_claim (Refuted)</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {((metrics?.globalHRClaim || 0) * 100).toFixed(1)}%
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Research Metric (N_refuted / N_claims)
          </span>
        </div>

        {/* HR_response */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>HR_response (Binary)</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {((metrics?.globalHRResponse || 0) * 100).toFixed(1)}%
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            ≥1 Refuted Claim in Response
          </span>
        </div>

        {/* Latency */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>E2E Latency (p95)</span>
            <Clock className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {metrics?.p95LatencyMs || 0} ms
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            p50: {metrics?.avgE2ELatencyMs || 0}ms | p99: {metrics?.p99LatencyMs || 0}ms
          </span>
        </div>

        {/* Kafka Lag */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Kafka Consumer Lag</span>
            <Zap className={`w-3.5 h-3.5 ${(metrics?.consumerLagTotal || 0) > 200 ? 'text-rose-400' : 'text-cyan-400'}`} />
          </div>
          <div className={`text-xl font-bold font-mono ${(metrics?.consumerLagTotal || 0) > 200 ? 'text-rose-400' : 'text-slate-100'}`}>
            {metrics?.consumerLagTotal || 0} msgs
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Across 6 Topic Partitions
          </span>
        </div>
      </div>

      {/* 2. Main Grid: Left Ingestion & Pipeline Engine, Right Live Stream Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Ingestion Tester & Kafka/Spark Cluster Diagnostics (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Ingestion / Prompt Testing Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Send className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-xs">
                    Live Pipeline Ingestor &amp; Experimenter
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Inject test queries to observe Kafka serialization, Spark extraction, &amp; NLI scoring
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRODUCER READY
              </span>
            </div>

            {/* Benchmark Preset Quick Selection */}
            <div>
              <span className="text-[11px] font-medium text-slate-300 block mb-1.5">
                Benchmark Presets (FEVER / HaluEval / TruthfulQA):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_BENCHMARK_QUERIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`text-left p-2 rounded border text-[11px] transition-all ${
                      selectedPreset.id === p.id
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[9px] text-slate-500 mb-0.5">
                      <span>{p.source}</span>
                      <span className="capitalize">{p.domain}</span>
                    </div>
                    <div className="truncate font-medium">{p.question}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Question / Target Prompt:
                </label>
                <textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                  placeholder="Enter a factual question or claim to test..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Evaluating Model:</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as LLMModel)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="gpt-4o">OpenAI GPT-4o</option>
                    <option value="llama-3-70b">Meta Llama-3-70B</option>
                    <option value="claude-3-5-sonnet">Anthropic Claude-3.5</option>
                    <option value="mistral-large">Mistral Large 2</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Domain &amp; Difficulty:</label>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="science">Science</option>
                      <option value="history">History</option>
                      <option value="medicine">Medicine</option>
                      <option value="computer_science">CS</option>
                      <option value="geography">Geo</option>
                      <option value="law_politics">Law</option>
                    </select>

                    <select
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value as QuestionDifficulty)}
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded px-1.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* RAG Toggle */}
              <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className={`w-4 h-4 ${retrievalEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">
                      RAG Retrieval Grounding (KILT Wikipedia)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {retrievalEnabled
                        ? 'External evidence retrieved to ground generation'
                        : 'Unassisted parametric generation (higher hallucination risk)'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRetrievalEnabled(!retrievalEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    retrievalEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      retrievalEnabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs py-2 rounded-lg transition-all shadow-md"
              >
                {submittedFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Streamed Through Pipeline Successfully!</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish to Kafka &amp; Run Spark NLI Pipeline</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Apache Kafka Ingestion Topics & Partition Consumer Lag */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-slate-100 text-xs">
                  Apache Kafka Topic Partitions &amp; Lag
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Cluster: kafka-broker:9092</span>
            </div>

            <div className="space-y-2">
              {partitions.map((p, idx) => (
                <div
                  key={`${p.topic}-${p.partitionId}-${idx}`}
                  className="bg-slate-950/80 border border-slate-800 rounded-md p-2 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="text-[11px] text-slate-200 font-sans block font-medium">
                      {p.topic}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Partition [{p.partitionId}] • Rate: {p.msgRateSec} msg/s
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Offset: {formatNumber(p.currentOffset)}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.consumerLag > 100
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        Lag: {p.consumerLag}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apache Spark Micro-Batch Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-slate-100 text-xs">
                  Spark Structured Streaming Micro-Batches
                </h3>
              </div>
              <span className="text-[10px] font-mono text-purple-300">Trigger: 1.5s Interval</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {batches.slice(0, 6).map((b, bIdx) => (
                <div
                  key={`${b.batchId}-${bIdx}`}
                  className="bg-slate-950/70 border border-slate-800/80 rounded p-2 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                      #{b.batchId}
                    </span>
                    <div>
                      <span className="text-[11px] text-slate-200 font-medium block">
                        {b.recordsProcessed} msgs • {b.claimsProcessed} claims
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Shuffle: {formatBytes(b.shuffleReadBytes)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-mono text-xs font-semibold ${b.durationMs > 2000 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {b.durationMs} ms
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {formatTimestamp(b.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Atomic Claim Stream Waterfall (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Waterfall Header & Filter controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <div>
                  <h3 className="font-semibold text-slate-100 text-xs">
                    Live Stream Waterfall: Atomic Claim Verification
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Real-time ingestion from Apache Kafka &amp; continuous Spark NLI classification
                  </p>
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <button
                  onClick={() => setStreamFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamFilter === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({events.length})
                </button>
                <button
                  onClick={() => setStreamFilter('hallucinated')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamFilter === 'hallucinated' ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40 font-medium' : 'text-slate-400 hover:text-rose-300'
                  }`}
                >
                  Refuted Only
                </button>
                <button
                  onClick={() => setStreamFilter('clean')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamFilter === 'clean' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-medium' : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  Supported
                </button>
                <button
                  onClick={() => setStreamFilter('rag')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    streamFilter === 'rag' ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 font-medium' : 'text-slate-400 hover:text-indigo-300'
                  }`}
                >
                  RAG
                </button>
              </div>
            </div>

            {/* Stream List */}
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/50 rounded-lg border border-slate-800">
                  No streaming events match the selected filter.
                </div>
              ) : (
                filteredEvents.map((ev, evIdx) => {
                  const refutedCount = ev.claims.filter(c => c.status === 'refuted').length;
                  const supportedCount = ev.claims.filter(c => c.status === 'supported').length;
                  const unknownCount = ev.claims.filter(c => c.status === 'unknown').length;

                  return (
                    <div
                      key={`${ev.id}-${evIdx}`}
                      onClick={() => onInspectEvent(ev)}
                      className={`group p-3.5 rounded-xl border transition-all cursor-pointer hover:border-indigo-500/50 hover:shadow-lg ${
                        ev.responseHallucinated
                          ? 'bg-rose-950/10 border-rose-900/30'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      {/* Event Meta Line */}
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {ev.sourceDataset}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-300 font-semibold">{ev.model}</span>
                          <span className="text-slate-400">•</span>
                          <span className="capitalize text-slate-400">{ev.domain}</span>
                          <span className="text-slate-400">•</span>
                          <span className={`px-1.5 py-0.2 rounded ${ev.retrievalEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                            {ev.retrievalEnabled ? 'RAG' : 'Parametric'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span>{formatTimestamp(ev.timestamp)}</span>
                          <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>

                      {/* Question */}
                      <p className="text-xs font-medium text-slate-100 mb-1.5">
                        {ev.questionText}
                      </p>

                      {/* Response Excerpt */}
                      <p className="text-[11px] text-slate-300 line-clamp-2 italic font-sans mb-3 text-slate-400">
                        "{ev.responseText}"
                      </p>

                      {/* Decomposed Atomic Claims Pills */}
                      <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                        <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-between">
                          <span>Atomic Claims ({ev.claims.length}):</span>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-medium">{supportedCount} Supported</span>
                            {refutedCount > 0 && (
                              <span className="text-rose-400 font-medium">{refutedCount} Refuted</span>
                            )}
                            {unknownCount > 0 && (
                              <span className="text-amber-400 font-medium">{unknownCount} Unknown</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {ev.claims.map((claim, cIdx) => (
                            <span
                              key={`${claim.id || 'claim'}-${cIdx}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                                claim.status === 'supported'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : claim.status === 'refuted'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              <span className="font-mono font-bold">C{cIdx + 1}:</span>
                              <span className="truncate max-w-[200px]">{claim.claimText}</span>
                              <span className="font-mono text-[9px] opacity-75">
                                {(claim.confidence * 100).toFixed(0)}%
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Severity & Latency Meter */}
                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-900">
                        <span>Severity Index: {ev.severityScore.toFixed(2)}</span>
                        <span>Latency: {ev.e2eLatencyMs}ms (Kafka: {ev.kafkaLatencyMs}ms, Spark: {ev.sparkProcessingMs}ms)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
