"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoveHorizontal, RefreshCw, Sparkles } from "lucide-react";
import { PageShell, useAuthFailure } from "./shared/PageChrome";
import { api, Topic, messageFromError } from "../lib/api";

type MindMapNode = { title: string; children: MindMapNode[] };
type BuildStatus = { status: "pending" | "processing" | "completed" | "failed"; errorMessage: string | null };
type MindMapData = { structure: MindMapNode | null; nodeCount: number; updatedAt: string | null; buildStatus: BuildStatus };

const BUILD_POLL_INTERVAL_MS = 1500;
const BUILD_POLL_MAX_ATTEMPTS = 30;

type PositionedNode = { node: MindMapNode; x: number; y: number; depth: number };

const LEVEL_WIDTH = 240;
const ROW_HEIGHT = 64;
const NODE_PADDING_X = 16;
const NODE_HEIGHT = 40;
const LEFT_MARGIN = 110;
const DEPTH_COLORS = ["#302e3c", "#7456df", "#4b957a", "#c9803f"];

function countLeaves(node: MindMapNode): number {
  if (!node.children.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function layoutTree(root: MindMapNode): { positions: Map<MindMapNode, PositionedNode>; width: number; height: number } {
  const positions = new Map<MindMapNode, PositionedNode>();
  let leafIndex = 0;
  let maxDepth = 0;

  function place(node: MindMapNode, depth: number): number {
    maxDepth = Math.max(maxDepth, depth);
    if (!node.children.length) {
      const y = leafIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      leafIndex += 1;
      positions.set(node, { node, x: LEFT_MARGIN + depth * LEVEL_WIDTH, y, depth });
      return y;
    }
    const childYs = node.children.map((child) => place(child, depth + 1));
    const y = childYs.reduce((a, b) => a + b, 0) / childYs.length;
    positions.set(node, { node, x: LEFT_MARGIN + depth * LEVEL_WIDTH, y, depth });
    return y;
  }

  place(root, 0);
  const leafCount = Math.max(1, countLeaves(root));
  return {
    positions,
    width: LEFT_MARGIN + (maxDepth + 1) * LEVEL_WIDTH + 110,
    height: Math.max(300, leafCount * ROW_HEIGHT + ROW_HEIGHT),
  };
}

export function MindMapPage() {
  const params = useSearchParams();
  const handleAuthFailure = useAuthFailure();
  const topicId = Number(params.get("topicId"));

  const [topic, setTopic] = useState<Topic | null>(null);
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState("");
  const [buildAnnouncement, setBuildAnnouncement] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pollUntilBuildSettled = useCallback(async () => {
    for (let attempt = 0; attempt < BUILD_POLL_MAX_ATTEMPTS; attempt++) {
      const result = await api<MindMapData>(`/topics/${topicId}/mind-map`);
      setMindMap(result);
      if (result.buildStatus.status === "completed") {
        setBuildAnnouncement("Mind map generated.");
        return;
      }
      if (result.buildStatus.status === "failed") {
        setError(result.buildStatus.errorMessage || "Generating the mind map failed.");
        setBuildAnnouncement("Mind map generation failed.");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, BUILD_POLL_INTERVAL_MS));
    }
  }, [topicId]);

  const load = useCallback(async () => {
    if (!Number.isInteger(topicId) || topicId < 1) return;
    setLoading(true);
    setError("");
    try {
      const [topicResult, mapResult] = await Promise.all([
        api<{ topic: Topic }>(`/topics/${topicId}`),
        api<MindMapData>(`/topics/${topicId}/mind-map`),
      ]);
      setTopic(topicResult.topic);
      setMindMap(mapResult);
      setLoading(false);
      if (mapResult.buildStatus.status === "pending" || mapResult.buildStatus.status === "processing") {
        setRebuilding(true);
        await pollUntilBuildSettled();
        setRebuilding(false);
      }
    } catch (requestError) {
      handleAuthFailure(requestError);
      setError(messageFromError(requestError));
      setLoading(false);
    }
  }, [handleAuthFailure, pollUntilBuildSettled, topicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function rebuild() {
    if (!Number.isInteger(topicId) || topicId < 1 || rebuilding) return;
    setRebuilding(true);
    setError("");
    try {
      await api<BuildStatus>(`/topics/${topicId}/mind-map/rebuild`, { method: "POST" });
      await pollUntilBuildSettled();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setRebuilding(false);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = mindMap?.structure;
    if (!canvas || !root) return;
    const { positions, width, height } = layoutTree(root);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#faf9f6";
    ctx.fillRect(0, 0, width, height);

    const measureWidth = (title: string) => {
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
      return Math.min(200, Math.max(70, ctx.measureText(title).width + NODE_PADDING_X * 2));
    };

    // edges first
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(120, 113, 130, 0.4)";
    for (const { node, x, y } of positions.values()) {
      const parentWidth = measureWidth(node.title);
      for (const child of node.children) {
        const childPos = positions.get(child);
        if (!childPos) continue;
        const startX = x + parentWidth / 2;
        const startY = y;
        const endX = childPos.x - measureWidth(child.title) / 2;
        const endY = childPos.y;
        const midX = (startX + endX) / 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
        ctx.stroke();
      }
    }

    // nodes
    for (const { node, x, y, depth } of positions.values()) {
      const boxWidth = measureWidth(node.title);
      const color = DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
      ctx.beginPath();
      const left = x - boxWidth / 2;
      const top = y - NODE_HEIGHT / 2;
      const radius = 10;
      ctx.moveTo(left + radius, top);
      ctx.arcTo(left + boxWidth, top, left + boxWidth, top + NODE_HEIGHT, radius);
      ctx.arcTo(left + boxWidth, top + NODE_HEIGHT, left, top + NODE_HEIGHT, radius);
      ctx.arcTo(left, top + NODE_HEIGHT, left, top, radius);
      ctx.arcTo(left, top, left + boxWidth, top, radius);
      ctx.closePath();
      ctx.fillStyle = depth === 0 ? color : "#ffffff";
      ctx.fill();
      ctx.lineWidth = depth === 0 ? 0 : 1.6;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.fillStyle = depth === 0 ? "#ffffff" : "#1b1a1f";
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.title, x, y, boxWidth - NODE_PADDING_X);
    }
  }, [mindMap]);

  return (
    <PageShell
      className="mind-map-page"
      title="Mind map"
      subtitle="A visual outline of this topic, generated from your notes and documents."
      action={
        <button className="button button-secondary" disabled={rebuilding} onClick={() => void rebuild()}>
          {rebuilding ? "Generating…" : mindMap?.structure ? <><RefreshCw size={14} /> Regenerate</> : <><Sparkles size={14} /> Generate mind map</>}
        </button>
      }
    >
      {error && <p className="page-error" role="alert">{error}</p>}
      <p className="sr-only" aria-live="polite">{rebuilding ? "Generating mind map…" : buildAnnouncement}</p>
      {loading ? (
        <div className="empty">Loading…</div>
      ) : !mindMap?.structure ? (
        <div className="mind-map-empty-panel">
          <div className="empty">
            No mind map yet for {topic?.title ?? "this topic"}. Generate one to get a visual outline of the material.
          </div>
        </div>
      ) : (
        <div className="mind-map-canvas-panel">
          <div className="mind-map-pan-hint"><MoveHorizontal size={16} aria-hidden="true" /> Swipe to explore the map</div>
          <canvas ref={canvasRef} className="mind-map-canvas" />
        </div>
      )}
    </PageShell>
  );
}
