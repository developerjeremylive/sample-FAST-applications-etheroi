"use client"

import { X } from "lucide-react"
import type { Span } from "@/types/evaluation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface SpanDetailsPanelProps {
  span: Span
  onClose: () => void
}

/**
 * SpanDetailsPanel Component
 * Displays detailed information about a selected span
 * Requirement: 5.4 - Display span attributes and metadata
 */
export function SpanDetailsPanel({ span, onClose }: SpanDetailsPanelProps) {
  return (
    <div className="w-96 border-l border-gray-200 bg-white overflow-auto">
      <Card className="border-0 rounded-none">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="flex-1">
            <CardTitle className="text-lg">Span Details</CardTitle>
            <CardDescription className="mt-1 break-all">{span.name}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mt-1">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Timing Information */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Timing</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Duration" value={formatDuration(span.durationMs)} />
              <DetailRow label="Start Time" value={formatTimestamp(span.startTime)} />
              <DetailRow label="End Time" value={formatTimestamp(span.endTime)} />
            </div>
          </div>

          <Separator />

          {/* Span Identifiers */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Identifiers</h3>
            <div className="space-y-2 text-sm">
              <DetailRow label="Span ID" value={span.spanId} mono />
              <DetailRow label="Trace ID" value={span.traceId} mono />
              {span.parentSpanId && (
                <DetailRow label="Parent Span ID" value={span.parentSpanId} mono />
              )}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Status</h3>
            <div className="flex items-center gap-2">
              <StatusBadge status={span.status} />
              <span className="text-sm text-gray-600">{span.status}</span>
            </div>
          </div>

          {/* Attributes */}
          {Object.keys(span.attributes).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Attributes</h3>
                <div className="space-y-2">
                  {Object.entries(span.attributes).map(([key, value]) => (
                    <DetailRow key={key} label={key} value={formatAttributeValue(value)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
  mono?: boolean
}

function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-sm break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}

interface StatusBadgeProps {
  status: string
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusColor = (status: string) => {
    const upperStatus = status.toUpperCase()
    if (upperStatus === "ERROR" || upperStatus === "FAILED") {
      return "bg-red-500"
    }
    if (upperStatus === "WARNING") {
      return "bg-amber-500"
    }
    return "bg-green-500"
  }

  return <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
}

/**
 * Format duration in human-readable format
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1) {
    return `${(durationMs * 1000).toFixed(0)} μs`
  }
  if (durationMs < 1000) {
    return `${durationMs.toFixed(2)} ms`
  }
  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)} s`
  }
  return `${(durationMs / 60000).toFixed(2)} min`
}

/**
 * Format ISO timestamp to readable format
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  })
}

/**
 * Format attribute value for display
 */
function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null"
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}
