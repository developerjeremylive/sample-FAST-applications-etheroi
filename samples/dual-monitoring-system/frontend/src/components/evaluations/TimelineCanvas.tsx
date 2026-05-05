"use client"

import { useMemo } from "react"
import type { Span } from "@/types/evaluation"
import type { SpanNode } from "@/types/traceViewer"

interface TimelineCanvasProps {
  spans: SpanNode[]
  onSpanClick: (span: Span) => void
  selectedSpan: Span | null
}

const LANE_HEIGHT = 40
const SPAN_HEIGHT = 30
const PADDING_TOP = 20
const PADDING_LEFT = 200
const PADDING_RIGHT = 50
const TIMELINE_WIDTH = 1000

/**
 * TimelineCanvas Component
 * Renders trace timeline as SVG with spans as rectangles
 * Requirements: 5.2, 5.3, 5.4
 */
export function TimelineCanvas({ spans, onSpanClick, selectedSpan }: TimelineCanvasProps) {
  // Calculate time scale for proportional rendering
  const timeScale = useMemo(() => {
    return createTimeScale(spans)
  }, [spans])

  if (spans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">No spans to display</div>
    )
  }

  const maxLane = Math.max(...spans.map((s) => s.lane))
  const svgHeight = (maxLane + 1) * LANE_HEIGHT + PADDING_TOP + 20

  return (
    <div className="p-4">
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${PADDING_LEFT + TIMELINE_WIDTH + PADDING_RIGHT} ${svgHeight}`}
        className="border border-gray-200 rounded bg-white"
      >
        {/* Timeline axis */}
        <line
          x1={PADDING_LEFT}
          y1={PADDING_TOP}
          x2={PADDING_LEFT + TIMELINE_WIDTH}
          y2={PADDING_TOP}
          stroke="#cbd5e1"
          strokeWidth={2}
        />

        {/* Time markers */}
        {timeScale.markers.map((marker, idx) => (
          <g key={idx}>
            <line
              x1={PADDING_LEFT + marker.position}
              y1={PADDING_TOP}
              x2={PADDING_LEFT + marker.position}
              y2={PADDING_TOP + 5}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={PADDING_LEFT + marker.position}
              y={PADDING_TOP - 5}
              fontSize={10}
              fill="#64748b"
              textAnchor="middle"
            >
              {marker.label}
            </text>
          </g>
        ))}

        {/* Render spans */}
        {spans.map((spanNode) => {
          const span = spanNode.span
          const isSelected = selectedSpan?.spanId === span.spanId

          const startX = PADDING_LEFT + timeScale.scale(new Date(span.startTime).getTime())
          const endX = PADDING_LEFT + timeScale.scale(new Date(span.endTime).getTime())
          const width = Math.max(endX - startX, 2) // Minimum width of 2px
          const y = PADDING_TOP + spanNode.lane * LANE_HEIGHT + 10

          // Find parent span for connection line
          const parentSpan = span.parentSpanId
            ? spans.find((s) => s.span.spanId === span.parentSpanId)
            : null

          return (
            <g key={span.spanId}>
              {/* Parent-child connection line */}
              {parentSpan && (
                <line
                  x1={PADDING_LEFT + timeScale.scale(new Date(span.startTime).getTime())}
                  y1={y + SPAN_HEIGHT / 2}
                  x2={PADDING_LEFT + timeScale.scale(new Date(parentSpan.span.startTime).getTime())}
                  y2={PADDING_TOP + parentSpan.lane * LANE_HEIGHT + 10 + SPAN_HEIGHT / 2}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
              )}

              {/* Span rectangle */}
              <rect
                x={startX}
                y={y}
                width={width}
                height={SPAN_HEIGHT}
                fill={isSelected ? "#3b82f6" : getSpanColor(span)}
                stroke={isSelected ? "#1e40af" : "#64748b"}
                strokeWidth={isSelected ? 2 : 1}
                rx={4}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onSpanClick(span)}
              />

              {/* Span label */}
              <text
                x={startX + 5}
                y={y + SPAN_HEIGHT / 2 + 4}
                fontSize={12}
                fill="white"
                className="pointer-events-none select-none"
              >
                {truncateText(span.name, width - 10)}
              </text>

              {/* Duration label */}
              <text
                x={endX + 5}
                y={y + SPAN_HEIGHT / 2 + 4}
                fontSize={10}
                fill="#64748b"
                className="pointer-events-none select-none"
              >
                {formatDuration(span.durationMs)}
              </text>
            </g>
          )
        })}

        {/* Lane labels */}
        {spans.map((spanNode) => {
          const y = PADDING_TOP + spanNode.lane * LANE_HEIGHT + 10
          return (
            <text
              key={`label-${spanNode.span.spanId}`}
              x={10}
              y={y + SPAN_HEIGHT / 2 + 4}
              fontSize={11}
              fill="#475569"
              className="pointer-events-none select-none"
            >
              Lane {spanNode.lane}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * Create time scale for proportional span rendering
 * Requirement: 5.3 - Span duration proportionality
 */
function createTimeScale(spans: SpanNode[]) {
  if (spans.length === 0) {
    return {
      scale: (time: number) => 0,
      markers: [],
    }
  }

  // Find min and max timestamps
  let minTime = Infinity
  let maxTime = -Infinity

  spans.forEach((spanNode) => {
    const startTime = new Date(spanNode.span.startTime).getTime()
    const endTime = new Date(spanNode.span.endTime).getTime()
    minTime = Math.min(minTime, startTime)
    maxTime = Math.max(maxTime, endTime)
  })

  const duration = maxTime - minTime || 1 // Avoid division by zero

  // Create scale function
  const scale = (time: number) => {
    return ((time - minTime) / duration) * TIMELINE_WIDTH
  }

  // Create time markers
  const markers = []
  const numMarkers = 5
  for (let i = 0; i <= numMarkers; i++) {
    const time = minTime + (duration * i) / numMarkers
    const position = scale(time)
    const label = formatTimestamp(time, minTime)
    markers.push({ position, label })
  }

  return { scale, markers }
}

/**
 * Get color for span based on status
 */
function getSpanColor(span: Span): string {
  if (span.status === "ERROR" || span.status === "FAILED") {
    return "#ef4444" // red
  }
  if (span.status === "WARNING") {
    return "#f59e0b" // amber
  }
  return "#10b981" // green (OK/SUCCESS)
}

/**
 * Truncate text to fit within width
 */
function truncateText(text: string, maxWidth: number): string {
  const avgCharWidth = 7 // Approximate character width in pixels
  const maxChars = Math.floor(maxWidth / avgCharWidth)

  if (text.length <= maxChars) {
    return text
  }

  return text.substring(0, maxChars - 3) + "..."
}

/**
 * Format duration in human-readable format
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1) {
    return `${(durationMs * 1000).toFixed(0)}μs`
  }
  if (durationMs < 1000) {
    return `${durationMs.toFixed(0)}ms`
  }
  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)}s`
  }
  return `${(durationMs / 60000).toFixed(2)}m`
}

/**
 * Format timestamp relative to start time
 */
function formatTimestamp(_time: number, startTime: number): string {
  const elapsed = _time - startTime
  return formatDuration(elapsed)
}
