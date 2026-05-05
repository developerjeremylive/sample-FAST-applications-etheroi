"use client"

import { useState, useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Play, Loader2 } from "lucide-react"
import LoadingSpinner from "@/components/loaders/LoadingSpinner"
import { listEvaluators, evaluateSession } from "@/services/evaluationService"
import { ErrorDisplay } from "./ErrorDisplay"

interface OnDemandEvaluationProps {
  sessionId: string
}

interface Evaluator {
  id: string
  name: string
  level: string
  builtin: boolean
}

interface EvaluationResultItem {
  evaluatorId?: string
  evaluatorName?: string
  value?: number
  label?: string
  explanation?: string
  [key: string]: unknown
}

interface EvaluationResultGroup {
  evaluatorId: string
  evaluatorName: string
  results: EvaluationResultItem[]
}

export function OnDemandEvaluation({ sessionId }: OnDemandEvaluationProps) {
  const auth = useAuth()
  const [evaluators, setEvaluators] = useState<Evaluator[]>([])
  const [selectedEvaluators, setSelectedEvaluators] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [results, setResults] = useState<EvaluationResultGroup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadEvaluators()
  }, [])

  const loadEvaluators = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const idToken = auth.user?.id_token
      if (!idToken) {
        throw new Error("Authentication required")
      }

      const response = await listEvaluators(idToken)

      // Combine built-in and custom evaluators
      const allEvaluators: Evaluator[] = [
        ...(response.builtinEvaluators || []),
        ...(response.customEvaluators || []),
      ]

      setEvaluators(allEvaluators)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(`Failed to load evaluators: ${errorMessage}`)
      console.error("Error loading evaluators:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEvaluatorToggle = (evaluatorId: string) => {
    setSelectedEvaluators((prev) =>
      prev.includes(evaluatorId) ? prev.filter((id) => id !== evaluatorId) : [...prev, evaluatorId]
    )
  }

  const handleRunEvaluation = async () => {
    if (selectedEvaluators.length === 0) {
      setError("Please select at least one evaluator")
      return
    }

    try {
      setIsEvaluating(true)
      setError(null)
      setResults(null)

      const idToken = auth.user?.id_token
      if (!idToken) {
        throw new Error("Authentication required")
      }

      // Run evaluation for each selected evaluator
      const allResults: EvaluationResultGroup[] = []

      for (const evaluatorId of selectedEvaluators) {
        const response = await evaluateSession(sessionId, evaluatorId, idToken)

        // Response format: { sessionId, evaluatorIds, evaluationResults, resultCount }
        // evaluationResults is a flat array with all results
        if (response.evaluationResults && response.evaluationResults.length > 0) {
          // Group results by evaluator (in case multiple evaluators were run)
          const resultsByEvaluator: Record<string, EvaluationResultItem[]> = {}

          response.evaluationResults.forEach((result: EvaluationResultItem) => {
            const evalName = result.evaluatorName || result.evaluatorId
            if (!resultsByEvaluator[evalName]) {
              resultsByEvaluator[evalName] = []
            }
            resultsByEvaluator[evalName].push(result)
          })

          // Add each evaluator's results
          Object.entries(resultsByEvaluator).forEach(([evalName, evalResults]) => {
            allResults.push({
              evaluatorId: evalResults[0].evaluatorId,
              evaluatorName: evalName,
              results: evalResults,
            })
          })
        }
      }

      setResults(allResults)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(`Evaluation failed: ${errorMessage}`)
      console.error("Error running evaluation:", err)
    } finally {
      setIsEvaluating(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading evaluators..." />
  }

  if (error && !evaluators.length) {
    return <ErrorDisplay error={error} title="Evaluator Loading Error" onRetry={loadEvaluators} />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>On-Demand Evaluation</CardTitle>
          <CardDescription>Run evaluators on this session to assess performance</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Evaluator Selection */}
          <div className="space-y-3 mb-4">
            <h4 className="font-medium text-sm text-gray-700">Select Evaluators</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evaluators.map((evaluator) => (
                <div
                  key={evaluator.id}
                  className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50"
                >
                  <Checkbox
                    id={evaluator.id}
                    checked={selectedEvaluators.includes(evaluator.id)}
                    onCheckedChange={() => handleEvaluatorToggle(evaluator.id)}
                  />
                  <label htmlFor={evaluator.id} className="flex-1 text-sm cursor-pointer">
                    <div className="font-medium">{evaluator.name}</div>
                    <div className="text-xs text-gray-500">
                      {evaluator.level} • {evaluator.builtin ? "Built-in" : "Custom"}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <Button
            onClick={handleRunEvaluation}
            disabled={isEvaluating || selectedEvaluators.length === 0}
            className="w-full"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Evaluation ({selectedEvaluators.length} selected)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Results</CardTitle>
            <CardDescription>Results from {results.length} evaluator(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result: EvaluationResultGroup, idx: number) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{result.evaluatorName}</h4>
                    <span className="text-sm text-gray-600">
                      {result.results?.length || 0} result(s)
                    </span>
                  </div>

                  {result.results && result.results.length > 0 && (
                    <div className="space-y-3">
                      {result.results.map((evalResult: EvaluationResultItem, resultIdx: number) => (
                        <div key={resultIdx} className="bg-gray-50 p-3 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              Score: {evalResult.value?.toFixed(2) || "N/A"}
                            </span>
                            {evalResult.label && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {evalResult.label}
                              </span>
                            )}
                          </div>
                          {evalResult.explanation && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-600 mb-1">Explanation:</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {evalResult.explanation}
                              </p>
                            </div>
                          )}
                          {evalResult.tokenUsage && (
                            <div className="mt-2 text-xs text-gray-500">
                              Tokens: {evalResult.tokenUsage.totalTokens}
                              (in: {evalResult.tokenUsage.inputTokens}, out:{" "}
                              {evalResult.tokenUsage.outputTokens})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
