'use client';

import React from 'react';

type Graph = Record<string, string[]>; // nodeCode -> [prereqCodes]

type Props = {
  graph: Graph;
  root?: string; // starting node code
  width?: number;
  height?: number;
  onNodeClick?: (code: string) => void; // optional click handler to navigate to course details
  onRetry?: () => void; // optional retry callback
  // Optional validation result with a cycle to highlight
  validation?: { valid: true } | { valid: false; cycle?: string[]; reason?: string };
};

export default function PrerequisitesGraph({
  graph,
  root,
  width = 800,
  height = 400,
  onNodeClick,
  onRetry,
  validation,
}: Props) {
  const nodes = React.useMemo(() => {
    // ensure we include isolated nodes and all referenced prereqs
    const set = new Set<string>();
    for (const key of Object.keys(graph)) {
      set.add(key);
      for (const p of graph[key] || []) set.add(p);
    }
    return Array.from(set);
  }, [graph]);

  const start = React.useMemo(() => {
    if (root && nodes.includes(root)) return root;
    // choose a node with no incoming edges if possible
    const incoming = new Map<string, number>();
    for (const node of nodes) incoming.set(node, 0);
    for (const [, preds] of Object.entries(graph)) {
      for (const p of preds || []) incoming.set(p, (incoming.get(p) ?? 0) + 1);
    }
    const roots = nodes.filter((n) => (incoming.get(n) ?? 0) === 0);
    return roots.length > 0 ? roots[0] : nodes[0] || null;
  }, [root, graph, nodes]);

  const layout = React.useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();

    if (!start) return positions;

    // BFS to compute levels (distance from start)
    const levels = new Map<string, number>();
    const q: string[] = [start];
    levels.set(start, 0);

    while (q.length > 0) {
      const cur = q.shift()!;
      const curLevel = levels.get(cur) ?? 0;
      const neighbors = graph[cur] || [];
      for (const p of neighbors) {
        if (!levels.has(p)) {
          levels.set(p, curLevel + 1);
          q.push(p);
        }
      }
    }

    // ensure all nodes have a level (place unreachable ones at end)
    for (const n of nodes) {
      if (!levels.has(n)) levels.set(n, Math.max(...levels.values(), 0) + 1);
    }

    // Group by level
    const byLevel = new Map<number, string[]>();
    for (const [n, lvl] of levels.entries()) {
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(n);
    }

    const lvls = Array.from(byLevel.keys()).sort((a, b) => a - b);

    const xPadding = 80;
    const yPadding = 40;
    const usableWidth = Math.max(200, width - xPadding * 2);
    const usableHeight = Math.max(200, height - yPadding * 2);

    const xStep = lvls.length > 1 ? usableWidth / (lvls.length - 1) : 0;

    for (let i = 0; i < lvls.length; i++) {
      const lvl = lvls[i];
      const cols = byLevel.get(lvl) || [];
      const yStep = cols.length > 1 ? usableHeight / (cols.length - 1) : 0;
      for (let j = 0; j < cols.length; j++) {
        const n = cols[j];
        const x = xPadding + xStep * i;
        const y = yPadding + yStep * j;
        positions.set(n, { x, y });
      }
    }

    return positions;
  }, [graph, nodes, start, width, height]);

  // simple helper to draw an arrowed path
  const renderEdges = () => {
    const edges: React.ReactElement[] = [];

    const cycleSet = new Set<string>((validation && !validation.valid && validation.cycle) || []);
    const cycleEdges = new Set<string>();
    if (cycleSet.size > 0) {
      const cycleArr = Array.from(cycleSet);
      // Build cycle edges by checking adjacency
      for (let i = 0; i < cycleArr.length; i++) {
        const a = cycleArr[i];
        const b = cycleArr[(i + 1) % cycleArr.length];
        cycleEdges.add(`${a}->${b}`);
      }
    }

    for (const [node, preds] of Object.entries(graph)) {
      for (const p of preds || []) {
        const from = layout.get(p);
        const to = layout.get(node);
        if (!from || !to) continue;
        const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
        const edgeKey = `${p}->${node}`;
        const isCycleEdge = cycleEdges.has(edgeKey);
        edges.push(
          <path
            key={edgeKey}
            d={path}
            stroke={isCycleEdge ? '#DC2626' : '#9CA3AF'}
            strokeWidth={isCycleEdge ? 3 : 2}
            fill="none"
            markerEnd="url(#arrow)"
            className="transition-colors"
          />
        );
      }
    }

    return edges;
  };

  const renderNodes = () => {
    const elems: React.ReactElement[] = [];

    const cycleArr = (validation && !validation.valid && validation.cycle) || [];
    const cycleSet = new Set<string>(cycleArr);

    for (const n of nodes) {
      const pos = layout.get(n);
      if (!pos) continue;
      const isInCycle = cycleSet.has(n);
      elems.push(
        <g
          key={n}
          transform={`translate(${pos.x},${pos.y})`}
          style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
          onClick={() => onNodeClick && onNodeClick(n)}
          onMouseEnter={(e) => {
            const target = e.currentTarget as SVGGElement;
            if (!isInCycle) target.querySelector('circle')?.setAttribute('fill', '#fef3c7');
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as SVGGElement;
            if (!isInCycle) target.querySelector('circle')?.setAttribute('fill', '#fff');
          }}
        >
          <circle
            r={20}
            cx={0}
            cy={0}
            fill={isInCycle ? '#fee2e2' : '#fff'}
            stroke={isInCycle ? '#DC2626' : '#1F2937'}
            strokeWidth={isInCycle ? 2.5 : 1.5}
          />
          <text x={0} y={4} textAnchor="middle" fontSize={11} className="text-gray-700">
            {n}
          </text>
        </g>
      );
    }

    return elems;
  };

  if (!start) {
    return (
      <div className="py-6 text-center text-gray-500">
        <p className="mb-2">No prerequisites found for this course.</p>
        {typeof onRetry === 'function' ? (
          <div className="mt-2">
            <button className="text-sm text-gray-500" onClick={onRetry}>Retry</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <svg width={width} height={height}>
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B7280" />
          </marker>
        </defs>

        <g>{renderEdges()}</g>
        <g>{renderNodes()}</g>
      </svg>
    </div>
  );
}
