/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { pipelineEngine } from './server/pipelineEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      engine: 'Apache Kafka + Spark Structured Streaming Hallucination Profiler',
      timestamp: Date.now(),
    });
  });

  // 2. Prometheus OpenMetrics text format endpoint
  app.get('/api/metrics', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metricsText = pipelineEngine.getPrometheusMetricsText();
    res.send(metricsText);
  });

  // 3. Pipeline state snapshot
  app.get('/api/pipeline/state', (req, res) => {
    const state = pipelineEngine.getFullState();
    res.json(state);
  });

  // 4. Pipeline controls (pause, speed, fault injection, reset)
  app.post('/api/pipeline/control', (req, res) => {
    const { action, value } = req.body;
    pipelineEngine.control(action, value);
    res.json({ status: 'ok', action, value });
  });

  // 5. Ingest custom question or test prompt
  app.post('/api/pipeline/ingest', (req, res) => {
    const { question, model, retrieval, domain, difficulty } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question text is required' });
    }

    const event = pipelineEngine.ingestCustomPrompt(
      question,
      model || 'llama-3-70b',
      Boolean(retrieval),
      domain || 'science',
      difficulty || 'medium'
    );

    res.json({ status: 'ingested', event });
  });

  // 6. PromQL Query Endpoint (Prometheus compatible)
  app.get('/api/prometheus/query', (req, res) => {
    const query = String(req.query.query || '');
    const result = pipelineEngine.executePromQL(query);
    res.json(result);
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BigDataPipeline] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Prometheus] Metrics exporter available at http://0.0.0.0:${PORT}/api/metrics`);
  });
}

startServer();
