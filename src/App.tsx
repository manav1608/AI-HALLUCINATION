/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { StreamDashboard } from './components/StreamDashboard.js';
import { GrafanaDashboard } from './components/GrafanaDashboard.js';
import { ResearchProfiler } from './components/ResearchProfiler.js';
import { SparkClusterView } from './components/SparkClusterView.js';
import { CodeExportView } from './components/CodeExportView.js';
import { ClaimInspectorModal } from './components/ClaimInspectorModal.js';
import {
  StreamEvent,
  SparkMicroBatch,
  KafkaPartitionStats,
  SparkClusterStats,
  PrometheusAlert,
  PipelineMetrics,
  AlertThresholds,
  ModelComparisonStats,
  DomainComparisonStats,
  DifficultyStats,
  StatisticalResults,
  LLMModel,
  KnowledgeDomain,
  QuestionDifficulty
} from './types.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<'stream' | 'grafana' | 'research' | 'spark' | 'code'>('stream');
  const [inspectEvent, setInspectEvent] = useState<StreamEvent | null>(null);

  // Live state from backend pipeline engine
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [batches, setBatches] = useState<SparkMicroBatch[]>([]);
  const [partitions, setPartitions] = useState<KafkaPartitionStats[]>([]);
  const [cluster, setCluster] = useState<SparkClusterStats | null>(null);
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThresholds>({
    pipelineLatencyMs: 650,
    sparkBatchDelayMs: 2000,
    claimErrorRate: 0.35,
    responseErrorRate: 0.45,
    kafkaLag: 250,
  });
  const [modelStats, setModelStats] = useState<ModelComparisonStats[]>([]);
  const [domainStats, setDomainStats] = useState<DomainComparisonStats[]>([]);
  const [difficultyStats, setDifficultyStats] = useState<DifficultyStats[]>([]);
  const [statisticalResults, setStatisticalResults] = useState<StatisticalResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Poll state from server every 1.5 seconds
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/state');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setEvents(data.recentEvents);
        setBatches(data.recentBatches);
        setPartitions(data.kafkaPartitions);
        setCluster(data.sparkCluster);
        setAlerts(data.alerts);
        if (data.alertThresholds) {
          setThresholds(data.alertThresholds);
        }
        setModelStats(data.modelStats);
        setDomainStats(data.domainStats);
        setDifficultyStats(data.difficultyStats);
        setStatisticalResults(data.statisticalResults);
      }
    } catch (err) {
      console.error('Error fetching pipeline state:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Handle pipeline controls (pause, speed, fault injection, reset, thresholds)
  const handleControl = async (
    action: 'pause' | 'resume' | 'set_speed' | 'inject_failure' | 'reset' | 'set_thresholds',
    value?: any
  ) => {
    try {
      await fetch('/api/pipeline/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      fetchState();
    } catch (err) {
      console.error('Control error:', err);
    }
  };

  const handleUpdateThresholds = async (newThresholds: AlertThresholds) => {
    setThresholds(newThresholds);
    await handleControl('set_thresholds', newThresholds);
  };

  // Handle custom prompt injection
  const handleIngestPrompt = async (
    question: string,
    model: LLMModel,
    retrieval: boolean,
    domain: KnowledgeDomain,
    difficulty: QuestionDifficulty
  ) => {
    try {
      const res = await fetch('/api/pipeline/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, model, retrieval, domain, difficulty }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.event) {
          setInspectEvent(data.event);
        }
        fetchState();
      }
    } catch (err) {
      console.error('Ingest error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header & Global Status */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        metrics={metrics}
        onControl={handleControl}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {isLoading && !metrics ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-400">
              Connecting to Apache Kafka &amp; Spark Structured Streaming cluster...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'stream' && (
              <StreamDashboard
                metrics={metrics}
                events={events}
                batches={batches}
                partitions={partitions}
                onInspectEvent={setInspectEvent}
                onIngestPrompt={handleIngestPrompt}
              />
            )}

            {activeTab === 'grafana' && (
              <GrafanaDashboard
                metrics={metrics}
                batches={batches}
                partitions={partitions}
                alerts={alerts}
                modelStats={modelStats}
                thresholds={thresholds}
                onUpdateThresholds={handleUpdateThresholds}
              />
            )}

            {activeTab === 'research' && (
              <ResearchProfiler
                modelStats={modelStats}
                domainStats={domainStats}
                difficultyStats={difficultyStats}
                statisticalResults={statisticalResults}
              />
            )}

            {activeTab === 'spark' && (
              <SparkClusterView
                cluster={cluster}
                recentBatches={batches}
              />
            )}

            {activeTab === 'code' && (
              <CodeExportView />
            )}
          </>
        )}
      </main>

      {/* Claim Detail Inspector Modal */}
      <ClaimInspectorModal
        event={inspectEvent}
        onClose={() => setInspectEvent(null)}
      />
    </div>
  );
}
