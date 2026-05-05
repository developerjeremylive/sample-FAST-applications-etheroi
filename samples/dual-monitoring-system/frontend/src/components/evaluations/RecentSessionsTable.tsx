"use client"

import { useRouter } from "next/navigation"
import type { Session } from "@/types/evaluation"

interface RecentSessionsTableProps {
  sessions: Session[]
}

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  const router = useRouter()

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>No recent sessions available</p>
      </div>
    )
  }

  const handleRowClick = (sessionId: string) => {
    // Use query parameter instead of dynamic route for static export compatibility
    router.push(`/evaluations?sessionId=${sessionId}`)
  }

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString()
    } catch {
      return timestamp
    }
  }

  const getStatusBadge = (status: string): React.ReactElement => {
    const statusColors: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      in_progress: "bg-blue-100 text-blue-800",
    }

    const colorClass = statusColors[status] || "bg-gray-100 text-gray-800"

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status.replace("_", " ")}
      </span>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Session ID</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Timestamp</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Traces</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Spans</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.sessionId}
              onClick={() => handleRowClick(session.sessionId)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-4 text-sm font-mono text-gray-900">
                {session.sessionId.substring(0, 8)}...
              </td>
              <td className="py-3 px-4 text-sm text-gray-600">
                {formatTimestamp(session.timestamp)}
              </td>
              <td className="py-3 px-4 text-sm text-gray-600">{session.traceCount}</td>
              <td className="py-3 px-4 text-sm text-gray-600">{session.spanCount}</td>
              <td className="py-3 px-4">{getStatusBadge(session.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
