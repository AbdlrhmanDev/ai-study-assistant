"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell, useAuthFailure } from "./BackendPages";
import { api, Topic, messageFromError } from "../lib/api";

type GraphNode = { id: number; name: string; description: string; masteryScore: number; size: number };
type GraphEdge = { from: number; to: number; type: string; weight: number };
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[]; belowMinimum: boolean };
type ConceptDetail = { id: number; topicId: number; name: string; description: string; masteryScore: number };

type LayoutPoint = { x: number; y: number; vx: number; vy: number };

const RELATION_LABELS: Record<string, string> = {
  prerequisite: "is a prerequisite for",
  related: "is related to",
  contrasts: "contrasts with",
  part_of: "is part of",
};

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 560;

function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Map<number, LayoutPoint> {
  const positions = new Map<number, LayoutPoint>();
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.32;
    positions.set(node.id, {
      x: CANVAS_WIDTH / 2 + Math.cos(angle) * radius,
      y: CANVAS_HEIGHT / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  });

  const REPULSION = 9000;
  const SPRING_LENGTH = 150;
  const SPRING_STRENGTH = 0.02;
  const CENTER_STRENGTH = 0.012;
  const DAMPING = 0.85;
  const all = Array.from(positions.values());

  for (let iteration = 0; iteration < 260; iteration++) {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = Math.max(1, dx * dx + dy * dy);
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
    for (const edge of edges) {
      const a = positions.get(edge.from);
      const b = positions.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
    for (const node of all) {
      node.vx += (CANVAS_WIDTH / 2 - node.x) * CENTER_STRENGTH;
      node.vy += (CANVAS_HEIGHT / 2 - node.y) * CENTER_STRENGTH;
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;
    }
  }
  return positions;
}

function masteryColor(score: number): string {
  const clamped = Math.max(0, Math.min(1, score));
  const hue = clamped * 130; // 0 = red, 130 = green
  return `hsl(${hue}, 62%, 48%)`;
}

export function KnowledgeGraphPage() {
  const params = useSearchParams();
  const handleAuthFailure = useAuthFailure();
  const topicId = Number(params.get("topicId"));

  const [topic, setTopic] = useState<Topic | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [conceptDetail, setConceptDetail] = useState<ConceptDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Map<number, LayoutPoint>>(new Map());
  const transformRef = useRef({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragRef = useRef<{ mode: "pan" | "node"; nodeId?: number; lastX: number; lastY: number } | null>(null);
  const [, forceRedraw] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) return;
    setLoading(true);
    setError("");
    try {
      const [topicResult, graphResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        api<GraphData>(`/topics/${topicId}/knowledge-graph`),
      ]);
      setTopic(topicResult.topic);
      setGraph(graphResult);
      if (graphResult.nodes.length) {
        positionsRef.current = computeLayout(graphResult.nodes, graphResult.edges);
      }
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function rebuild() {
    if (!Number.isInteger(topicId) || topicId < 1 || rebuilding) return;
    setRebuilding(true);
    setError("");
    try {
      const result = await api<GraphData>(`/topics/${topicId}/knowledge-graph/rebuild`, { method: "POST" });
      setGraph(result);
      setSelectedNode(null);
      setConceptDetail(null);
      if (result.nodes.length) {
        positionsRef.current = computeLayout(result.nodes, result.edges);
      }
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setRebuilding(false);
    }
  }

  const edgesForSelected = useMemo(() => {
    if (!graph || !selectedNode) return [];
    return graph.edges
      .filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
      .map((edge) => {
        const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
        const other = graph.nodes.find((node) => node.id === otherId);
        const direction = edge.from === selectedNode.id ? "forward" : "backward";
        return { edge, other, direction };
      })
      .filter((item) => item.other);
  }, [graph, selectedNode]);

  async function openConcept(node: GraphNode) {
    setSelectedNode(node);
    setConceptDetail(null);
    try {
      const result = await api<ConceptDetail>(`/concepts/${node.id}`);
      setConceptDetail(result);
    } catch {
      // side panel still shows the node's basic info even if the detail call fails
    }
  }

  // -------------------------------------------------------------------
  // Canvas drawing
  // -------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { offsetX, offsetY, scale } = transformRef.current;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#faf9f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const query = searchQuery.trim().toLowerCase();

    ctx.lineWidth = 1.4;
    for (const edge of graph.edges) {
      const a = positionsRef.current.get(edge.from);
      const b = positionsRef.current.get(edge.to);
      if (!a || !b) continue;
      ctx.strokeStyle = "rgba(120, 113, 130, 0.35)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const node of graph.nodes) {
      const pos = positionsRef.current.get(node.id);
      if (!pos) continue;
      const matchesSearch = query && node.name.toLowerCase().includes(query);
      const dimmed = query.length > 0 && !matchesSearch;
      const radius = 16 + Math.min(14, node.size * 2);

      ctx.globalAlpha = dimmed ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = masteryColor(node.masteryScore);
      ctx.fill();
      if (selectedNode?.id === node.id || matchesSearch) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#302e3c";
        ctx.stroke();
      }

      ctx.globalAlpha = dimmed ? 0.35 : 1;
      ctx.fillStyle = "#1b1a1f";
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.name, pos.x, pos.y + radius + 6);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }, [graph, searchQuery, selectedNode]);

  useEffect(() => {
    draw();
  }, [draw]);

  function canvasPointFromEvent(event: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { offsetX, offsetY, scale } = transformRef.current;
    const screenX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const screenY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return { x: (screenX - offsetX) / scale, y: (screenY - offsetY) / scale };
  }

  function findNodeAt(x: number, y: number): GraphNode | null {
    if (!graph) return null;
    for (const node of graph.nodes) {
      const pos = positionsRef.current.get(node.id);
      if (!pos) continue;
      const radius = 16 + Math.min(14, node.size * 2);
      if ((pos.x - x) ** 2 + (pos.y - y) ** 2 <= radius * radius) return node;
    }
    return null;
  }

  function handleMouseDown(event: React.MouseEvent<HTMLCanvasElement>) {
    const point = canvasPointFromEvent(event);
    const node = findNodeAt(point.x, point.y);
    if (node) {
      dragRef.current = { mode: "node", nodeId: node.id, lastX: point.x, lastY: point.y };
    } else {
      dragRef.current = { mode: "pan", lastX: event.clientX, lastY: event.clientY };
    }
  }

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "node" && drag.nodeId != null) {
      const point = canvasPointFromEvent(event);
      const pos = positionsRef.current.get(drag.nodeId);
      if (pos) {
        pos.x = point.x;
        pos.y = point.y;
      }
      draw();
    } else if (drag.mode === "pan") {
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      transformRef.current.offsetX += dx;
      transformRef.current.offsetY += dy;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      draw();
    }
  }

  function handleMouseUp(event: React.MouseEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag?.mode === "node" && drag.nodeId != null) {
      const moved = Math.abs(canvasPointFromEvent(event).x - drag.lastX) > 2 || Math.abs(canvasPointFromEvent(event).y - drag.lastY) > 2;
      if (!moved) {
        const node = graph?.nodes.find((item) => item.id === drag.nodeId);
        if (node) void openConcept(node);
      }
    }
    dragRef.current = null;
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const next = Math.max(0.4, Math.min(2.5, transformRef.current.scale - event.deltaY * 0.001));
    transformRef.current.scale = next;
    draw();
  }

  return (
    <PageShell
      title={topic ? `${topic.title}: Knowledge Graph` : "Knowledge Graph"}
      subtitle="How the concepts in this topic connect -- weak concepts stay visually prominent."
      action={<div className="page-actions">
        <button className="button button-secondary" disabled={rebuilding} onClick={() => void rebuild()}>
          {rebuilding ? "Building…" : graph?.nodes.length ? "↻ Rebuild graph" : "✦ Build knowledge graph"}
        </button>
        <Link className="back-topics" href={`/topic?id=${topicId}`}>← Back to topic</Link>
      </div>}
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      {loading ? <div className="empty">Loading your knowledge graph…</div> : (
        <>
          {graph?.belowMinimum && !graph.nodes.length ? (
            <div className="empty">
              Not enough concepts yet to build a meaningful graph -- add a few more notes or documents, then generate the graph.
              <div><button className="button button-primary" disabled={rebuilding} onClick={() => void rebuild()}>{rebuilding ? "Building…" : "✦ Build knowledge graph"}</button></div>
            </div>
          ) : !graph?.nodes.length ? (
            <div className="empty">
              No graph yet for this topic.
              <div><button className="button button-primary" disabled={rebuilding} onClick={() => void rebuild()}>{rebuilding ? "Building…" : "✦ Build knowledge graph"}</button></div>
            </div>
          ) : (
            <div className="graph-layout">
              <section className="graph-canvas-panel">
                <div className="graph-search">
                  <span>⌕</span>
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search concepts…" />
                </div>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="graph-canvas"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => { dragRef.current = null; }}
                  onWheel={handleWheel}
                />
                <div className="graph-legend">
                  <span><i className="graph-legend-dot" style={{ background: masteryColor(0) }} /> Weak</span>
                  <span><i className="graph-legend-dot" style={{ background: masteryColor(0.5) }} /> Developing</span>
                  <span><i className="graph-legend-dot" style={{ background: masteryColor(1) }} /> Strong</span>
                  <span className="graph-legend-hint">Drag nodes to rearrange · scroll to zoom · drag background to pan</span>
                </div>
              </section>
              <aside className="graph-detail-panel">
                {selectedNode ? (
                  <>
                    <div className="section-kicker">CONCEPT</div>
                    <h3>{selectedNode.name}</h3>
                    <p>{conceptDetail?.description || selectedNode.description || "No description yet."}</p>
                    <div className="graph-mastery-row">
                      <div className="graph-mastery-track">
                        <div
                          className="graph-mastery-fill"
                          style={{ width: `${Math.round((conceptDetail?.masteryScore ?? selectedNode.masteryScore) * 100)}%`, background: masteryColor(conceptDetail?.masteryScore ?? selectedNode.masteryScore) }}
                        />
                      </div>
                      <span>{Math.round((conceptDetail?.masteryScore ?? selectedNode.masteryScore) * 100)}%</span>
                    </div>
                    {!!edgesForSelected.length && (
                      <div className="graph-relations">
                        <div className="section-kicker">CONNECTIONS</div>
                        {edgesForSelected.map(({ edge, other, direction }) => (
                          <div className="graph-relation-row" key={`${edge.from}-${edge.to}-${edge.type}`}>
                            {direction === "forward"
                              ? <span>{RELATION_LABELS[edge.type] ?? edge.type} <strong>{other!.name}</strong></span>
                              : <span><strong>{other!.name}</strong> {RELATION_LABELS[edge.type] ?? edge.type} this</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <Link className="button button-primary graph-ask-tutor" href={`/ai-tutor?topicId=${topicId}&concept=${encodeURIComponent(selectedNode.name)}`}>
                      ✦ Ask the tutor about this
                    </Link>
                  </>
                ) : (
                  <div className="empty">Click a concept to see its details.</div>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
