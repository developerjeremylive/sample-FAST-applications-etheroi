"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PromptImprovement, PromptChange } from "@/types/evaluation"
import { CheckCircle2, AlertCircle, Info } from "lucide-react"

interface PromptComparisonViewerProps {
  improvement: PromptImprovement
}

export function PromptComparisonViewer({ improvement }: PromptComparisonViewerProps) {
  const [viewMode, setViewMode] = useState<"split" | "unified">("split")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prompt Improvements</h2>

        <div className="flex gap-2">
          <Button
            variant={viewMode === "split" ? "default" : "outline"}
            onClick={() => setViewMode("split")}
          >
            Split View
          </Button>
          <Button
            variant={viewMode === "unified" ? "default" : "outline"}
            onClick={() => setViewMode("unified")}
          >
            Unified View
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Changes Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {improvement.changes.map((change, idx) => (
              <ChangeCard key={idx} change={change} index={idx} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DiffViewer
            oldValue={improvement.originalPrompt}
            newValue={improvement.improvedPrompt}
            splitView={viewMode === "split"}
          />
        </CardContent>
      </Card>
    </div>
  )
}

interface ChangeCardProps {
  change: PromptChange
  index: number
}

function ChangeCard({ change, index }: ChangeCardProps) {
  // Determine change type based on impact keywords
  const getChangeType = (impact: string): "high" | "medium" | "low" => {
    const lowerImpact = impact.toLowerCase()
    if (
      lowerImpact.includes("significant") ||
      lowerImpact.includes("major") ||
      lowerImpact.includes("critical")
    ) {
      return "high"
    } else if (lowerImpact.includes("moderate") || lowerImpact.includes("important")) {
      return "medium"
    }
    return "low"
  }

  const changeType = getChangeType(change.impact)

  const typeConfig = {
    high: {
      icon: AlertCircle,
      borderColor: "border-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-900/10",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
    medium: {
      icon: Info,
      borderColor: "border-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    low: {
      icon: CheckCircle2,
      borderColor: "border-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/10",
      iconColor: "text-green-600 dark:text-green-400",
    },
  }

  const config = typeConfig[changeType]
  const Icon = config.icon

  return (
    <div className={`border-l-4 ${config.borderColor} ${config.bgColor} p-4 rounded-r-lg`}>
      <div className="flex items-start gap-3">
        <Icon className={`${config.iconColor} mt-0.5 shrink-0`} size={20} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{change.section}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-background border">
              Change {index + 1}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{change.reasoning}</p>
          <div className="flex items-start gap-2">
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              Expected Impact:
            </span>
            <span className="text-sm">{change.impact}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DiffViewerProps {
  oldValue: string
  newValue: string
  splitView: boolean
}

function DiffViewer({ oldValue, newValue, splitView }: DiffViewerProps) {
  // Split text into lines for comparison
  const oldLines = oldValue.split("\n")
  const newLines = newValue.split("\n")

  // Simple line-by-line diff
  const diff = computeLineDiff(oldLines, newLines)

  if (splitView) {
    return (
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <div className="text-sm font-semibold mb-2 text-muted-foreground">Original Prompt</div>
          <pre className="text-sm whitespace-pre-wrap font-mono">
            {diff.map((line, idx) => (
              <div
                key={`old-${idx}`}
                className={
                  line.type === "removed"
                    ? "bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-300"
                    : line.type === "unchanged"
                      ? ""
                      : "opacity-30"
                }
              >
                {line.type === "removed" || line.type === "unchanged" ? line.oldValue : ""}
              </div>
            ))}
          </pre>
        </div>
        <div className="p-4">
          <div className="text-sm font-semibold mb-2 text-muted-foreground">Improved Prompt</div>
          <pre className="text-sm whitespace-pre-wrap font-mono">
            {diff.map((line, idx) => (
              <div
                key={`new-${idx}`}
                className={
                  line.type === "added"
                    ? "bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-300"
                    : line.type === "unchanged"
                      ? ""
                      : "opacity-30"
                }
              >
                {line.type === "added" || line.type === "unchanged" ? line.newValue : ""}
              </div>
            ))}
          </pre>
        </div>
      </div>
    )
  }

  // Unified view
  return (
    <div className="p-4">
      <pre className="text-sm whitespace-pre-wrap font-mono">
        {diff.map((line, idx) => (
          <div
            key={`unified-${idx}`}
            className={
              line.type === "removed"
                ? "bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-300"
                : line.type === "added"
                  ? "bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-300"
                  : ""
            }
          >
            {line.type === "removed" && `- ${line.oldValue}`}
            {line.type === "added" && `+ ${line.newValue}`}
            {line.type === "unchanged" && `  ${line.oldValue}`}
          </div>
        ))}
      </pre>
    </div>
  )
}

interface DiffLine {
  type: "added" | "removed" | "unchanged"
  oldValue: string
  newValue: string
}

function computeLineDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = []

  // Simple LCS-based diff algorithm
  const lcs = longestCommonSubsequence(oldLines, newLines)

  let oldIdx = 0
  let newIdx = 0
  let lcsIdx = 0

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      // Unchanged line
      result.push({
        type: "unchanged",
        oldValue: oldLines[oldIdx],
        newValue: newLines[newIdx],
      })
      oldIdx++
      newIdx++
      lcsIdx++
    } else if (
      oldIdx < oldLines.length &&
      (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])
    ) {
      // Removed line
      result.push({
        type: "removed",
        oldValue: oldLines[oldIdx],
        newValue: "",
      })
      oldIdx++
    } else if (newIdx < newLines.length) {
      // Added line
      result.push({
        type: "added",
        oldValue: "",
        newValue: newLines[newIdx],
      })
      newIdx++
    }
  }

  return result
}

function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length
  const n = arr2.length
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0))

  // Build LCS length table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Reconstruct LCS
  const lcs: string[] = []
  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return lcs
}
