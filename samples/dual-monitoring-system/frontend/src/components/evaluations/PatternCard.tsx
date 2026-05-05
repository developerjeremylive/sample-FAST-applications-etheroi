"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import type { Pattern } from "@/types/evaluation"

interface PatternCardProps {
  pattern: Pattern
}

/**
 * Pattern Card Component
 *
 * Displays a single identified pattern from AI analysis including:
 * - Pattern description
 * - Frequency of occurrence
 * - Supporting evidence
 * - List of affected session IDs
 *
 * Requirements: 7.3, 7.4
 */
export function PatternCard({ pattern }: PatternCardProps) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="text-base">{pattern.pattern}</CardTitle>
        <CardDescription>
          Occurred {pattern.frequency} time{pattern.frequency !== 1 ? "s" : ""} across{" "}
          {pattern.affectedSessions.length} session
          {pattern.affectedSessions.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-1">Evidence</h4>
            <p className="text-sm text-muted-foreground">{pattern.evidence}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-1">Affected Sessions</h4>
            <div className="flex flex-wrap gap-2">
              {pattern.affectedSessions.slice(0, 5).map((sessionId) => (
                <code key={sessionId} className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {sessionId.slice(0, 8)}...
                </code>
              ))}
              {pattern.affectedSessions.length > 5 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{pattern.affectedSessions.length - 5} more
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
