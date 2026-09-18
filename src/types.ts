/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClaimStatus = 'supported' | 'refuted' | 'unknown';

export type ClaimType =
  | 'entity'
  | 'temporal_date'
  | 'quantitative'
  | 'causal'
  | 'definitional';

export type LLMModel =
  | 'gpt-4o'
  | 'llama-3-70b'
  | 'claude-3-5-sonnet'
  | 'mistral-large';

export type KnowledgeDomain =
  | 'history'
  | 'science'
  | 'medicine'
  | 'computer_science'
  | 'geography'
  | 'law_politics';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export type BenchmarkSource = 'FEVER' | 'HaluEval' | 'TruthfulQA' | 'KILT_Wikipedia';

export interface EvidenceItem {
  id: string;
  claimId: string;
  source: string;
  documentId: string;
  evidenceText: string;
  bm25Score: number;
  rank: number;
}

export interface AtomicClaim {
  id: string;
  responseId: string;
  claimText: string;
  claimType: ClaimType;
  position: number;
  status: ClaimStatus;
  confidence: number;
  entailmentScore: number;
  contradictionScore: number;
  neutralScore: number;
  evidence: EvidenceItem[];
}

export interface StreamEvent {
  id: string;
  timestamp: number;
  questionId: string;
  sourceDataset: BenchmarkSource;
  questionText: string;
  domain: KnowledgeDomain;
  difficulty: QuestionDifficulty;
  model: LLMModel;
  retrievalEnabled: boolean;
  responseText: string;
  claims: AtomicClaim[];
  responseHallucinated: boolean;
  severityScore: number;
  e2eLatencyMs: number;
  ingestLatencyMs: number;
  kafkaLatencyMs: number;
  sparkProcessingMs: number;
  nliInferenceMs: number;
}

export interface SparkMicroBatch {
  batchId: number;
  timestamp: number;
  durationMs: number;
  recordsProcessed: number;
  claimsProcessed: number;
  supportedCount: number;
  refutedCount: number;
  unknownCount: number;
  shuffleReadBytes: number;
  shuffleWriteBytes: number;
  memorySpillMb: number;
  watermarkDelaySec: number;
  activeExecutors: number;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
}

export interface KafkaPartitionStats {
  partitionId: number;
  topic: string;
  currentOffset: number;
  logEndOffset: number;
  consumerLag: number;
  msgRateSec: number;
}

export interface SparkClusterStats {
  masterStatus: 'ALIVE' | 'STANDBY' | 'DEGRADED';
  activeWorkers: number;
  totalCores: number;
  allocatedCores: number;
  totalMemoryGb: number;
  usedMemoryGb: number;
  activeStages: number;
  completedStages: number;
  failedStages: number;
  streamingQueries: number;
}

export interface AlertThresholds {
  pipelineLatencyMs: number; // E2E P95 pipeline latency threshold (ms)
  sparkBatchDelayMs: number; // Spark micro-batch SLA threshold (ms)
  claimErrorRate: number; // Claim-level hallucination/error rate threshold (0-1)
  responseErrorRate: number; // Response-level hallucination/error rate threshold (0-1)
  kafkaLag: number; // Kafka total consumer lag threshold (msgs)
}

export interface PrometheusAlert {
  id: string;
  alertname: string;
  severity: 'critical' | 'warning' | 'info';
  state: 'firing' | 'pending' | 'resolved';
  activeSince: number;
  description: string;
  metric: string;
  currentVal: number;
  threshold: number;
  unit: string;
  query: string;
}

export interface AlertHistoryEvent {
  id: string;
  alertId: string;
  alertname: string;
  name?: string;
  metric?: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'firing' | 'pending' | 'resolved';
  state?: 'firing' | 'pending' | 'resolved';
  timestamp: number;
  resolvedAt?: number;
  durationSec?: number;
  currentVal: number;
  value?: number;
  threshold: number;
  unit: string;
  description: string;
}

export interface KafkaPartitionLagPoint {
  timestamp: number;
  timeLabel: string;
  p0Lag: number;
  p1Lag: number;
  p2Lag: number;
  totalLag: number;
  bottleneckPartition: number;
}

export interface PipelineMetrics {
  totalProcessedResponses: number;
  totalProcessedClaims: number;
  currentThroughputMsgSec: number;
  consumerLagTotal: number;
  avgE2ELatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  sparkProcessingDelayMs: number;
  globalHRClaim: number;
  globalHRResponse: number;
  globalSeverity: number;
  activeAlertsCount: number;
  bufferQueueSize: number;
  isPaused: boolean;
  simulationSpeed: number; // 1x, 2x, 5x
  failureMode: 'none' | 'kafka_lag_spike' | 'spark_worker_oom' | 'nli_timeout';
  thresholds?: AlertThresholds;
}

export interface ModelComparisonStats {
  model: LLMModel;
  displayName: string;
  totalResponses: number;
  totalClaims: number;
  claimHallucinationRate: number;
  responseHallucinationRate: number;
  averageSeverity: number;
  ragClaimHR: number;
  nonRagClaimHR: number;
  avgLatencyMs: number;
}

export interface DomainComparisonStats {
  domain: KnowledgeDomain;
  displayName: string;
  totalClaims: number;
  claimHallucinationRate: number;
  severity: number;
  refutedCount: number;
  supportedCount: number;
}

export interface DifficultyStats {
  difficulty: QuestionDifficulty;
  totalClaims: number;
  claimHallucinationRate: number;
  responseHallucinationRate: number;
  severity: number;
}

export interface ScalabilityBenchmarkPoint {
  workers: number;
  dataScaleRecords: number;
  processingTimeSec: number;
  speedup: number;
  efficiency: number;
  throughputRecSec: number;
}

export interface StatisticalResults {
  chiSquareModel: { stat: number; pValue: number; df: number; significant: boolean };
  chiSquareDomain: { stat: number; pValue: number; df: number; significant: boolean };
  chiSquareDifficulty: { stat: number; pValue: number; df: number; significant: boolean };
  logisticRegression: {
    intercept: number;
    betaModelLlama: number;
    betaModelClaude: number;
    betaModelMistral: number;
    betaDomainMedicine: number;
    betaDomainHistory: number;
    betaDifficultyHard: number;
    betaRetrievalRAG: number;
    betaClaimTypeTemporal: number;
  };
  hypotheses: Array<{
    id: string;
    statement: string;
    status: 'SUPPORTED' | 'CONFIRMED' | 'SIGNIFICANT';
    evidence: string;
  }>;
}
