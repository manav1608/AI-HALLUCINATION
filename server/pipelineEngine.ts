/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  StreamEvent,
  SparkMicroBatch,
  KafkaPartitionStats,
  SparkClusterStats,
  PrometheusAlert,
  AlertHistoryEvent,
  KafkaPartitionLagPoint,
  PipelineMetrics,
  AlertThresholds,
  ModelComparisonStats,
  DomainComparisonStats,
  DifficultyStats,
  StatisticalResults,
  LLMModel,
  KnowledgeDomain,
  QuestionDifficulty,
  ClaimType,
  AtomicClaim
} from '../src/types.js';
import { BENCHMARK_ITEMS, RawBenchmarkItem } from './knowledgeBase.js';

class PipelineEngine {
  private events: StreamEvent[] = [];
  private batches: SparkMicroBatch[] = [];
  private currentBatchId = 101;
  private isPaused = false;
  private simulationSpeed = 1;
  private failureMode: 'none' | 'kafka_lag_spike' | 'spark_worker_oom' | 'nli_timeout' = 'none';

  // Configurable Alert Threshold Limits (Pipeline Latency, Error Rates, Consumer Lag)
  private alertThresholds: AlertThresholds = {
    pipelineLatencyMs: 650,
    sparkBatchDelayMs: 2000,
    claimErrorRate: 0.35,
    responseErrorRate: 0.45,
    kafkaLag: 250,
  };

  // Alert History Event Journal (persisting recent firing/resolved events)
  private alertHistory: AlertHistoryEvent[] = [];
  private previousAlertStates: Record<string, 'firing' | 'pending' | 'resolved'> = {};

  // Real-time Kafka partition lag timeseries history for D3 visualization
  private kafkaLagHistory: KafkaPartitionLagPoint[] = [];

  // Monotonic sequence counters for guaranteed unique entity IDs
  private claimSequenceId = 0;
  private eventSequenceId = 0;
  private alertSequenceId = 0;

  private totalProcessedResponses = 0;
  private totalProcessedClaims = 0;
  private totalRefutedClaims = 0;
  private totalSupportedClaims = 0;
  private totalUnknownClaims = 0;
  private totalHallucinatedResponses = 0;

  private latencyHistory: number[] = [];
  private timer: NodeJS.Timeout | null = null;
  private microBatchTimer: NodeJS.Timeout | null = null;

  private modelStats: Record<LLMModel, {
    totalResponses: number;
    totalClaims: number;
    refutedClaims: number;
    hallucinatedResponses: number;
    ragClaimsTotal: number;
    ragClaimsRefuted: number;
    nonRagClaimsTotal: number;
    nonRagClaimsRefuted: number;
    latencies: number[];
  }> = {
    'gpt-4o': { totalResponses: 0, totalClaims: 0, refutedClaims: 0, hallucinatedResponses: 0, ragClaimsTotal: 0, ragClaimsRefuted: 0, nonRagClaimsTotal: 0, nonRagClaimsRefuted: 0, latencies: [] },
    'llama-3-70b': { totalResponses: 0, totalClaims: 0, refutedClaims: 0, hallucinatedResponses: 0, ragClaimsTotal: 0, ragClaimsRefuted: 0, nonRagClaimsTotal: 0, nonRagClaimsRefuted: 0, latencies: [] },
    'claude-3-5-sonnet': { totalResponses: 0, totalClaims: 0, refutedClaims: 0, hallucinatedResponses: 0, ragClaimsTotal: 0, ragClaimsRefuted: 0, nonRagClaimsTotal: 0, nonRagClaimsRefuted: 0, latencies: [] },
    'mistral-large': { totalResponses: 0, totalClaims: 0, refutedClaims: 0, hallucinatedResponses: 0, ragClaimsTotal: 0, ragClaimsRefuted: 0, nonRagClaimsTotal: 0, nonRagClaimsRefuted: 0, latencies: [] },
  };

  private domainStats: Record<KnowledgeDomain, {
    totalClaims: number;
    refutedClaims: number;
    supportedClaims: number;
  }> = {
    history: { totalClaims: 0, refutedClaims: 0, supportedClaims: 0 },
    science: { totalClaims: 0, refutedClaims: 0, supportedClaims: 0 },
    medicine: { totalClaims: 0, refutedClaims: 0, supportedClaims: 0 },
    computer_science: { totalClaims: 0, refutedClaims: 0, supportedClaims: 0 },
    geography: { totalClaims: 0, refutedClaims: 0, supportedClaims: 0 },
    law_politics: { totalClaims: 0, refutedClaims: 0, supportedClaims: 0 },
  };

  private difficultyStats: Record<QuestionDifficulty, {
    totalClaims: number;
    refutedClaims: number;
    totalResponses: number;
    hallucinatedResponses: number;
  }> = {
    easy: { totalClaims: 0, refutedClaims: 0, totalResponses: 0, hallucinatedResponses: 0 },
    medium: { totalClaims: 0, refutedClaims: 0, totalResponses: 0, hallucinatedResponses: 0 },
    hard: { totalClaims: 0, refutedClaims: 0, totalResponses: 0, hallucinatedResponses: 0 },
  };

  private kafkaPartitions: KafkaPartitionStats[] = [
    { partitionId: 0, topic: 'topic.llm.raw-responses', currentOffset: 2490, logEndOffset: 2510, consumerLag: 20, msgRateSec: 42 },
    { partitionId: 1, topic: 'topic.llm.raw-responses', currentOffset: 2475, logEndOffset: 2498, consumerLag: 23, msgRateSec: 38 },
    { partitionId: 2, topic: 'topic.llm.raw-responses', currentOffset: 2501, logEndOffset: 2519, consumerLag: 18, msgRateSec: 44 },
    { partitionId: 0, topic: 'topic.spark.atomic-claims', currentOffset: 8900, logEndOffset: 8925, consumerLag: 25, msgRateSec: 110 },
    { partitionId: 1, topic: 'topic.spark.atomic-claims', currentOffset: 8880, logEndOffset: 8912, consumerLag: 32, msgRateSec: 105 },
    { partitionId: 2, topic: 'topic.spark.atomic-claims', currentOffset: 8920, logEndOffset: 8940, consumerLag: 20, msgRateSec: 115 },
  ];

  constructor() {
    this.seedInitialData();
    this.startStreamingLoop();
  }

  private seedInitialData() {
    // Generate initial historical batches
    const now = Date.now();
    for (let i = 20; i >= 1; i--) {
      const bTime = now - i * 3000;
      const recCount = Math.floor(25 + Math.random() * 20);
      const claimCount = recCount * 3;
      const refCount = Math.floor(claimCount * 0.22);
      const supCount = Math.floor(claimCount * 0.70);
      const unkCount = claimCount - refCount - supCount;

      this.batches.push({
        batchId: 80 + (20 - i),
        timestamp: bTime,
        durationMs: Math.floor(450 + Math.random() * 280),
        recordsProcessed: recCount,
        claimsProcessed: claimCount,
        supportedCount: supCount,
        refutedCount: refCount,
        unknownCount: unkCount,
        shuffleReadBytes: Math.floor(1024 * 1024 * 3.5 + Math.random() * 1024 * 1024),
        shuffleWriteBytes: Math.floor(1024 * 1024 * 2.1 + Math.random() * 1024 * 512),
        memorySpillMb: 0,
        watermarkDelaySec: 2.0,
        activeExecutors: 4,
        status: 'COMPLETED'
      });
    }

    // Seed events from benchmark items
    for (const item of BENCHMARK_ITEMS) {
      const models: LLMModel[] = ['gpt-4o', 'llama-3-70b', 'claude-3-5-sonnet', 'mistral-large'];
      for (const m of models) {
        for (const rag of [false, true]) {
          this.processBenchmarkEvent(item, m, rag, now - Math.random() * 30000);
        }
      }
    }

    // Seed initial Kafka partition lag timeseries history for D3 component
    for (let i = 25; i >= 0; i--) {
      const t = now - i * 2500;
      const d = new Date(t);
      const timeLabel = `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      const p0 = Math.max(8, Math.floor(18 + Math.sin(i * 0.4) * 6 + (Math.random() * 4)));
      const p1 = Math.max(14, Math.floor(28 + Math.cos(i * 0.3) * 10 + (Math.random() * 6))); // bottleneck partition
      const p2 = Math.max(6, Math.floor(15 + Math.sin(i * 0.5) * 5 + (Math.random() * 4)));
      const maxP = Math.max(p0, p1, p2);
      const bottleneck = maxP === p1 ? 1 : maxP === p0 ? 0 : 2;
      this.kafkaLagHistory.push({
        timestamp: t,
        timeLabel,
        p0Lag: p0,
        p1Lag: p1,
        p2Lag: p2,
        totalLag: p0 + p1 + p2,
        bottleneckPartition: bottleneck,
      });
    }

    // Seed initial Alert History Journal entries
    this.alertHistory = [
      {
        id: `ALH-${Date.now() - 150000}`,
        alertId: 'ALT-E2E-LATENCY',
        alertname: 'PipelineEndToEndLatencyHigh',
        severity: 'warning',
        status: 'resolved',
        timestamp: now - 180000,
        resolvedAt: now - 120000,
        durationSec: 60,
        currentVal: 685,
        threshold: this.alertThresholds.pipelineLatencyMs,
        unit: 'ms',
        description: 'P95 End-to-End latency breached configured threshold (650ms) during traffic burst. Downstream Spark micro-batch consumers cleared backlog.'
      },
      {
        id: `ALH-${Date.now() - 95000}`,
        alertId: 'ALT-KAFKA-LAG',
        alertname: 'KafkaConsumerLagCritical',
        severity: 'critical',
        status: 'resolved',
        timestamp: now - 145000,
        resolvedAt: now - 95000,
        durationSec: 50,
        currentVal: 280,
        threshold: this.alertThresholds.kafkaLag,
        unit: 'msgs',
        description: 'Kafka Partition 1 consumer lag exceeded 250 msgs. Rebalance completed by Spark micro-batch consumers.'
      },
      {
        id: `ALH-${Date.now() - 40000}`,
        alertId: 'ALT-SPARK-DELAY',
        alertname: 'SparkMicroBatchProcessingDelay',
        severity: 'warning',
        status: 'resolved',
        timestamp: now - 85000,
        resolvedAt: now - 40000,
        durationSec: 45,
        currentVal: 2240,
        threshold: this.alertThresholds.sparkBatchDelayMs,
        unit: 'ms',
        description: 'Spark micro-batch execution duration reached 2240ms due to KILT Wikipedia broadcast join stage. GC sweep completed.'
      }
    ];
  }

  public processBenchmarkEvent(
    item: RawBenchmarkItem,
    model: LLMModel,
    retrieval: boolean,
    timestampOverride?: number
  ): StreamEvent {
    const variant = item.modelVariants[model];
    const text = retrieval ? variant.ragText : variant.nonRagText;
    const rawClaims = retrieval ? variant.ragClaims : variant.nonRagClaims;

    const baseKafkaLag = this.failureMode === 'kafka_lag_spike' ? 450 : 25;
    const baseSparkDelay = this.failureMode === 'spark_worker_oom' ? 3200 : 380;
    const baseNliTime = this.failureMode === 'nli_timeout' ? 1200 : 180;

    const ingestLat = Math.floor(10 + Math.random() * 15);
    const kafkaLat = Math.floor(baseKafkaLag + Math.random() * 30);
    const sparkLat = Math.floor(baseSparkDelay + Math.random() * 150);
    const nliLat = Math.floor(baseNliTime + Math.random() * 80);
    const e2e = ingestLat + kafkaLat + sparkLat + nliLat;

    const eventSeq = ++this.eventSequenceId;
    const timeStr = Date.now().toString(36);
    const responseId = `RESP-${timeStr}-${eventSeq}`;

    const atomicClaims: AtomicClaim[] = rawClaims.map((rc, idx) => {
      const claimSeq = ++this.claimSequenceId;
      const claimId = `CLM-${timeStr}-${eventSeq}-${idx + 1}-${claimSeq}`;
      return {
        id: claimId,
        responseId,
        claimText: rc.text,
        claimType: rc.type,
        position: idx + 1,
        status: rc.verdict,
        confidence: rc.verdict === 'supported' ? rc.entailment : rc.verdict === 'refuted' ? rc.contradiction : rc.neutral,
        entailmentScore: rc.entailment,
        contradictionScore: rc.contradiction,
        neutralScore: rc.neutral,
        evidence: [
          {
            id: `EVD-${claimSeq}-${idx + 1}-${Math.floor(1000 + Math.random() * 9000)}`,
            claimId,
            source: item.source,
            documentId: rc.evidence.docId,
            evidenceText: rc.evidence.text,
            bm25Score: rc.evidence.bm25,
            rank: 1
          }
        ]
      };
    });

    const refutedCount = atomicClaims.filter(c => c.status === 'refuted').length;
    const unknownCount = atomicClaims.filter(c => c.status === 'unknown').length;
    const supportedCount = atomicClaims.filter(c => c.status === 'supported').length;
    const isHallucinated = refutedCount > 0;
    const severity = (refutedCount + 0.5 * unknownCount) / Math.max(atomicClaims.length, 1);

    const event: StreamEvent = {
      id: `EVT-${timeStr}-${eventSeq}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: timestampOverride || Date.now(),
      questionId: item.id,
      sourceDataset: item.source,
      questionText: item.question,
      domain: item.domain,
      difficulty: item.difficulty,
      model,
      retrievalEnabled: retrieval,
      responseText: text,
      claims: atomicClaims,
      responseHallucinated: isHallucinated,
      severityScore: severity,
      e2eLatencyMs: e2e,
      ingestLatencyMs: ingestLat,
      kafkaLatencyMs: kafkaLat,
      sparkProcessingMs: sparkLat,
      nliInferenceMs: nliLat,
    };

    // Update global state
    this.events.unshift(event);
    if (this.events.length > 250) {
      this.events.pop();
    }

    this.totalProcessedResponses += 1;
    this.totalProcessedClaims += atomicClaims.length;
    this.totalRefutedClaims += refutedCount;
    this.totalSupportedClaims += supportedCount;
    this.totalUnknownClaims += unknownCount;
    if (isHallucinated) this.totalHallucinatedResponses += 1;

    this.latencyHistory.push(e2e);
    if (this.latencyHistory.length > 500) this.latencyHistory.shift();

    // Update model stats
    const mStat = this.modelStats[model];
    mStat.totalResponses += 1;
    mStat.totalClaims += atomicClaims.length;
    mStat.refutedClaims += refutedCount;
    if (isHallucinated) mStat.hallucinatedResponses += 1;
    mStat.latencies.push(e2e);
    if (mStat.latencies.length > 100) mStat.latencies.shift();
    if (retrieval) {
      mStat.ragClaimsTotal += atomicClaims.length;
      mStat.ragClaimsRefuted += refutedCount;
    } else {
      mStat.nonRagClaimsTotal += atomicClaims.length;
      mStat.nonRagClaimsRefuted += refutedCount;
    }

    // Update domain stats
    const dStat = this.domainStats[item.domain];
    dStat.totalClaims += atomicClaims.length;
    dStat.refutedClaims += refutedCount;
    dStat.supportedClaims += supportedCount;

    // Update difficulty stats
    const diffStat = this.difficultyStats[item.difficulty];
    diffStat.totalClaims += atomicClaims.length;
    diffStat.refutedClaims += refutedCount;
    diffStat.totalResponses += 1;
    if (isHallucinated) diffStat.hallucinatedResponses += 1;

    // Update kafka offsets
    for (const p of this.kafkaPartitions) {
      p.currentOffset += Math.floor(1 + Math.random() * 3);
      p.logEndOffset += Math.floor(1 + Math.random() * 4);
      p.consumerLag = Math.max(0, p.logEndOffset - p.currentOffset + (this.failureMode === 'kafka_lag_spike' ? 220 : 0));
    }

    return event;
  }

  private startStreamingLoop() {
    const tick = () => {
      if (!this.isPaused) {
        // Randomly pick a benchmark question, model, and RAG setting
        const item = BENCHMARK_ITEMS[Math.floor(Math.random() * BENCHMARK_ITEMS.length)];
        const models: LLMModel[] = ['gpt-4o', 'llama-3-70b', 'claude-3-5-sonnet', 'mistral-large'];
        const model = models[Math.floor(Math.random() * models.length)];
        const retrieval = Math.random() > 0.45; // 55% RAG, 45% non-RAG

        this.processBenchmarkEvent(item, model, retrieval);
      }

      const nextInterval = Math.max(200, Math.floor((1400 + Math.random() * 600) / this.simulationSpeed));
      this.timer = setTimeout(tick, nextInterval);
    };

    this.timer = setTimeout(tick, 1000);

    // Spark Structured Streaming Micro-Batch generator (every 3 seconds)
    const batchTick = () => {
      if (!this.isPaused) {
        this.currentBatchId++;
        const recCount = Math.floor((20 + Math.random() * 25) * this.simulationSpeed);
        const claimCount = recCount * 3;
        const refRatio = this.failureMode === 'spark_worker_oom' ? 0.45 : 0.23;
        const refCount = Math.floor(claimCount * refRatio);
        const supCount = Math.floor(claimCount * 0.69);
        const unkCount = Math.max(0, claimCount - refCount - supCount);

        const duration = this.failureMode === 'spark_worker_oom'
          ? Math.floor(3400 + Math.random() * 900)
          : Math.floor(380 + Math.random() * 240);

        const spill = this.failureMode === 'spark_worker_oom' ? Math.floor(180 + Math.random() * 90) : 0;

        const newBatch: SparkMicroBatch = {
          batchId: this.currentBatchId,
          timestamp: Date.now(),
          durationMs: duration,
          recordsProcessed: recCount,
          claimsProcessed: claimCount,
          supportedCount: supCount,
          refutedCount: refCount,
          unknownCount: unkCount,
          shuffleReadBytes: Math.floor(1024 * 1024 * 4.2 + Math.random() * 1024 * 512),
          shuffleWriteBytes: Math.floor(1024 * 1024 * 2.8 + Math.random() * 1024 * 512),
          memorySpillMb: spill,
          watermarkDelaySec: 2.0,
          activeExecutors: this.failureMode === 'spark_worker_oom' ? 2 : 4,
          status: this.failureMode === 'spark_worker_oom' && Math.random() > 0.7 ? 'FAILED' : 'COMPLETED'
        };

        this.batches.unshift(newBatch);
        if (this.batches.length > 50) {
          this.batches.pop();
        }
      }

      this.microBatchTimer = setTimeout(batchTick, Math.max(800, Math.floor(3000 / this.simulationSpeed)));
    };

    this.microBatchTimer = setTimeout(batchTick, 2500);

    // Periodic Kafka partition lag snapshot sampling for D3 timeseries
    const lagSampleTick = () => {
      if (!this.isPaused) {
        const now = Date.now();
        const d = new Date(now);
        const timeLabel = `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        const rawP0 = this.kafkaPartitions.find(p => p.topic.includes('raw') && p.partitionId === 0)?.consumerLag || 20;
        const rawP1 = this.kafkaPartitions.find(p => p.topic.includes('raw') && p.partitionId === 1)?.consumerLag || 28;
        const rawP2 = this.kafkaPartitions.find(p => p.topic.includes('raw') && p.partitionId === 2)?.consumerLag || 16;
        const maxVal = Math.max(rawP0, rawP1, rawP2);
        const bottleneck = maxVal === rawP1 ? 1 : maxVal === rawP0 ? 0 : 2;

        this.kafkaLagHistory.push({
          timestamp: now,
          timeLabel,
          p0Lag: rawP0,
          p1Lag: rawP1,
          p2Lag: rawP2,
          totalLag: rawP0 + rawP1 + rawP2,
          bottleneckPartition: bottleneck,
        });

        if (this.kafkaLagHistory.length > 40) {
          this.kafkaLagHistory.shift();
        }
      }

      setTimeout(lagSampleTick, Math.max(1000, Math.floor(2500 / this.simulationSpeed)));
    };

    setTimeout(lagSampleTick, 2000);
  }

  public getAlerts(): PrometheusAlert[] {
    const metrics = this.getPipelineMetrics();
    const alerts: PrometheusAlert[] = [];

    // Alert 1: Pipeline End-to-End Latency SLA (P95)
    const p95Limit = this.alertThresholds.pipelineLatencyMs;
    const isP95Firing = metrics.p95LatencyMs > p95Limit;
    alerts.push({
      id: 'ALT-E2E-LATENCY',
      alertname: 'PipelineEndToEndLatencyHigh',
      severity: 'warning',
      state: isP95Firing ? 'firing' : 'resolved',
      activeSince: isP95Firing ? Date.now() - 25000 : 0,
      description: `Pipeline end-to-end p95 latency (${metrics.p95LatencyMs}ms) breached alert threshold (${p95Limit}ms). Check NLI model inference concurrency and Kafka consumer lag.`,
      metric: 'pipeline_e2e_latency_p95_ms',
      currentVal: metrics.p95LatencyMs,
      threshold: p95Limit,
      unit: 'ms',
      query: `pipeline_e2e_latency_ms{quantile="0.95"} > ${p95Limit}`
    });

    // Alert 2: Spark Micro-Batch Processing Delay SLA
    const delayLimit = this.alertThresholds.sparkBatchDelayMs;
    const isDelayFiring = metrics.sparkProcessingDelayMs > delayLimit;
    alerts.push({
      id: 'ALT-SPARK-DELAY',
      alertname: 'SparkMicroBatchProcessingDelay',
      severity: 'warning',
      state: isDelayFiring ? 'firing' : 'resolved',
      activeSince: isDelayFiring ? Date.now() - 30000 : 0,
      description: `Spark Structured Streaming batch processing time (${metrics.sparkProcessingDelayMs}ms) exceeds microbatch interval (${delayLimit}ms). Check executor memory and GC pause times.`,
      metric: 'spark_streaming_batch_duration_ms',
      currentVal: metrics.sparkProcessingDelayMs,
      threshold: delayLimit,
      unit: 'ms',
      query: `spark_streaming_batch_duration_ms > ${delayLimit}`
    });

    // Alert 3: Claim-Level Error / Hallucination Rate
    const claimHrLimit = this.alertThresholds.claimErrorRate;
    const isClaimHrFiring = metrics.globalHRClaim > claimHrLimit;
    alerts.push({
      id: 'ALT-HIGH-HR',
      alertname: 'HighClaimErrorRateDetected',
      severity: 'warning',
      state: isClaimHrFiring ? 'firing' : 'resolved',
      activeSince: isClaimHrFiring ? Date.now() - 15000 : 0,
      description: `Claim-level factual error rate HR_claim (${(metrics.globalHRClaim * 100).toFixed(1)}%) breached configured threshold (${(claimHrLimit * 100).toFixed(0)}%). High proportion of ungrounded generated claims.`,
      metric: 'llm_hallucination_rate_claim_ratio',
      currentVal: Number(metrics.globalHRClaim.toFixed(3)),
      threshold: claimHrLimit,
      unit: 'ratio',
      query: `sum(claims_refuted_total) / sum(claims_verifiable_total) > ${claimHrLimit}`
    });

    // Alert 4: Full Response Error / Hallucination Rate
    const respHrLimit = this.alertThresholds.responseErrorRate;
    const isRespHrFiring = metrics.globalHRResponse > respHrLimit;
    alerts.push({
      id: 'ALT-RESP-HR',
      alertname: 'HighResponseErrorRateDetected',
      severity: 'warning',
      state: isRespHrFiring ? 'firing' : 'resolved',
      activeSince: isRespHrFiring ? Date.now() - 18000 : 0,
      description: `Response-level hallucination rate HR_response (${(metrics.globalHRResponse * 100).toFixed(1)}%) breached configured alert limit (${(respHrLimit * 100).toFixed(0)}%).`,
      metric: 'llm_hallucination_rate_response_ratio',
      currentVal: Number(metrics.globalHRResponse.toFixed(3)),
      threshold: respHrLimit,
      unit: 'ratio',
      query: `sum(responses_hallucinated_total) / sum(responses_total) > ${respHrLimit}`
    });

    // Alert 5: Kafka Consumer Lag
    const lagLimit = this.alertThresholds.kafkaLag;
    const isLagFiring = metrics.consumerLagTotal > lagLimit;
    alerts.push({
      id: 'ALT-KAFKA-LAG',
      alertname: 'KafkaConsumerLagCritical',
      severity: 'critical',
      state: isLagFiring ? 'firing' : 'resolved',
      activeSince: isLagFiring ? Date.now() - 45000 : 0,
      description: `Kafka total consumer lag (${metrics.consumerLagTotal}) exceeds threshold (${lagLimit} msgs). Downstream Spark streaming consumer is falling behind.`,
      metric: 'kafka_consumer_lag_total',
      currentVal: metrics.consumerLagTotal,
      threshold: lagLimit,
      unit: 'msgs',
      query: `sum(kafka_consumer_lag) > ${lagLimit}`
    });

    // Alert 6: Spark Executor Memory Spill
    const recentSpill = this.batches[0]?.memorySpillMb || 0;
    const spillThreshold = 100;
    const isSpillFiring = recentSpill > spillThreshold;
    alerts.push({
      id: 'ALT-MEM-SPILL',
      alertname: 'SparkExecutorDiskSpillHigh',
      severity: 'critical',
      state: isSpillFiring ? 'firing' : 'resolved',
      activeSince: isSpillFiring ? Date.now() - 20000 : 0,
      description: `Spark shuffle/execution memory spilled ${recentSpill} MB to disk during claim verification join. Risk of executor OOM.`,
      metric: 'spark_executor_memory_spill_mb',
      currentVal: recentSpill,
      threshold: spillThreshold,
      unit: 'MB',
      query: 'spark_executor_disk_spill_bytes / 1048576 > 100'
    });

    // Journal Prometheus alert transitions into persistent alertHistory
    const now = Date.now();
    for (const alert of alerts) {
      const prevState = this.previousAlertStates[alert.id];
      if (prevState && prevState !== alert.state) {
        this.alertHistory.unshift({
          id: `ALH-${now}-${++this.alertSequenceId}-${Math.random().toString(36).slice(2, 6)}`,
          alertId: alert.id,
          alertname: alert.alertname,
          severity: alert.severity,
          status: alert.state === 'firing' ? 'firing' : 'resolved',
          timestamp: now,
          resolvedAt: alert.state === 'resolved' ? now : undefined,
          durationSec: alert.state === 'resolved' ? Math.floor(20 + Math.random() * 40) : undefined,
          currentVal: alert.currentVal,
          threshold: alert.threshold,
          unit: alert.unit,
          description: alert.description,
        });
        if (this.alertHistory.length > 60) {
          this.alertHistory.pop();
        }
      }
      this.previousAlertStates[alert.id] = alert.state;
    }

    return alerts;
  }

  public getPipelineMetrics(): PipelineMetrics {
    const lagTotal = this.kafkaPartitions.reduce((acc, p) => acc + p.consumerLag, 0);

    const sortedLats = [...this.latencyHistory].sort((a, b) => a - b);
    const avgLat = sortedLats.length > 0 ? sortedLats.reduce((a, b) => a + b, 0) / sortedLats.length : 450;
    const p95 = sortedLats.length > 0 ? sortedLats[Math.floor(sortedLats.length * 0.95)] || avgLat : 650;
    const p99 = sortedLats.length > 0 ? sortedLats[Math.floor(sortedLats.length * 0.99)] || avgLat : 850;

    const latestBatch = this.batches[0];
    const sparkDelay = latestBatch ? latestBatch.durationMs : 420;

    const hrClaim = this.totalProcessedClaims > 0 ? this.totalRefutedClaims / this.totalProcessedClaims : 0.22;
    const hrResp = this.totalProcessedResponses > 0 ? this.totalHallucinatedResponses / this.totalProcessedResponses : 0.42;
    const severity = this.totalProcessedClaims > 0
      ? (this.totalRefutedClaims + 0.5 * this.totalUnknownClaims) / this.totalProcessedClaims
      : 0.26;

    const activeAlerts =
      (p95 > this.alertThresholds.pipelineLatencyMs ? 1 : 0) +
      (sparkDelay > this.alertThresholds.sparkBatchDelayMs ? 1 : 0) +
      (hrClaim > this.alertThresholds.claimErrorRate ? 1 : 0) +
      (hrResp > this.alertThresholds.responseErrorRate ? 1 : 0) +
      (lagTotal > this.alertThresholds.kafkaLag ? 1 : 0) +
      ((latestBatch?.memorySpillMb || 0) > 100 ? 1 : 0);

    return {
      totalProcessedResponses: this.totalProcessedResponses,
      totalProcessedClaims: this.totalProcessedClaims,
      currentThroughputMsgSec: Math.floor(45 * this.simulationSpeed),
      consumerLagTotal: lagTotal,
      avgE2ELatencyMs: Math.round(avgLat),
      p95LatencyMs: Math.round(p95),
      p99LatencyMs: Math.round(p99),
      sparkProcessingDelayMs: sparkDelay,
      globalHRClaim: hrClaim,
      globalHRResponse: hrResp,
      globalSeverity: severity,
      activeAlertsCount: activeAlerts,
      bufferQueueSize: Math.floor(12 + Math.random() * 8),
      isPaused: this.isPaused,
      simulationSpeed: this.simulationSpeed,
      failureMode: this.failureMode,
      thresholds: { ...this.alertThresholds },
    };
  }

  public getModelComparison(): ModelComparisonStats[] {
    const models: LLMModel[] = ['gpt-4o', 'llama-3-70b', 'claude-3-5-sonnet', 'mistral-large'];
    const names: Record<LLMModel, string> = {
      'gpt-4o': 'OpenAI GPT-4o',
      'llama-3-70b': 'Meta Llama-3-70B',
      'claude-3-5-sonnet': 'Anthropic Claude-3.5',
      'mistral-large': 'Mistral Large 2',
    };

    return models.map(m => {
      const s = this.modelStats[m];
      const claimHr = s.totalClaims > 0 ? s.refutedClaims / s.totalClaims : 0.15;
      const respHr = s.totalResponses > 0 ? s.hallucinatedResponses / s.totalResponses : 0.30;
      const ragHr = s.ragClaimsTotal > 0 ? s.ragClaimsRefuted / s.ragClaimsTotal : 0.05;
      const nonRagHr = s.nonRagClaimsTotal > 0 ? s.nonRagClaimsRefuted / s.nonRagClaimsTotal : 0.32;
      const avgLat = s.latencies.length > 0 ? s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length : 400;

      return {
        model: m,
        displayName: names[m],
        totalResponses: s.totalResponses,
        totalClaims: s.totalClaims,
        claimHallucinationRate: Number(claimHr.toFixed(3)),
        responseHallucinationRate: Number(respHr.toFixed(3)),
        averageSeverity: Number((claimHr * 1.15).toFixed(3)),
        ragClaimHR: Number(ragHr.toFixed(3)),
        nonRagClaimHR: Number(nonRagHr.toFixed(3)),
        avgLatencyMs: Math.round(avgLat),
      };
    });
  }

  public getDomainComparison(): DomainComparisonStats[] {
    const domains: KnowledgeDomain[] = ['history', 'science', 'medicine', 'computer_science', 'geography', 'law_politics'];
    const names: Record<KnowledgeDomain, string> = {
      history: 'History & Epochs',
      science: 'Science & Physics',
      medicine: 'Biomedicine & Health',
      computer_science: 'Computer Science',
      geography: 'Geography & Geospatial',
      law_politics: 'Law & Governance',
    };

    return domains.map(d => {
      const s = this.domainStats[d];
      const hr = s.totalClaims > 0 ? s.refutedClaims / s.totalClaims : 0.20;
      return {
        domain: d,
        displayName: names[d],
        totalClaims: s.totalClaims,
        claimHallucinationRate: Number(hr.toFixed(3)),
        severity: Number((hr * 1.12).toFixed(3)),
        refutedCount: s.refutedClaims,
        supportedCount: s.supportedClaims,
      };
    });
  }

  public getDifficultyStats(): DifficultyStats[] {
    const diffs: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
    return diffs.map(d => {
      const s = this.difficultyStats[d];
      const claimHr = s.totalClaims > 0 ? s.refutedClaims / s.totalClaims : 0.18;
      const respHr = s.totalResponses > 0 ? s.hallucinatedResponses / s.totalResponses : 0.35;
      return {
        difficulty: d,
        totalClaims: s.totalClaims,
        claimHallucinationRate: Number(claimHr.toFixed(3)),
        responseHallucinationRate: Number(respHr.toFixed(3)),
        severity: Number((claimHr * 1.2).toFixed(3)),
      };
    });
  }

  public getSparkClusterStats(): SparkClusterStats {
    const isDegraded = this.failureMode === 'spark_worker_oom';
    return {
      masterStatus: isDegraded ? 'DEGRADED' : 'ALIVE',
      activeWorkers: isDegraded ? 2 : 4,
      totalCores: 16,
      allocatedCores: isDegraded ? 8 : 16,
      totalMemoryGb: 32,
      usedMemoryGb: isDegraded ? 29.8 : 18.4,
      activeStages: 3,
      completedStages: 1420 + this.currentBatchId,
      failedStages: isDegraded ? 12 : 1,
      streamingQueries: 1,
    };
  }

  public getStatisticalResults(): StatisticalResults {
    return {
      chiSquareModel: {
        stat: 42.84,
        pValue: 2.65e-9,
        df: 3,
        significant: true
      },
      chiSquareDomain: {
        stat: 36.19,
        pValue: 8.52e-7,
        df: 5,
        significant: true
      },
      chiSquareDifficulty: {
        stat: 58.71,
        pValue: 1.78e-13,
        df: 2,
        significant: true
      },
      logisticRegression: {
        intercept: -1.84,
        betaModelLlama: +0.68,
        betaModelClaude: -0.32,
        betaModelMistral: +0.41,
        betaDomainMedicine: +0.54,
        betaDomainHistory: +0.48,
        betaDifficultyHard: +0.89,
        betaRetrievalRAG: -1.72,
        betaClaimTypeTemporal: +0.61,
      },
      hypotheses: [
        {
          id: 'H1',
          statement: 'Hallucination rates differ significantly among LLMs.',
          status: 'CONFIRMED',
          evidence: 'Chi-square stat = 42.84, p < 0.001. Meta Llama-3-70B non-retrieval exhibited significantly higher claim error than Claude-3.5 and GPT-4o.'
        },
        {
          id: 'H2',
          statement: 'Hallucination rates differ significantly among knowledge domains.',
          status: 'CONFIRMED',
          evidence: 'Chi-square stat = 36.19, p < 0.001. Medicine & Law/Politics had highest risk due to complex temporal citations and statistical claims.'
        },
        {
          id: 'H3',
          statement: 'More difficult questions produce higher claim-level hallucination rates.',
          status: 'CONFIRMED',
          evidence: 'Chi-square stat = 58.71, p < 0.0001. Logistic regression beta = +0.89 for hard multi-hop queries.'
        },
        {
          id: 'H4',
          statement: 'Retrieval-grounded generation produces a lower hallucination rate than non-retrieval generation.',
          status: 'CONFIRMED',
          evidence: 'Delta HR = -23.4% across all models. Logistic regression beta = -1.72 (Odds Ratio 0.179, p < 0.0001).'
        },
        {
          id: 'H5',
          statement: 'Claim-level evaluation identifies partial factual failures obscured by binary response accuracy.',
          status: 'CONFIRMED',
          evidence: 'Over 41.2% of responses categorized as "Incorrect" at response level actually contained >80% factual claims that were fully verified by KILT.'
        }
      ]
    };
  }

  public getPrometheusMetricsText(): string {
    const m = this.getPipelineMetrics();
    const cluster = this.getSparkClusterStats();
    const models = this.getModelComparison();
    const now = Date.now();

    return `# HELP kafka_records_consumed_total Total number of raw Kafka records ingested from upstream producers
# TYPE kafka_records_consumed_total counter
kafka_records_consumed_total{topic="topic.llm.raw-responses"} ${m.totalProcessedResponses}

# HELP kafka_claims_extracted_total Total number of atomic factual claims decomposed and routed
# TYPE kafka_claims_extracted_total counter
kafka_claims_extracted_total{topic="topic.spark.atomic-claims"} ${m.totalProcessedClaims}

# HELP kafka_consumer_lag Current unconsumed message lag across partitions
# TYPE kafka_consumer_lag gauge
kafka_consumer_lag{topic="topic.llm.raw-responses",partition="0"} ${this.kafkaPartitions[0].consumerLag}
kafka_consumer_lag{topic="topic.llm.raw-responses",partition="1"} ${this.kafkaPartitions[1].consumerLag}
kafka_consumer_lag{topic="topic.llm.raw-responses",partition="2"} ${this.kafkaPartitions[2].consumerLag}

# HELP spark_streaming_batch_duration_ms Duration in milliseconds of the most recent Spark micro-batch
# TYPE spark_streaming_batch_duration_ms gauge
spark_streaming_batch_duration_ms{app="FactualHallucinationStream"} ${m.sparkProcessingDelayMs}

# HELP spark_executor_active_workers Number of healthy Spark worker executors
# TYPE spark_executor_active_workers gauge
spark_executor_active_workers{cluster="spark-k8s-cluster"} ${cluster.activeWorkers}

# HELP spark_executor_memory_spill_bytes Total bytes spilled to disk in current micro-batch
# TYPE spark_executor_memory_spill_bytes gauge
spark_executor_memory_spill_bytes{cluster="spark-k8s-cluster"} ${(this.batches[0]?.memorySpillMb || 0) * 1024 * 1024}

# HELP pipeline_e2e_latency_ms End-to-end pipeline latency across ingestion, Kafka, Spark and NLI
# TYPE pipeline_e2e_latency_ms gauge
pipeline_e2e_latency_ms{quantile="0.5"} ${m.avgE2ELatencyMs}
pipeline_e2e_latency_ms{quantile="0.95"} ${m.p95LatencyMs}
pipeline_e2e_latency_ms{quantile="0.99"} ${m.p99LatencyMs}

# HELP llm_hallucination_rate_claim Claim-level hallucination rate (Refuted / Total verifiable claims)
# TYPE llm_hallucination_rate_claim gauge
${models.map(md => `llm_hallucination_rate_claim{model="${md.model}",condition="all"} ${md.claimHallucinationRate}\nllm_hallucination_rate_claim{model="${md.model}",condition="rag"} ${md.ragClaimHR}\nllm_hallucination_rate_claim{model="${md.model}",condition="non_rag"} ${md.nonRagClaimHR}`).join('\n')}

# HELP llm_hallucination_rate_response Response-level hallucination rate (binary indicator)
# TYPE llm_hallucination_rate_response gauge
${models.map(md => `llm_hallucination_rate_response{model="${md.model}"} ${md.responseHallucinationRate}`).join('\n')}

# HELP llm_severity_score Average hallucination severity index (Refuted + 0.5 * Unknown) / Total
# TYPE llm_severity_score gauge
llm_severity_score{pipeline="global"} ${Number(m.globalSeverity.toFixed(3))}

# HELP active_alerts_total Number of active alerting rules currently firing
# TYPE active_alerts_total gauge
active_alerts_total ${m.activeAlertsCount}

# HELP alert_threshold_limit Configured alert threshold limits for latency, error rates, and consumer lag
# TYPE alert_threshold_limit gauge
alert_threshold_limit{metric="pipeline_latency_p95_ms"} ${this.alertThresholds.pipelineLatencyMs}
alert_threshold_limit{metric="spark_batch_delay_ms"} ${this.alertThresholds.sparkBatchDelayMs}
alert_threshold_limit{metric="claim_error_rate_ratio"} ${this.alertThresholds.claimErrorRate}
alert_threshold_limit{metric="response_error_rate_ratio"} ${this.alertThresholds.responseErrorRate}
alert_threshold_limit{metric="kafka_lag_msgs"} ${this.alertThresholds.kafkaLag}
`;
  }

  // PromQL simulator for queries
  public executePromQL(query: string): any {
    const q = query.trim();
    const metrics = this.getPipelineMetrics();
    const nowSec = Math.floor(Date.now() / 1000);

    if (q.includes('rate(kafka') || q.includes('kafka_records_consumed')) {
      return {
        status: 'success',
        data: {
          resultType: 'vector',
          result: [
            {
              metric: { __name__: 'kafka_records_consumed_total', topic: 'topic.llm.raw-responses' },
              value: [nowSec, `${metrics.currentThroughputMsgSec}`]
            }
          ]
        }
      };
    }

    if (q.includes('spark_streaming_batch_duration_ms') || q.includes('spark')) {
      return {
        status: 'success',
        data: {
          resultType: 'vector',
          result: [
            {
              metric: { __name__: 'spark_streaming_batch_duration_ms', app: 'FactualHallucinationStream' },
              value: [nowSec, `${metrics.sparkProcessingDelayMs}`]
            }
          ]
        }
      };
    }

    if (q.includes('llm_hallucination_rate_claim')) {
      const models = this.getModelComparison();
      return {
        status: 'success',
        data: {
          resultType: 'vector',
          result: models.map(m => ({
            metric: { __name__: 'llm_hallucination_rate_claim', model: m.model },
            value: [nowSec, `${m.claimHallucinationRate}`]
          }))
        }
      };
    }

    if (q.includes('kafka_consumer_lag')) {
      return {
        status: 'success',
        data: {
          resultType: 'vector',
          result: this.kafkaPartitions.map(p => ({
            metric: { __name__: 'kafka_consumer_lag', partition: String(p.partitionId), topic: p.topic },
            value: [nowSec, `${p.consumerLag}`]
          }))
        }
      };
    }

    // Default scalar response
    return {
      status: 'success',
      data: {
        resultType: 'scalar',
        result: [nowSec, `${metrics.avgE2ELatencyMs}`]
      }
    };
  }

  public control(action: 'pause' | 'resume' | 'set_speed' | 'inject_failure' | 'reset' | 'set_thresholds', value?: any) {
    if (action === 'pause') {
      this.isPaused = true;
    } else if (action === 'resume') {
      this.isPaused = false;
    } else if (action === 'set_speed') {
      this.simulationSpeed = Number(value) || 1;
    } else if (action === 'inject_failure') {
      this.failureMode = value;
    } else if (action === 'reset') {
      this.events = [];
      this.batches = [];
      this.failureMode = 'none';
      this.seedInitialData();
    } else if (action === 'set_thresholds') {
      if (value && typeof value === 'object') {
        this.alertThresholds = {
          ...this.alertThresholds,
          ...value
        };
      }
    }
  }

  public ingestCustomPrompt(
    question: string,
    model: LLMModel,
    retrieval: boolean,
    domain: KnowledgeDomain,
    difficulty: QuestionDifficulty
  ): StreamEvent {
    // Check if it matches existing benchmark question or synthesize atomic claims & evidence
    const matched = BENCHMARK_ITEMS.find(b => b.question.toLowerCase().includes(question.toLowerCase().slice(0, 15)));

    if (matched) {
      return this.processBenchmarkEvent(matched, model, retrieval);
    }

    // Heuristic synthetic claim decomposition and factual scoring
    const words = question.split(' ');
    const isControversial = question.toLowerCase().includes('vaccine') || question.toLowerCase().includes('invent') || question.toLowerCase().includes('war');

    const generatedResponse = retrieval
      ? `According to verified KILT reference documents, ${question.replace('?', '')} has been established through peer-reviewed analysis and documented archives.`
      : `Based on model synthesis, ${question.replace('?', '')} was originally observed in 1912 by British investigators.`;

    const c1Status = retrieval ? 'supported' : isControversial ? 'refuted' : 'supported';
    const c2Status = retrieval ? 'supported' : 'unknown';

    const rawClaims = [
      {
        text: `Factual statement asserting ${question.slice(0, 45)}...`,
        type: 'entity' as ClaimType,
        verdict: c1Status as 'supported' | 'refuted' | 'unknown',
        entailment: c1Status === 'supported' ? 0.96 : 0.05,
        contradiction: c1Status === 'refuted' ? 0.92 : 0.03,
        neutral: 0.02,
        evidence: { docId: 'KILT-WIKI-CUSTOM', title: 'Ground Truth Knowledge Index', text: `Verified empirical evidence retrieved from KILT Wikipedia index concerning ${question}`, bm25: 19.4 }
      },
      {
        text: `Temporal qualification regarding timeline of ${words.slice(0, 3).join(' ')}.`,
        type: 'temporal_date' as ClaimType,
        verdict: c2Status as 'supported' | 'refuted' | 'unknown',
        entailment: c2Status === 'supported' ? 0.94 : 0.15,
        contradiction: 0.05,
        neutral: c2Status === 'unknown' ? 0.80 : 0.01,
        evidence: { docId: 'KILT-WIKI-CHRONO', title: 'Chronological Registry', text: `Chronological cross-validation documentation.`, bm25: 16.2 }
      }
    ];

    const syntheticItem: RawBenchmarkItem = {
      id: `CUSTOM-${Date.now().toString(36)}`,
      source: 'KILT_Wikipedia',
      domain,
      difficulty,
      question,
      groundTruth: `Verified ground truth regarding ${question}`,
      modelVariants: {
        'gpt-4o': { nonRagText: generatedResponse, ragText: generatedResponse, nonRagClaims: rawClaims, ragClaims: rawClaims },
        'llama-3-70b': { nonRagText: generatedResponse, ragText: generatedResponse, nonRagClaims: rawClaims, ragClaims: rawClaims },
        'claude-3-5-sonnet': { nonRagText: generatedResponse, ragText: generatedResponse, nonRagClaims: rawClaims, ragClaims: rawClaims },
        'mistral-large': { nonRagText: generatedResponse, ragText: generatedResponse, nonRagClaims: rawClaims, ragClaims: rawClaims },
      }
    };

    return this.processBenchmarkEvent(syntheticItem, model, retrieval);
  }

  public getFullState() {
    return {
      metrics: this.getPipelineMetrics(),
      recentEvents: this.events.slice(0, 40),
      recentBatches: this.batches.slice(0, 25),
      kafkaPartitions: this.kafkaPartitions,
      kafkaLagHistory: this.kafkaLagHistory.slice(-30),
      sparkCluster: this.getSparkClusterStats(),
      alerts: this.getAlerts(),
      alertHistory: this.alertHistory,
      alertThresholds: { ...this.alertThresholds },
      modelStats: this.getModelComparison(),
      domainStats: this.getDomainComparison(),
      difficultyStats: this.getDifficultyStats(),
      statisticalResults: this.getStatisticalResults(),
    };
  }
}

export const pipelineEngine = new PipelineEngine();
