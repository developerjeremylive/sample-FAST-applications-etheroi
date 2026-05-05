"use client"

import { useEffect, useState } from "react"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoIcon, Settings, CheckCircle2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import LoadingSpinner from "@/components/loaders/LoadingSpinner"
import {
  listSessions,
  setupEvaluation,
  getEvaluationMetrics,
  listEvaluationConfigs,
} from "@/services/evaluationService"
import type { SessionListResponse, Session } from "@/types/evaluation"
import { ScoreDistributionChart } from "./ScoreDistributionChart"
import { RecentSessionsTable } from "./RecentSessionsTable"
import { AgentCoreMetrics } from "./AgentCoreMetrics"
import { ErrorDisplay } from "./ErrorDisplay"

interface DashboardStats {
  totalSessions: number
  averageScore: number
  lowScoreCount: number
  highScoreCount: number
  scoreDistribution: { range: string; count: number }[]
  recentSessions: Session[]
}

interface AgentCoreMetrics {
  configId: string
  configName: string
  totalEvaluations: number
  averageScore: number
  scoreDistribution: Record<string, number>
  evaluatorMetrics: Record<string, unknown>
}

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [agentCoreMetrics, setAgentCoreMetrics] = useState<AgentCoreMetrics[]>([])
  const [evaluationConfigId, setEvaluationConfigId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupSuccess, setSetupSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auth = useAuth()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const idToken = auth.user?.id_token
      if (!idToken) {
        throw new Error("Authentication required")
      }

      // Fetch recent sessions (last 100)
      const response: SessionListResponse = await listSessions({ limit: 100 }, idToken)

      // Calculate statistics
      const sessions = response.sessions
      const totalSessions = response.statistics.totalSessions
      const averageScore = response.statistics.averageScore

      // Count low and high scores
      const lowScoreCount = sessions.filter((s) => (s.score ?? 0) < 0.5).length
      const highScoreCount = sessions.filter((s) => (s.score ?? 0) >= 0.8).length

      // Calculate score distribution from sessions (will be overridden if AgentCore metrics available)
      const scoreDistribution = calculateScoreDistribution(sessions)

      setStats({
        totalSessions,
        averageScore,
        lowScoreCount,
        highScoreCount,
        scoreDistribution,
        recentSessions: sessions.slice(0, 10), // Top 10 most recent
      })

      // Try to load AgentCore metrics if config exists
      try {
        const configsResponse = await listEvaluationConfigs(idToken)
        if (configsResponse.configurations && configsResponse.configurations.length > 0) {
          console.log(`Found ${configsResponse.configurations.length} evaluation configs`)

          // Load metrics for ALL configs sequentially with delays to avoid caching
          const allMetrics: AgentCoreMetrics[] = []

          for (let i = 0; i < configsResponse.configurations.length; i++) {
            const config = configsResponse.configurations[i]
            const configId = config.onlineEvaluationConfigId
            const configName = config.onlineEvaluationConfigName || configId

            // Only fetch metrics if we have a valid config ID
            if (configId && configId.trim() !== "") {
              try {
                console.log(
                  `[${i + 1}/${configsResponse.configurations.length}] Loading metrics for: ${configName} (${configId})`
                )

                // Add small delay between requests to avoid API Gateway caching issues
                if (i > 0) {
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }

                const metricsResponse = await getEvaluationMetrics(configId, {}, idToken)

                console.log(`Metrics response for ${configName}:`, {
                  configId,
                  totalEvaluations: metricsResponse.totalEvaluations,
                  evaluators: Object.keys(metricsResponse.evaluatorMetrics || {}),
                  scoreDistribution: metricsResponse.scoreDistribution,
                })

                // Deep copy to ensure no reference issues
                const metricsCopy = JSON.parse(JSON.stringify(metricsResponse))

                // Add config info to metrics
                allMetrics.push({
                  configId,
                  configName,
                  ...metricsCopy,
                })

                console.log(
                  `[${i + 1}/${configsResponse.configurations.length}] Loaded ${metricsResponse.totalEvaluations} evaluations for ${configName}`
                )
              } catch (metricsError) {
                console.log(`Failed to load metrics for config ${configId}:`, metricsError)
              }
            } else {
              console.log(`Skipping config with invalid ID: ${configId}`)
            }
          }

          // Set the first config as the active one
          if (allMetrics.length > 0) {
            setEvaluationConfigId(allMetrics[0].configId)
            setAgentCoreMetrics(allMetrics)

            // Update stats with metrics from the first config that has evaluations
            const metricsWithData = allMetrics.find((m) => m.totalEvaluations > 0)
            if (metricsWithData) {
              const agentCoreScoreDistribution = [
                { range: "0.0-0.2", count: metricsWithData.scoreDistribution["0.0-0.2"] || 0 },
                { range: "0.2-0.4", count: metricsWithData.scoreDistribution["0.2-0.4"] || 0 },
                { range: "0.4-0.6", count: metricsWithData.scoreDistribution["0.4-0.6"] || 0 },
                { range: "0.6-0.8", count: metricsWithData.scoreDistribution["0.6-0.8"] || 0 },
                { range: "0.8-1.0", count: metricsWithData.scoreDistribution["0.8-1.0"] || 0 },
              ]

              // Calculate low and high scores from AgentCore distribution
              const lowScoreCount =
                (metricsWithData.scoreDistribution["0.0-0.2"] || 0) +
                (metricsWithData.scoreDistribution["0.2-0.4"] || 0) +
                (metricsWithData.scoreDistribution["0.4-0.6"] || 0)
              const highScoreCount = metricsWithData.scoreDistribution["0.8-1.0"] || 0

              setStats((prevStats) => ({
                ...prevStats!,
                scoreDistribution: agentCoreScoreDistribution,
                averageScore: metricsWithData.averageScore,
                lowScoreCount,
                highScoreCount,
              }))
            }
          } else {
            console.log("No valid configs with metrics found")
          }
        } else {
          console.log("No evaluation configs found - skipping metrics fetch")
        }
      } catch (metricsError) {
        console.log("No AgentCore metrics available yet:", metricsError)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(`Failed to load dashboard data: ${errorMessage}`)
      console.error("Error loading dashboard:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupEvaluation = async () => {
    try {
      setIsSettingUp(true)
      setError(null)

      const idToken = auth.user?.id_token
      if (!idToken) {
        throw new Error("Authentication required")
      }

      // First check if a config already exists
      try {
        const configsResponse = await listEvaluationConfigs(idToken)
        if (configsResponse.configurations && configsResponse.configurations.length > 0) {
          const config = configsResponse.configurations[0]
          const configId = config.onlineEvaluationConfigId

          if (configId) {
            setEvaluationConfigId(configId)
            setSetupSuccess(true)
            setError("Evaluation is already configured and running")

            // Reload dashboard to show metrics
            setTimeout(() => {
              setSetupSuccess(false)
              setError(null)
              loadDashboardData()
            }, 3000)
            return
          }
        }
      } catch (checkError) {
        console.log("Could not check existing configs:", checkError)
      }

      // No existing config found, create a new one
      const result = await setupEvaluation(
        {
          configName: "dashboard_evaluation",
          samplingRate: 10.0,
          enableOnCreate: true,
        },
        idToken
      )

      // Check if configuration already existed (backend check)
      if (result.alreadyExists) {
        setEvaluationConfigId(result.configId)
        setSetupSuccess(true)
        setError("Evaluation is already configured and running")

        // Reload dashboard to show metrics
        setTimeout(() => {
          setSetupSuccess(false)
          setError(null)
          loadDashboardData()
        }, 3000)
      } else {
        setEvaluationConfigId(result.configId)
        setSetupSuccess(true)

        // Reload dashboard to show new metrics
        setTimeout(() => {
          setSetupSuccess(false)
          loadDashboardData()
        }, 2000)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(`Failed to setup evaluation: ${errorMessage}`)
      console.error("Error setting up evaluation:", err)
    } finally {
      setIsSettingUp(false)
    }
  }

  const calculateScoreDistribution = (sessions: Session[]): { range: string; count: number }[] => {
    const bins = [
      { range: "0.0-0.2", min: 0.0, max: 0.2, count: 0 },
      { range: "0.2-0.4", min: 0.2, max: 0.4, count: 0 },
      { range: "0.4-0.6", min: 0.4, max: 0.6, count: 0 },
      { range: "0.6-0.8", min: 0.6, max: 0.8, count: 0 },
      { range: "0.8-1.0", min: 0.8, max: 1.0, count: 0 },
    ]

    sessions.forEach((session) => {
      const score = session.score ?? 0
      const bin = bins.find((b) => score >= b.min && score < b.max) || bins[bins.length - 1]
      bin.count++
    })

    return bins.map((b) => ({ range: b.range, count: b.count }))
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />
  }

  if (error && !stats) {
    return <ErrorDisplay error={error} title="Dashboard Error" onRetry={loadDashboardData} />
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <p className="text-gray-600">No evaluation data available</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Added overflow-y-auto and h-full */}
      {/* Setup Evaluation Banner */}
      {!evaluationConfigId && !setupSuccess && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Enable AgentCore Evaluations</h3>
                <p className="text-sm text-blue-800 mb-4">
                  Set up continuous evaluation with built-in evaluators (Helpfulness, Correctness,
                  Goal Success) to automatically assess agent performance on 10% of interactions.
                </p>
              </div>
              <Button onClick={handleSetupEvaluation} disabled={isSettingUp} className="ml-4">
                {isSettingUp ? (
                  <>
                    <Settings className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Setup Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Success Message */}
      {setupSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">AgentCore Evaluations Enabled!</span>
            </div>
            <p className="text-sm text-green-800 mt-2">
              Your agent is now being continuously evaluated. Metrics will appear below as
              evaluations complete.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && stats && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={loadDashboardData} variant="outline" disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sessions"
          value={stats.scoreDistribution.reduce((sum, bin) => sum + bin.count, 0).toString()}
          description="Sessions in current view"
          tooltip="Total number of sessions shown in the score distribution chart"
        />
        <StatCard
          title="Average Score"
          value={stats.averageScore.toFixed(2)}
          description="Mean evaluation score"
          tooltip="Average score across all evaluated sessions (0.0 - 1.0 scale)"
        />
        <StatCard
          title="Low Scores"
          value={stats.lowScoreCount.toString()}
          description="Sessions below 0.5"
          trend="down"
          tooltip="Number of sessions with scores below 0.5, indicating potential issues"
        />
        <StatCard
          title="High Scores"
          value={stats.highScoreCount.toString()}
          description="Sessions above 0.8"
          trend="up"
          tooltip="Number of sessions with scores above 0.8, indicating excellent performance"
        />
      </div>

      {/* AgentCore Evaluator Metrics - Show for each config */}
      {agentCoreMetrics.length > 0 && agentCoreMetrics.some((m) => m.totalEvaluations > 0) && (
        <div className="space-y-4">
          {agentCoreMetrics.map(
            (metrics) =>
              metrics.totalEvaluations > 0 && (
                <div key={metrics.configId}>
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{metrics.configName}</h3>
                    <p className="text-sm text-gray-600">Config ID: {metrics.configId}</p>
                  </div>
                  <AgentCoreMetrics metrics={metrics} />
                </div>
              )
          )}
        </div>
      )}

      {/* Score Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Score Distribution
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Visual breakdown of how evaluation scores are distributed across all sessions.
                    Higher scores indicate better agent performance.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>Distribution of evaluation scores across sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreDistributionChart data={stats.scoreDistribution} />
        </CardContent>
      </Card>

      {/* Recent Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recent Sessions
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Most recent agent conversation sessions with their evaluation scores and status.
                    Click on a session to view detailed traces and spans.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>Latest evaluation sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentSessionsTable sessions={stats.recentSessions} />
        </CardContent>
      </Card>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  description: string
  trend?: "up" | "down"
  tooltip?: string
}

function StatCard({ title, value, description, trend, tooltip }: StatCardProps) {
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : ""

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {title}
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-3 w-3 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardDescription>
        <CardTitle className={`text-3xl ${trendColor}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
