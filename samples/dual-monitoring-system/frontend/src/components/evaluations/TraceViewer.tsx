"use client"

import { useState, useMemo, useRef } from "react"
import { useAuth } from "react-oidc-context"
import { useVirtualizer, type Virtualizer, type VirtualItem } from "@tanstack/react-virtual"
import { useSession } from "@/hooks/useSession"
import type { Span, Trace } from "@/types/evaluation"
import type { SpanNode } from "@/types/traceViewer"
import LoadingSpinner from "@/components/loaders/LoadingSpinner"
import { TimelineCanvas } from "./TimelineCanvas"
import { SpanDetailsPanel } from "./SpanDetailsPanel"
import { ErrorDisplay } from "./ErrorDisplay"

interface TraceViewerProps {
  sessionId: string
  traces?: Trace[]
}

/**
 * TraceViewer Component with Virtualization
 * Visualizes trace timelines with span hierarchies
 * Requirements: 5.1, 5.2, 5.5, 14.3
 * Implements virtualization for large traces
 */
export function TraceViewer({ sessionId, traces: preloadedTraces }: TraceViewerProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null)
  const auth = useAuth()
  const parentRef = useRef<HTMLDivElement>(null)

  // Use cached session data (skip fetch if traces are preloaded)
  const { data: session, isLoading, error, refetch } = useSession(sessionId, auth.user?.id_token)

  // Use preloaded traces if available, otherwise use fetched session traces
  const activeTraces = preloadedTraces || session?.traces

  // Build span hierarchy tree from flat span list
  const spanTree = useMemo(() => {
    if (!activeTraces || activeTraces.length === 0) return []
    return buildSpanTree(activeTraces)
  }, [activeTraces])

  // Calculate timeline layout with lane assignment
  const layout = useMemo(() => {
    return calculateTimelineLayout(spanTree)
  }, [spanTree])

  // Setup virtualizer for large traces (only if more than 50 spans)
  const shouldVirtualize = layout.length > 50

  const rowVirtualizer = useVirtualizer({
    count: layout.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated span row height
    overscan: 5,
    enabled: shouldVirtualize,
  })

  if (isLoading && !preloadedTraces) {
    return <LoadingSpinner message="Loading trace data..." />
  }

  if (error && !preloadedTraces) {
    return (
      <ErrorDisplay error={error.message} title="Trace Loading Error" onRetry={() => refetch()} />
    )
  }

  if (spanTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <p className="text-gray-600">No trace data available for this session</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div ref={parentRef} className="flex-1 overflow-auto">
        {shouldVirtualize ? (
          <VirtualizedTimelineCanvas
            spans={layout}
            virtualizer={rowVirtualizer}
            onSpanClick={setSelectedSpan}
            selectedSpan={selectedSpan}
          />
        ) : (
          <TimelineCanvas
            spans={layout}
            onSpanClick={setSelectedSpan}
            selectedSpan={selectedSpan}
          />
        )}
      </div>

      {selectedSpan && (
        <SpanDetailsPanel span={selectedSpan} onClose={() => setSelectedSpan(null)} />
      )}
    </div>
  )
}

/**
 * Virtualized Timeline Canvas for large traces
 * Only renders visible spans for performance
 */
function VirtualizedTimelineCanvas({
  spans,
  virtualizer,
  onSpanClick,
  selectedSpan,
}: {
  spans: SpanNode[]
  virtualizer: Virtualizer<HTMLDivElement, Element>
  onSpanClick: (span: Span) => void
  selectedSpan: Span | null
}) {
  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Calculate time scale for the entire trace
  const timeScale = useMemo(() => {
    if (spans.length === 0) return { min: 0, max: 0, scale: 1 }

    const times = spans.map((node) => ({
      start: new Date(node.span.startTime).getTime(),
      end: new Date(node.span.endTime).getTime(),
    }))

    const minTime = Math.min(...times.map((t) => t.start))
    const maxTime = Math.max(...times.map((t) => t.end))
    const duration = maxTime - minTime

    return {
      min: minTime,
      max: maxTime,
      scale: duration > 0 ? 1000 / duration : 1, // Scale to 1000px width
    }
  }, [spans])

  return (
    <div
      style={{
        height: `${totalSize}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {virtualItems.map((virtualRow: VirtualItem) => {
        const spanNode = spans[virtualRow.index]
        const startTime = new Date(spanNode.span.startTime).getTime()
        const endTime = new Date(spanNode.span.endTime).getTime()

        const _x = (startTime - timeScale.min) * timeScale.scale
        const width = (endTime - startTime) * timeScale.scale

        const isSelected = selectedSpan?.spanId === spanNode.span.spanId

        return (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className="flex items-center h-full px-4 hover:bg-gray-50">
              <div
                className={`relative h-8 rounded cursor-pointer transition-colors ${
                  isSelected ? "bg-blue-500" : "bg-slate-400 hover:bg-slate-500"
                }`}
                style={{
                  marginLeft: `${spanNode.depth * 20}px`,
                  width: `${Math.max(width, 20)}px`,
                }}
                onClick={() => onSpanClick(spanNode.span)}
              >
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white truncate">
                  {spanNode.span.name}
                </span>
              </div>
              <span className="ml-2 text-xs text-gray-500">{spanNode.span.durationMs}ms</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Build span tree from flat list of traces
 * Creates hierarchical structure based on parent-child relationships
 */
function buildSpanTree(traces: Trace[]): SpanNode[] {
  const allSpans: Span[] = []

  // Flatten all spans from all traces
  traces.forEach((trace) => {
    allSpans.push(...trace.spans)
  })

  // Create a map of spanId to span for quick lookup
  const spanMap = new Map<string, Span>()
  allSpans.forEach((span) => {
    spanMap.set(span.spanId, span)
  })

  // Build tree structure
  const rootNodes: SpanNode[] = []
  const nodeMap = new Map<string, SpanNode>()

  // First pass: create all nodes
  allSpans.forEach((span) => {
    const node: SpanNode = {
      span,
      children: [],
      depth: 0,
      lane: 0,
    }
    nodeMap.set(span.spanId, node)
  })

  // Second pass: build parent-child relationships
  allSpans.forEach((span) => {
    const node = nodeMap.get(span.spanId)!

    if (span.parentSpanId) {
      const parentNode = nodeMap.get(span.parentSpanId)
      if (parentNode) {
        parentNode.children.push(node)
        node.depth = parentNode.depth + 1
      } else {
        // Parent not found, treat as root
        rootNodes.push(node)
      }
    } else {
      // No parent, this is a root span
      rootNodes.push(node)
    }
  })

  return rootNodes
}

/**
 * Calculate timeline layout with lane assignment
 * Assigns lanes to overlapping spans to prevent visual overlap
 * Requirement: 5.5 - Overlapping spans in separate lanes
 */
function calculateTimelineLayout(spanTree: SpanNode[]): SpanNode[] {
  const flatList: SpanNode[] = []

  // Flatten tree to list with depth-first traversal
  function traverse(node: SpanNode) {
    flatList.push(node)
    node.children.forEach((child) => traverse(child))
  }

  spanTree.forEach((root) => traverse(root))

  // Sort by start time
  flatList.sort((a, b) => {
    const aTime = new Date(a.span.startTime).getTime()
    const bTime = new Date(b.span.startTime).getTime()
    return aTime - bTime
  })

  // Assign lanes to prevent overlap
  const lanes: Array<{ endTime: number }> = []

  flatList.forEach((node) => {
    const startTime = new Date(node.span.startTime).getTime()
    const endTime = new Date(node.span.endTime).getTime()

    // Find first available lane
    let assignedLane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endTime <= startTime) {
        assignedLane = i
        lanes[i].endTime = endTime
        break
      }
    }

    // If no available lane, create new one
    if (assignedLane === -1) {
      assignedLane = lanes.length
      lanes.push({ endTime })
    }

    node.lane = assignedLane
  })

  return flatList
}
