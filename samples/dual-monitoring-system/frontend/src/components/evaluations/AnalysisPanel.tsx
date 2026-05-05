"use client"

import { useState } from "react"
import { useAnalysis } from "@/hooks/useAnalysis"
import { usePromptImprovement } from "@/hooks/usePromptImprovement"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PatternCard } from "./PatternCard"
import { PromptComparisonViewer } from "./PromptComparisonViewer"
import { InlineError } from "./ErrorDisplay"
import type { AnalysisConfig } from "@/types/evaluation"

/**
 * AI Analysis Panel Component
 *
 * Provides interface for configuring and triggering AI analysis of low-scoring sessions.
 * Displays analysis results including patterns, summary, and recommendations.
 *
 * Requirements: 7.6
 */
export function AnalysisPanel() {
  const { token } = useAuth()
  const [config, setConfig] = useState<AnalysisConfig>({
    scoreThreshold: 0.5,
    limit: 100,
  })
  const [currentPrompt, setCurrentPrompt] = useState<string>("")

  const { mutate: runAnalysis, data, isPending, error, status } = useAnalysis(token ?? undefined)
  const {
    mutate: generateImprovement,
    data: improvementData,
    isPending: isImprovementPending,
    error: improvementError,
  } = usePromptImprovement(token ?? undefined)

  const handleRunAnalysis = () => {
    runAnalysis(config)
  }

  const handleRetry = () => {
    runAnalysis(config)
  }

  const handleGenerateImprovement = () => {
    if (!currentPrompt.trim()) {
      return
    }
    generateImprovement({
      currentPrompt,
      scoreThreshold: config.scoreThreshold,
      limit: config.limit,
    })
  }

  // Show status message
  const getStatusMessage = () => {
    if (status === "PENDING") return "Analysis job queued..."
    if (status === "PROCESSING") return "Processing evaluation data..."
    return null
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">
      <Card>
        <CardHeader>
          <CardTitle>AI Pattern Analysis</CardTitle>
          <CardDescription>Identify common patterns in low-scoring evaluations</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="scoreThreshold" className="text-sm font-medium mb-1.5 block">
                Score Threshold
              </label>
              <Input
                id="scoreThreshold"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={config.scoreThreshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    scoreThreshold: parseFloat(e.target.value),
                  })
                }
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Analyze sessions with scores below this threshold
              </p>
            </div>

            <div className="flex-1">
              <label htmlFor="limit" className="text-sm font-medium mb-1.5 block">
                Max Sessions
              </label>
              <Input
                id="limit"
                type="number"
                min={10}
                max={1000}
                step={10}
                value={config.limit}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    limit: parseInt(e.target.value, 10),
                  })
                }
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of sessions to analyze
              </p>
            </div>

            <Button onClick={handleRunAnalysis} disabled={isPending}>
              {isPending ? "Analyzing..." : "Run Analysis"}
            </Button>
          </div>

          {/* Status Message */}
          {isPending && getStatusMessage() && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">{getStatusMessage()}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display with Retry - Requirements 13.2, 13.3 */}
      {error && <InlineError error={error} onRetry={handleRetry} />}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Analysis completed at {new Date(data.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground">{data.summary}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Identified Patterns</h3>
                {data.patterns.length > 0 ? (
                  <div className="space-y-3">
                    {data.patterns.map((pattern, idx) => (
                      <PatternCard key={idx} pattern={pattern} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No significant patterns identified in the analyzed sessions.
                  </p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Recommendations</h3>
                {data.recommendations.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {data.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm">
                        {rec}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No specific recommendations at this time.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prompt Improvement Section */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Prompt Improvement</CardTitle>
            <CardDescription>
              Generate AI-powered suggestions to improve your prompts based on analysis results
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor="currentPrompt" className="text-sm font-medium mb-1.5 block">
                  Current Prompt
                </label>
                <Textarea
                  id="currentPrompt"
                  placeholder="Paste your current prompt here..."
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  disabled={isImprovementPending}
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the prompt you want to improve based on the analysis patterns
                </p>
              </div>

              <Button
                onClick={handleGenerateImprovement}
                disabled={isImprovementPending || !currentPrompt.trim()}
              >
                {isImprovementPending ? "Generating..." : "Generate Improvements"}
              </Button>

              {/* Error Display for Prompt Improvement */}
              {improvementError && (
                <InlineError error={improvementError.message} onRetry={handleGenerateImprovement} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prompt Comparison Viewer */}
      {improvementData && <PromptComparisonViewer improvement={improvementData} />}
    </div>
  )
}
