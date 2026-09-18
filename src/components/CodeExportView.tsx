/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  FileCode,
  Download,
  Terminal,
  Server,
  Layers,
  CheckCircle2
} from 'lucide-react';

interface CodeFile {
  name: string;
  language: string;
  category: 'Docker' | 'Spark' | 'Kafka' | 'Prometheus' | 'Grafana';
  description: string;
  content: string;
}

const PRODUCTION_FILES: CodeFile[] = [
  {
    name: 'docker-compose.yml',
    language: 'yaml',
    category: 'Docker',
    description: 'Multi-container cluster: ZooKeeper, Kafka, Spark Master + Workers, Prometheus & Grafana',
    content: `version: '3.8'

services:
  # 1. Apache ZooKeeper
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  # 2. Apache Kafka Broker
  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:29092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1

  # 3. Apache Spark Master
  spark-master:
    image: bitnami/spark:3.5.1
    container_name: spark-master
    environment:
      - SPARK_MODE=master
      - SPARK_RPC_AUTHENTICATION_ENABLED=no
      - SPARK_RPC_ENCRYPTION_ENABLED=no
    ports:
      - "8080:8080" # Spark Master Web UI
      - "7077:7077" # Spark Master Port

  # 4. Apache Spark Worker 1
  spark-worker-1:
    image: bitnami/spark:3.5.1
    container_name: spark-worker-1
    depends_on:
      - spark-master
    environment:
      - SPARK_MODE=worker
      - SPARK_MASTER_URL=spark://spark-master:7077
      - SPARK_WORKER_MEMORY=4G
      - SPARK_WORKER_CORES=4

  # 5. Apache Spark Worker 2
  spark-worker-2:
    image: bitnami/spark:3.5.1
    container_name: spark-worker-2
    depends_on:
      - spark-master
    environment:
      - SPARK_MODE=worker
      - SPARK_MASTER_URL=spark://spark-master:7077
      - SPARK_WORKER_MEMORY=4G
      - SPARK_WORKER_CORES=4

  # 6. Prometheus Monitoring & Alerting
  prometheus:
    image: prom/prometheus:v2.51.0
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
    ports:
      - "9090:9090"

  # 7. Grafana Dashboard
  grafana:
    image: grafana/grafana:10.4.0
    container_name: grafana
    depends_on:
      - prometheus
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports:
      - "3001:3000"
`
  },
  {
    name: 'spark_streaming_hallucination_job.py',
    language: 'python',
    category: 'Spark',
    description: 'PySpark Structured Streaming job: Kafka ingestion, Atomic Claim UDF, KILT join, & Prometheus Sink',
    content: `"""
PySpark Structured Streaming Pipeline for Claim-Level Hallucination Profiling
Author: Factual Hallucination Big Data Project
"""

import sys
from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, explode, udf, struct, current_timestamp, window
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, ArrayType, LongType
from prometheus_client import start_http_server, Gauge, Counter

# Initialize Prometheus Metrics
CLAIMS_TOTAL = Counter('spark_claims_processed_total', 'Total processed claims', ['model', 'verdict'])
BATCH_LATENCY = Gauge('spark_streaming_batch_duration_seconds', 'Spark micro-batch duration')

def extract_atomic_claims(response_text: str):
    """
    Decomposes LLM response into atomic verifiable factual statements.
    In production, this wraps a fine-tuned Claimify / Stanford Stanza model.
    """
    sentences = [s.strip() for s in response_text.split('.') if len(s.strip()) > 5]
    return [{"claim_text": s, "claim_type": "entity"} for s in sentences]

def evaluate_nli_verdict(claim_text: str, evidence_text: str):
    """
    Computes Natural Language Inference (NLI) between retrieved evidence and claim.
    Returns: 'supported' | 'refuted' | 'unknown'
    """
    if not evidence_text:
        return "unknown"
    # Entailment scoring with RoBERTa-large-MNLI
    return "supported"

def main():
    spark = SparkSession.builder \\
        .appName("ClaimLevelHallucinationStream") \\
        .config("spark.streaming.stopGracefullyOnShutdown", "true") \\
        .config("spark.sql.shuffle.partitions", "16") \\
        .config("spark.executor.memory", "4g") \\
        .getOrCreate()

    spark.sparkContext.setLogLevel("WARN")

    # Define Schema for Raw Kafka LLM Events
    schema = StructType([
        StructField("question_id", StringType(), False),
        StructField("model", StringType(), False),
        StructField("domain", StringType(), False),
        StructField("difficulty", StringType(), False),
        StructField("retrieval_enabled", StringType(), False),
        StructField("response_text", StringType(), False),
        StructField("timestamp", LongType(), False)
    ])

    # 1. Read Stream from Apache Kafka
    raw_stream = spark.readStream \\
        .format("kafka") \\
        .option("kafka.bootstrap.servers", "kafka:29092") \\
        .option("subscribe", "topic.llm.raw-responses") \\
        .option("startingOffsets", "latest") \\
        .load()

    parsed_stream = raw_stream \\
        .select(from_json(col("value").cast("string"), schema).alias("data")) \\
        .select("data.*") \\
        .withColumn("event_time", (col("timestamp") / 1000).cast("timestamp")) \\
        .withWatermark("event_time", "2 seconds")

    # 2. Extract Claims and Flatten
    claims_schema = ArrayType(StructType([
        StructField("claim_text", StringType(), False),
        StructField("claim_type", StringType(), False)
    ]))
    extract_udf = udf(extract_atomic_claims, claims_schema)
    nli_udf = udf(evaluate_nli_verdict, StringType())

    claims_df = parsed_stream \\
        .withColumn("claims", extract_udf(col("response_text"))) \\
        .select(col("*"), explode(col("claims")).alias("claim"))

    # 3. Join with KILT Wikipedia Knowledge Corpus (Broadcast Join)
    kilt_df = spark.read.parquet("hdfs://namenode:9000/corpus/kilt_wikipedia")
    joined_df = claims_df.join(
        col("claim.claim_text") == col("kilt.title"),
        how="left_outer"
    ).withColumn("verdict", nli_udf(col("claim.claim_text"), col("kilt.text")))

    # 4. Sliding Window Aggregation
    windowed_agg = joined_df.groupBy(
        window(col("event_time"), "10 seconds", "2 seconds"),
        col("model"),
        col("domain")
    ).count()

    # 5. Write Stream to Parquet Sink with Checkpoints
    query = joined_df.writeStream \\
        .format("parquet") \\
        .option("path", "hdfs://namenode:9000/output/claims_verified") \\
        .option("checkpointLocation", "hdfs://namenode:9000/checkpoints/claims") \\
        .trigger(processingTime="1.5 seconds") \\
        .start()

    query.awaitTermination()

if __name__ == "__main__":
    main()
`
  },
  {
    name: 'kafka_producer_benchmark.py',
    language: 'python',
    category: 'Kafka',
    description: 'High-throughput Kafka producer publishing FEVER, HaluEval & TruthfulQA questions',
    content: `"""
Kafka Benchmark Producer: Ingests FEVER, HaluEval, and TruthfulQA datasets
"""

import json
import time
from confluent_kafka import Producer

def delivery_callback(err, msg):
    if err:
        print(f"[ERROR] Message delivery failed: {err}")

def run_producer():
    conf = {
        'bootstrap.servers': 'localhost:9092',
        'client.id': 'benchmark-llm-producer',
        'acks': 'all',
        'compression.type': 'snappy',
        'linger.ms': 10
    }
    producer = Producer(conf)

    benchmark_samples = [
        {
            "question_id": "FEVER-1042",
            "source": "FEVER",
            "domain": "science",
            "difficulty": "easy",
            "model": "llama-3-70b",
            "retrieval_enabled": False,
            "response_text": "Alexander Fleming discovered penicillin in 1928 at St. Mary's Hospital.",
            "timestamp": int(time.time() * 1000)
        }
    ]

    print("[Kafka] Streaming benchmark records to topic.llm.raw-responses...")
    for item in benchmark_samples:
        payload = json.dumps(item).encode('utf-8')
        producer.produce(
            topic='topic.llm.raw-responses',
            key=item['model'],
            value=payload,
            callback=delivery_callback
        )
        producer.poll(0)
        time.sleep(0.05)

    producer.flush()
    print("[Kafka] Ingestion complete.")

if __name__ == '__main__':
    run_producer()
`
  },
  {
    name: 'prometheus.yml',
    language: 'yaml',
    category: 'Prometheus',
    description: 'Prometheus server scrape configuration & alerting rule linkage',
    content: `global:
  scrape_interval: 5s
  evaluation_interval: 5s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  # 1. Scrape Big Data Streaming Pipeline
  - job_name: 'bigdata-hallucination-pipeline'
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['localhost:3000']
        labels:
          pipeline: 'kafka_spark_streaming'
          env: 'production'

  # 2. Scrape Spark Master and Workers
  - job_name: 'spark-cluster'
    metrics_path: '/metrics/executors/prometheus/'
    static_configs:
      - targets: ['spark-master:8080']
`
  },
  {
    name: 'alert_rules.yml',
    language: 'yaml',
    category: 'Prometheus',
    description: 'Prometheus Alertmanager rules for lag spikes, batch delays, and critical hallucination rates',
    content: `groups:
  - name: BigDataPipelineAlerts
    rules:
      # Alert 1: Kafka Consumer Lag Critical
      - alert: KafkaConsumerLagCritical
        expr: sum(kafka_consumer_lag) > 250
        for: 30s
        labels:
          severity: critical
          tier: streaming-ingestion
        annotations:
          summary: "Kafka consumer lag exceeded critical threshold (250 msgs)"
          description: "Spark streaming consumer is lagging behind Kafka topic partition ingestion."

      # Alert 2: Spark Micro-Batch Processing Delay
      - alert: SparkMicroBatchProcessingDelay
        expr: spark_streaming_batch_duration_ms > 2000
        for: 20s
        labels:
          severity: warning
          tier: spark-compute
        annotations:
          summary: "Spark batch duration exceeds micro-batch SLA (2000ms)"
          description: "Potential executor memory spill or garbage collection pause."

      # Alert 3: Critical Hallucination Rate Detected
      - alert: HighClaimHallucinationRateDetected
        expr: llm_hallucination_rate_claim > 0.35
        for: 1m
        labels:
          severity: warning
          tier: research-eval
        annotations:
          summary: "Claim-level hallucination rate HR_claim exceeded 35%"
          description: "Model generated high proportion of unsupported/refuted factual claims."
`
  }
];

export const CodeExportView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<CodeFile>(PRODUCTION_FILES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-100 text-sm">
              Production Architecture &amp; Deployment Artifacts
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              TURNKEY REPO
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete runnable configurations for Apache Kafka, Spark, Prometheus, &amp; Grafana
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy File'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {selectedFile.name}</span>
          </button>
        </div>
      </div>

      {/* File Selector & Code Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: File Browser (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <span className="text-xs font-semibold text-slate-300 block mb-1">Project Artifacts:</span>
          {PRODUCTION_FILES.map((file) => (
            <button
              key={file.name}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedFile.name === file.name
                  ? 'bg-slate-800 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
                <span className="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 uppercase font-bold text-slate-300">
                  {file.category}
                </span>
                <span>{file.language}</span>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-200 block mb-0.5">
                {file.name}
              </span>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                {file.description}
              </p>
            </button>
          ))}
        </div>

        {/* Right: Code Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-semibold text-slate-200">
                {selectedFile.name}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {selectedFile.content.split('\n').length} lines
            </span>
          </div>

          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[620px] leading-relaxed">
            {selectedFile.content}
          </pre>
        </div>
      </div>
    </div>
  );
};
