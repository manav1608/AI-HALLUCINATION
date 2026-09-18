/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { KafkaPartitionLagPoint, KafkaPartitionStats } from '../types.js';
import { AlertCircle, ArrowUpRight, Gauge, Layers, RefreshCw, Zap } from 'lucide-react';

interface KafkaPartitionLagD3Props {
  history: KafkaPartitionLagPoint[];
  currentPartitions: KafkaPartitionStats[];
  thresholdLimit?: number;
}

export const KafkaPartitionLagD3: React.FC<KafkaPartitionLagD3Props> = ({
  history,
  currentPartitions,
  thresholdLimit = 250
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 260 });
  const [activePartitionFilter, setActivePartitionFilter] = useState<'all' | 'p0' | 'p1' | 'p2'>('all');
  const [hoverData, setHoverData] = useState<KafkaPartitionLagPoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // ResizeObserver for responsive SVG sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width } = entry.contentRect;
      if (width > 50) {
        setDimensions({ width, height: 250 });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute latest partition stats & identify throughput bottleneck
  const partitionAnalysis = useMemo(() => {
    const rawPartitions = currentPartitions.filter(p => p.topic.includes('raw'));
    const p0 = rawPartitions.find(p => p.partitionId === 0)?.consumerLag ?? 18;
    const p1 = rawPartitions.find(p => p.partitionId === 1)?.consumerLag ?? 26;
    const p2 = rawPartitions.find(p => p.partitionId === 2)?.consumerLag ?? 15;
    const total = p0 + p1 + p2;

    const items = [
      { id: 0, name: 'Partition 0', lag: p0, color: '#06b6d4', key: 'p0Lag' as const },
      { id: 1, name: 'Partition 1', lag: p1, color: '#f59e0b', key: 'p1Lag' as const },
      { id: 2, name: 'Partition 2', lag: p2, color: '#a855f7', key: 'p2Lag' as const },
    ];

    const maxItem = [...items].sort((a, b) => b.lag - a.lag)[0];
    const bottleneckShare = total > 0 ? Math.round((maxItem.lag / total) * 100) : 33;
    const perPartitionThreshold = Math.round(thresholdLimit / 3);
    const isBottleneckSevere = maxItem.lag > perPartitionThreshold * 0.75;

    return {
      items,
      total,
      bottleneck: maxItem,
      bottleneckShare,
      isBottleneckSevere,
      perPartitionThreshold
    };
  }, [currentPartitions, thresholdLimit]);

  // Render D3 chart
  useEffect(() => {
    if (!svgRef.current || !history || history.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 35, bottom: 30, left: 45 };
    const innerWidth = Math.max(50, width - margin.left - margin.right);
    const innerHeight = Math.max(50, height - margin.top - margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X and Y scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(history, (d: KafkaPartitionLagPoint) => new Date(d.timestamp)) as [Date, Date])
      .range([0, innerWidth]);

    const maxVal = d3.max(history, (d: KafkaPartitionLagPoint) => Math.max(d.p0Lag, d.p1Lag, d.p2Lag, partitionAnalysis.perPartitionThreshold)) || 50;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal * 1.25])
      .range([innerHeight, 0])
      .nice();

    // Defs & Gradients
    const defs = svg.append('defs');

    // Create gradient for each partition
    const colors = [
      { id: 'grad-p0', color: '#06b6d4' },
      { id: 'grad-p1', color: '#f59e0b' },
      { id: 'grad-p2', color: '#a855f7' }
    ];

    colors.forEach(({ id, color }) => {
      const grad = defs
        .append('linearGradient')
        .attr('id', id)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.28);
      grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.0);
    });

    // Horizontal Grid Lines
    const yAxisGrid = d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => '');
    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0.5);
    g.selectAll('.grid .domain').remove();

    // SLA Partition Threshold Reference Line
    const threshY = yScale(partitionAnalysis.perPartitionThreshold);
    if (threshY >= 0 && threshY <= innerHeight) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', threshY)
        .attr('y2', threshY)
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.85);

      g.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', threshY - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#f43f5e')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', '600')
        .text(`SLA Warning Limit (${partitionAnalysis.perPartitionThreshold} msgs)`);
    }

    // Partition Lines & Areas configuration
    const partitionsConfig = [
      { key: 'p0Lag', color: '#06b6d4', gradId: 'grad-p0', filterKey: 'p0' },
      { key: 'p1Lag', color: '#f59e0b', gradId: 'grad-p1', filterKey: 'p1' },
      { key: 'p2Lag', color: '#a855f7', gradId: 'grad-p2', filterKey: 'p2' }
    ];

    partitionsConfig.forEach(({ key, color, gradId, filterKey }) => {
      if (activePartitionFilter !== 'all' && activePartitionFilter !== filterKey) return;

      const area = d3
        .area<KafkaPartitionLagPoint>()
        .curve(d3.curveMonotoneX)
        .x(d => xScale(new Date(d.timestamp)))
        .y0(innerHeight)
        .y1(d => yScale((d as any)[key] || 0));

      const line = d3
        .line<KafkaPartitionLagPoint>()
        .curve(d3.curveMonotoneX)
        .x(d => xScale(new Date(d.timestamp)))
        .y(d => yScale((d as any)[key] || 0));

      // Append Area
      g.append('path')
        .datum(history)
        .attr('fill', `url(#${gradId})`)
        .attr('d', area);

      // Append Line
      g.append('path')
        .datum(history)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', activePartitionFilter === filterKey ? 2.5 : 1.8)
        .attr('d', line);
    });

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 90)))
      .tickFormat(d => d3.timeFormat('%H:%M:%S')(d as Date));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');
    g.selectAll('.domain').attr('stroke', '#475569');
    g.selectAll('.tick line').attr('stroke', '#475569');

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(5);
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Interactive Crosshair & Hover Overlay
    const bisectDate = d3.bisector((d: KafkaPartitionLagPoint) => new Date(d.timestamp)).center;

    const crosshair = g
      .append('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0)
      .attr('y1', 0)
      .attr('y2', innerHeight);

    const overlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const index = bisectDate(history, x0, 1);
        const d0 = history[index - 1];
        const d1 = history[index];
        if (!d0) return;
        const d = !d1 ? d0 : (+x0 - d0.timestamp > d1.timestamp - +x0) ? d1 : d0;

        const cx = xScale(new Date(d.timestamp));
        crosshair.attr('x1', cx).attr('x2', cx).attr('opacity', 0.85);

        setHoverData(d);
        setHoverPos({
          x: cx + margin.left,
          y: Math.min(innerHeight - 40, yScale(d.p1Lag) + margin.top)
        });
      })
      .on('mouseleave', () => {
        crosshair.attr('opacity', 0);
        setHoverData(null);
        setHoverPos(null);
      });

  }, [history, dimensions, activePartitionFilter, partitionAnalysis]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      {/* Header & Bottleneck Diagnostic Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-slate-100">
                Kafka Multi-Partition Consumer Lag Trends (D3.js)
              </h4>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                topic.llm.raw-responses
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Live offset backlog monitoring across partitions to pinpoint throughput skew and consumer starvation
            </p>
          </div>
        </div>

        {/* Partition Filter / Solo Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActivePartitionFilter('all')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
              activePartitionFilter === 'all'
                ? 'bg-slate-700 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Partitions
          </button>
          <button
            onClick={() => setActivePartitionFilter('p0')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
              activePartitionFilter === 'p0'
                ? 'bg-cyan-600 text-white font-medium'
                : 'text-cyan-400 hover:bg-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            P0
          </button>
          <button
            onClick={() => setActivePartitionFilter('p1')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
              activePartitionFilter === 'p1'
                ? 'bg-amber-600 text-white font-medium'
                : 'text-amber-400 hover:bg-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            P1
          </button>
          <button
            onClick={() => setActivePartitionFilter('p2')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
              activePartitionFilter === 'p2'
                ? 'bg-purple-600 text-white font-medium'
                : 'text-purple-400 hover:bg-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            P2
          </button>
        </div>
      </div>

      {/* Throughput Bottleneck Diagnostics Banner */}
      <div className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-xs ${
        partitionAnalysis.isBottleneckSevere
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-slate-950 border-slate-800 text-slate-300'
      }`}>
        <div className="flex items-center gap-2.5">
          <AlertCircle className={`w-4 h-4 shrink-0 ${partitionAnalysis.isBottleneckSevere ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
          <div>
            <span className="font-semibold text-slate-100">
              {partitionAnalysis.isBottleneckSevere ? 'Throughput Skew / Bottleneck Detected:' : 'Partition Throughput Status:'}
            </span>{' '}
            <span className="font-mono text-slate-300">
              {partitionAnalysis.bottleneck.name} carries <strong>{partitionAnalysis.bottleneck.lag} msgs</strong> ({partitionAnalysis.bottleneckShare}% of total topic backlog).
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-400">Total Unconsumed Lag:</span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-bold">
            {partitionAnalysis.total} msgs
          </span>
          <span className={`px-2 py-0.5 rounded border ${
            partitionAnalysis.total > thresholdLimit
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {partitionAnalysis.total > thresholdLimit ? 'Lag Breached SLA' : 'Within Partition SLA'}
          </span>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="w-full relative min-h-[250px]">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full overflow-visible"
        />

        {/* Hover Tooltip Overlay */}
        {hoverData && hoverPos && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 backdrop-blur border border-slate-700 rounded-lg p-2.5 shadow-xl text-xs space-y-1.5 font-mono"
            style={{
              left: Math.min(dimensions.width - 180, Math.max(10, hoverPos.x - 70)),
              top: Math.max(10, hoverPos.y - 80)
            }}
          >
            <div className="text-[10px] text-slate-400 border-b border-slate-800 pb-1">
              Time: {hoverData.timeLabel} ({new Date(hoverData.timestamp).toLocaleTimeString()})
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Partition 0:</span>
              </div>
              <div className="text-right font-bold text-slate-200">{hoverData.p0Lag} msgs</div>

              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Partition 1:</span>
              </div>
              <div className="text-right font-bold text-slate-200">{hoverData.p1Lag} msgs</div>

              <div className="flex items-center gap-1.5 text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Partition 2:</span>
              </div>
              <div className="text-right font-bold text-slate-200">{hoverData.p2Lag} msgs</div>
            </div>
            <div className="border-t border-slate-800 pt-1 flex justify-between text-[10px] text-slate-300">
              <span>Total Backlog:</span>
              <strong className="text-white">{hoverData.totalLag} msgs</strong>
            </div>
          </div>
        )}
      </div>

      {/* Partition Live Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {partitionAnalysis.items.map((part) => {
          const isBottleneck = part.id === partitionAnalysis.bottleneck.id;
          return (
            <div
              key={part.id}
              className={`p-3 rounded-lg border transition-all ${
                isBottleneck
                  ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: part.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: part.color }} />
                  {part.name}
                </span>
                {isBottleneck && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Highest Backlog
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-xl font-bold text-slate-100">{part.lag}</span>
                <span className="text-[11px] text-slate-400">msgs in queue</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: part.color,
                    width: `${Math.min(100, (part.lag / partitionAnalysis.perPartitionThreshold) * 100)}%`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
