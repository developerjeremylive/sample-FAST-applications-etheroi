"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface EvaluatorMetric {
  count: number
  totalScore: number
  averageScore: number
}

interface AgentCoreMetricsProps {
  metrics: {
    totalEvaluations: number
    averageScore: number
    scoreDistribution: Record<string, number>
    evaluatorMetrics: Record<string, EvaluatorMetric>
  }
}

const EVALUATOR_DESCRIPTIONS: Record<string, string> = {
  "Builtin.Helpfulness":
    "Measures how useful and valuable the agent's response is from the user's perspective",
  "Builtin.Correctness":
    "Evaluates whether the information in the agent's response is factually accurate",
  "Builtin.GoalSuccessRate":
    "Assesses whether the agent successfully completed all user goals in the conversation",
  "Builtin.Faithfulness":
    "Checks if the response stays true to the provided context without hallucination",
  "Builtin.ContextRelevance": "Measures how relevant the response is to the user's query",
  "Builtin.Coherence": "Evaluates the logical flow and consistency of the response",
  "Builtin.Conciseness":
    "Assesses whether the response is appropriately brief without unnecessary information",
  "Builtin.Harmfulness": "Detects potentially harmful or unsafe content in responses",
  "Builtin.Maliciousness": "Identifies malicious intent or attempts to manipulate users",
  "Builtin.Stereotyping": "Detects stereotypical or biased language in responses",
  "Builtin.Refusal": "Tracks when the agent appropriately refuses inappropriate requests",
  "Builtin.ToolSelectionAccuracy":
    "Evaluates whether the agent selected the correct tools for the task",
  "Builtin.ToolParameterAccuracy": "Assesses if the agent used tools with correct parameters",
  "Builtin.InstructionFollowing":
    "Assesses whether an AI assistant's response adheres to all explicit instructions provided in the user's input.",
  "Builtin.ResponseRelevance":
    "Assesses how well an AI assistant's response addresses the specific question or request",
}

export function AgentCoreMetrics({ metrics }: AgentCoreMetricsProps) {
  const evaluatorEntries = Object.entries(metrics.evaluatorMetrics)

  if (evaluatorEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AgentCore Evaluator Metrics
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Detailed breakdown of performance by each AgentCore evaluator. Each evaluator
                    assesses a specific quality dimension of agent responses.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>Performance breakdown by evaluator type</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">No evaluator metrics available yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AgentCore Evaluator Metrics
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="h-4 w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Detailed breakdown of performance by each AgentCore evaluator. Each evaluator
                  assesses a specific quality dimension of agent responses.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>Performance breakdown by evaluator type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {evaluatorEntries.map(([evaluatorId, metric]) => {
            const evaluatorName = evaluatorId.replace("Builtin.", "")
            const description = EVALUATOR_DESCRIPTIONS[evaluatorId] || "Custom evaluator"
            const scoreColor =
              metric.averageScore >= 0.8
                ? "text-green-600"
                : metric.averageScore >= 0.6
                  ? "text-yellow-600"
                  : "text-red-600"

            return (
              <div
                key={evaluatorId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{evaluatorName}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <InfoIcon className="h-3 w-3 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {metric.count} evaluation{metric.count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${scoreColor}`}>
                    {metric.averageScore.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-600">avg score</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
