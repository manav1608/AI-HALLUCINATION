/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Server,
  Activity,
  Layers,
  ArrowRight,
  Database,
  FileCode,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
  Play,
  Check
} from 'lucide-react';
import { SparkClusterStats, SparkMicroBatch } from '../types.js';
import { formatBytes } from '../utils/formatters.js';

interface SparkClusterViewProps {
  cluster: SparkClusterStats | null;
  recentBatches: SparkMicroBatch[];
  thresholdDelayMs?: number;
}

export const SparkClusterView: React.FC<SparkClusterViewProps> = ({
  cluster,
  recentBatches,
  thresholdDelayMs = 2000
}) => {
  const [selectedPlanTab, setSelectedPlanTab] = useState<'physical' | 'logical' | 'dag'>('dag');
  const [batchProgress, setBatchProgress] = useState<number>(35);
  const [activeStageIndex, setActiveStageIndex] = useState<number>(1);
  const [batchCycleMs, setBatchCycleMs] = useState<number>(680);

  const latestBatch = recentBatches[0];
  const targetDurationMs = latestBatch ? Math.max(400, latestBatch.durationMs) : 800;

  // Smooth live micro-batch progress cadence loop
  useEffect(() => {
    const intervalTime = 60;
    const timer = setInterval(() => {
      setBatchProgress((prev) => {
        const step = (intervalTime / targetDurationMs) * 100;
        const next = prev + step;
        if (next >= 100) {
          // Micro-batch completed, restart cycle
          setBatchCycleMs(0);
          return 0;
        }
        return next;
      });
      setBatchCycleMs((prev) => prev + intervalTime);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [targetDurationMs]);

  // Map progress % to 4 DAG stages
  useEffect(() => {
    if (batchProgress < 25) setActiveStageIndex(0); // Stage 1: Kafka Poll
    else if (batchProgress < 50) setActiveStageIndex(1); // Stage 2: Watermark Windowing
    else if (batchProgress < 75) setActiveStageIndex(2); // Stage 3: Broadcast Join & Claim UDF
    else setActiveStageIndex(3); // Stage 4: Sinks & Checkpoint
  }, [batchProgress]);

  const stages = [
    { id: 1, name: 'Kafka Ingestion', sub: 'topic.llm.raw-responses', detail: '3 Partitions', color: 'cyan' },
    { id: 2, name: 'Windowing & Watermark', sub: 'withWatermark(2s)', detail: 'Tumbling 5s Windows', color: 'indigo' },
    { id: 3, name: 'Claim NLP & Broadcast Join', sub: 'KILT Wikipedia Index', detail: 'Decompose & Entailment UDF', color: 'purple' },
    { id: 4, name: 'Parquet & Metric Sink', sub: 'HDFS /data/claims', detail: 'State Checkpoint Commit', color: 'emerald' },
  ];

  const workers = [
    { id: 'worker-1', host: 'spark-worker-1.internal', cores: 4, memoryUsedGb: 4.8, memoryTotalGb: 8, status: 'ALIVE', tasksActive: 3 },
    { id: 'worker-2', host: 'spark-worker-2.internal', cores: 4, memoryUsedGb: 5.1, memoryTotalGb: 8, status: 'ALIVE', tasksActive: 4 },
    { id: 'worker-3', host: 'spark-worker-3.internal', cores: 4, memoryUsedGb: 4.3, memoryTotalGb: 8, status: 'ALIVE', tasksActive: 2 },
    { id: 'worker-4', host: 'spark-worker-4.internal', cores: 4, memoryUsedGb: 4.2, memoryTotalGb: 8, status: 'ALIVE', tasksActive: 3 },
  ];

  const isDelayExceeded = (latestBatch?.durationMs || 420) > thresholdDelayMs;

  return (
    <div className="space-y-6">
      {/* Cluster Overview Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-100 text-sm">
                Apache Spark 3.5.1 Structured Streaming Engine
              </h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${cluster?.masterStatus === 'ALIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                MASTER: {cluster?.masterStatus || 'ALIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Catalyst Optimizer, Whole-Stage Code Generation &amp; Stateful Watermarking
            </p>
          </div>
        </div>

        {/* Cores & Memory Pills */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Total Cores:</span>{' '}
            <strong className="text-slate-100">{cluster?.allocatedCores || 16} / {cluster?.totalCores || 16}</strong>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">JVM Heap:</span>{' '}
            <strong className="text-slate-100">{cluster?.usedMemoryGb || 18.4} GB / {cluster?.totalMemoryGb || 32} GB</strong>
          </div>
        </div>
      </div>

      {/* LIVE MICRO-BATCH PROGRESS & STREAMING CADENCE ANIMATION CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-indigo-500/30 rounded-xl p-4 shadow-lg space-y-3.5 relative overflow-hidden">
        {/* Glow ambient effect */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping absolute" />
              <div className="w-3 h-3 rounded-full bg-indigo-400 relative" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                  Live Micro-Batch In-Flight
                </span>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Batch #{latestBatch ? latestBatch.batchId + 1 : 142}
                </span>
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                  isDelayExceeded
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {isDelayExceeded ? 'SLA Delay Warning' : 'Cadence Normal'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time micro-batch execution cycle • Trigger interval: ProcessingTime(2s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Elapsed:</span>
              <strong className="text-white">{Math.min(targetDurationMs, batchCycleMs)} ms</strong>
              <span className="text-slate-500">/ {targetDurationMs} ms</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Cadence Progress:</span>
              <strong className="text-indigo-300">{Math.round(batchProgress)}%</strong>
            </div>
          </div>
        </div>

        {/* Live Progress Bar with Shimmer */}
        <div className="relative w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-75 ease-out relative overflow-hidden"
            style={{ width: `${Math.min(100, Math.max(2, batchProgress))}%` }}
          >
            {/* Animated Light Shimmer Beam */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>

        {/* Dynamic 4-Phase Step Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
          {stages.map((st, idx) => {
            const isCompleted = idx < activeStageIndex;
            const isCurrent = idx === activeStageIndex;

            return (
              <div
                key={st.id}
                className={`p-2 rounded-lg border transition-all duration-200 ${
                  isCurrent
                    ? 'bg-indigo-500/15 border-indigo-500/60 ring-1 ring-indigo-500/30 text-white'
                    : isCompleted
                    ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                    : 'bg-slate-950/40 border-slate-900 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-400">PHASE {st.id}</span>
                  {isCompleted && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  )}
                </div>
                <div className="font-semibold text-slate-200 truncate">{st.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{st.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cluster Worker Node Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {workers.map((w) => (
          <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-200 text-xs">{w.id}</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {w.status}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Active Tasks:</span>
                <span className="font-mono text-slate-200">{w.tasksActive} slots</span>
              </div>
              <div className="flex justify-between">
                <span>Cores:</span>
                <span className="font-mono text-slate-200">{w.cores} vCPUs</span>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span>Heap Memory:</span>
                  <span className="font-mono text-slate-200">{w.memoryUsedGb} / {w.memoryTotalGb} GB</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${(w.memoryUsedGb / w.memoryTotalGb) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Spark Structured Streaming DAG & Plan Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Structured Streaming Execution Graph &amp; Catalyst Optimizer</span>
            </h3>
            <p className="text-xs text-slate-400">
              Micro-Batch RDD transformation graph with broadcast joins &amp; sliding watermarks
            </p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedPlanTab('dag')}
              className={`px-3 py-1 rounded transition-colors ${
                selectedPlanTab === 'dag' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pipeline Visual DAG
            </button>
            <button
              onClick={() => setSelectedPlanTab('physical')}
              className={`px-3 py-1 rounded transition-colors ${
                selectedPlanTab === 'physical' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Catalyst Physical Plan
            </button>
          </div>
        </div>

        {/* Visual DAG */}
        {selectedPlanTab === 'dag' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center text-center">
              {/* Stage 1: Kafka Source */}
              <div className={`rounded-lg p-3 space-y-1 transition-all duration-300 ${
                activeStageIndex === 0
                  ? 'bg-cyan-950/60 border-2 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                  : 'bg-slate-950 border border-cyan-500/40'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block">Stage 1: Source</span>
                  {activeStageIndex === 0 && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 block">Kafka Ingestion</span>
                <span className="text-[10px] text-slate-400 block font-mono">topic.llm.raw-responses</span>
                <span className="text-[9px] text-slate-500 block">3 Partitions • Offset Poll</span>
              </div>

              <div className="hidden md:flex flex-col items-center justify-center">
                <ArrowRight className={`w-5 h-5 transition-colors ${activeStageIndex >= 1 ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
                <span className={`text-[8px] font-mono transition-opacity ${activeStageIndex >= 1 ? 'text-cyan-400 opacity-100' : 'opacity-0'}`}>stream</span>
              </div>

              {/* Stage 2: Watermark */}
              <div className={`rounded-lg p-3 space-y-1 transition-all duration-300 ${
                activeStageIndex === 1
                  ? 'bg-indigo-950/60 border-2 border-indigo-400 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                  : 'bg-slate-950 border border-indigo-500/40'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold block">Stage 2: Watermark</span>
                  {activeStageIndex === 1 && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 block">Windowing</span>
                <span className="text-[10px] text-slate-400 block font-mono">withWatermark(2s)</span>
                <span className="text-[9px] text-slate-500 block">Tumbling 5s Windows</span>
              </div>

              <div className="hidden md:flex flex-col items-center justify-center">
                <ArrowRight className={`w-5 h-5 transition-colors ${activeStageIndex >= 2 ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}`} />
                <span className={`text-[8px] font-mono transition-opacity ${activeStageIndex >= 2 ? 'text-indigo-400 opacity-100' : 'opacity-0'}`}>windowed</span>
              </div>

              {/* Stage 3: Claim Extraction & Join */}
              <div className={`rounded-lg p-3 space-y-1 transition-all duration-300 ${
                activeStageIndex === 2
                  ? 'bg-purple-950/60 border-2 border-purple-400 shadow-lg shadow-purple-500/20 scale-[1.02]'
                  : 'bg-slate-950 border border-purple-500/40'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block">Stage 3: NLP &amp; Join</span>
                  {activeStageIndex === 2 && <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 block">Broadcast Join</span>
                <span className="text-[10px] text-slate-400 block font-mono">KILT Wiki Index</span>
                <span className="text-[9px] text-slate-500 block">Atomic Claim UDF</span>
              </div>

              <div className="hidden md:flex flex-col items-center justify-center">
                <ArrowRight className={`w-5 h-5 transition-colors ${activeStageIndex >= 3 ? 'text-purple-400 animate-pulse' : 'text-slate-600'}`} />
                <span className={`text-[8px] font-mono transition-opacity ${activeStageIndex >= 3 ? 'text-purple-400 opacity-100' : 'opacity-0'}`}>verified</span>
              </div>

              {/* Stage 4: NLI & Sinks */}
              <div className={`rounded-lg p-3 space-y-1 transition-all duration-300 ${
                activeStageIndex === 3
                  ? 'bg-emerald-950/60 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                  : 'bg-slate-950 border border-emerald-500/40'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">Stage 4: Sinks</span>
                  {activeStageIndex === 3 && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 block">Parquet &amp; Metric Sink</span>
                <span className="text-[10px] text-slate-400 block font-mono">HDFS + Prometheus</span>
                <span className="text-[9px] text-slate-500 block">Checkpoint Commit</span>
              </div>
            </div>

            {/* Spark Structured Streaming Pipeline Code Snippet */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
              <span className="text-[11px] font-mono text-slate-400 block">PySpark Structured Streaming Execution Definition:</span>
              <pre className="font-mono text-xs text-amber-300 overflow-x-auto leading-relaxed">
{`# Structured Streaming Reading from Apache Kafka
stream_df = spark.readStream \\
    .format("kafka") \\
    .option("kafka.bootstrap.servers", "kafka-broker:9092") \\
    .option("subscribe", "topic.llm.raw-responses") \\
    .option("startingOffsets", "latest") \\
    .load() \\
    .select(from_json(col("value").cast("string"), response_schema).alias("data")) \\
    .select("data.*") \\
    .withWatermark("timestamp", "2 seconds")

# Atomic Claim Decomposition & Broadcast Hash Join with KILT Corpus
claims_df = stream_df.withColumn("atomic_claims", extract_claims_udf(col("response_text"))) \\
    .select(col("*"), explode(col("atomic_claims")).alias("claim")) \\
    .join(broadcast(kilt_wikipedia_df), col("claim.entity_id") == col("kilt.doc_id"), "left_outer") \\
    .withColumn("nli_verdict", evaluate_nli_entailment_udf(col("claim.text"), col("kilt.evidence_text")))

# Dual Streaming Sinks: Parquet Checkpointed Storage + Prometheus Metrics
query = claims_df.writeStream \\
    .format("parquet") \\
    .option("path", "hdfs://namenode:9000/data/processed/claims") \\
    .option("checkpointLocation", "hdfs://namenode:9000/checkpoints/hallucination_stream") \\
    .trigger(processingTime="1.5 seconds") \\
    .start()`}
              </pre>
            </div>
          </div>
        )}

        {/* Catalyst Physical Plan */}
        {selectedPlanTab === 'physical' && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-96 space-y-2">
            <span className="text-amber-400 block font-bold">== Physical Plan ==</span>
            <pre className="text-slate-400 leading-relaxed text-[11px]">
{`*(4) HashAggregate(keys=[window#42, model#43, domain#44], functions=[count(1), sum(is_refuted#55)])
+- Exchange hashpartitioning(window#42, model#43, domain#44, 200), ENSURE_REQUIREMENTS, [id=#104]
   +- *(3) HashAggregate(keys=[window#42, model#43, domain#44], functions=[partial_count(1), partial_sum(is_refuted#55)])
      +- *(3) Project [window#42, model#43, domain#44, is_refuted#55]
         +- *(3) BroadcastHashJoin [claim_entity#31], [kilt_entity_id#88], LeftOuter, BuildRight
            :- *(3) Project [window#42, model#43, domain#44, claim_text#30, claim_entity#31]
            :  +- Generate explode(atomic_claims#22), [response_id#20], false, [claim#29]
            :     +- *(2) Filter isnotnull(response_text#21)
            :        +- *(2) Watermark timestamp#19: 2000 milliseconds
            :           +- *(1) Scan KafkaSource[topic.llm.raw-responses, offsets#12]
            +- BroadcastExchange HashedRelationBroadcastMode(List(input[0, string, false])), [id=#82]
               +- *(1) Scan ParquetFile[hdfs://namenode:9000/corpus/kilt_wikipedia]`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
