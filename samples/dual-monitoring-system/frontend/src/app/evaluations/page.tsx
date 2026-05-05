"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { EvaluationsTab } from "@/components/evaluations/EvaluationsTab"
import { GlobalContextProvider } from "@/app/context/GlobalContext"
import { useAuth } from "react-oidc-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import LoadingSpinner from "@/components/loaders/LoadingSpinner"
import { getSession } from "@/services/evaluationService"
import type { SessionDetail } from "@/types/evaluation"
import { ErrorDisplay } from "@/components/evaluations/ErrorDisplay"
import { TraceViewer } from "@/components/evaluations/TraceViewer"

/**
 * Evaluations Page
 * Main page for evaluation dashboard features
 * Supports session detail view via ?sessionId query parameter
 * Requirements: 15.3, 15.4, 15.5
 */
export default function EvaluationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const sessionId = searchParams.get("sessionId")

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId)
    }
  }, [sessionId])

  const loadSession = async (id: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const idToken = auth.user?.id_token
      if (!idToken) {
        throw new Error("Authentication required")
      }

      const sessionData = await getSession(id, idToken)
      setSession(sessionData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(`Failed to load session: ${errorMessage}`)
      console.error("Error loading session:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    router.push("/evaluations")
  }

  // Show session detail if sessionId is in query params
  if (sessionId) {
    if (isLoading) {
      return (
        <GlobalContextProvider>
          <div className="p-6">
            <LoadingSpinner message="Loading session details..." />
          </div>
        </GlobalContextProvider>
      )
    }

    if (error) {
      return (
        <GlobalContextProvider>
          <div className="p-6">
            <Button onClick={handleBack} variant="outline" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <ErrorDisplay
              error={error}
              title="Session Load Error"
              onRetry={() => loadSession(sessionId)}
            />
          </div>
        </GlobalContextProvider>
      )
    }

    if (!session) {
      return (
        <GlobalContextProvider>
          <div className="p-6">
            <Button onClick={handleBack} variant="outline" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600">Session not found</p>
              </CardContent>
            </Card>
          </div>
        </GlobalContextProvider>
      )
    }

    return (
      <GlobalContextProvider>
        <div className="p-6 space-y-6">
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <div>
              <Button onClick={handleBack} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sessions
              </Button>
            </div>
            <Button onClick={() => loadSession(sessionId)} variant="outline" size="sm">
              Refresh
            </Button>
          </div>

          {/* Session Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>Session ID: {sessionId}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Timestamp</p>
                  <p className="font-medium">{new Date(session.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium capitalize">{session.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Traces</p>
                  <p className="font-medium">{session.traces?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Spans</p>
                  <p className="font-medium">
                    {session.traces?.reduce((sum, t) => sum + (t.spans?.length || 0), 0) || 0}
                  </p>
                </div>
              </div>

              {session.evaluation && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-2">Evaluation Score</p>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">
                      {session.evaluation.score?.toFixed(2) || "N/A"}
                    </div>
                    {session.evaluation.evaluator && (
                      <span className="text-sm text-gray-600">
                        by {session.evaluation.evaluator}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Traces and Spans */}
          <Card>
            <CardHeader>
              <CardTitle>Traces and Spans</CardTitle>
              <CardDescription>Detailed execution trace with all spans</CardDescription>
            </CardHeader>
            <CardContent>
              {session.traces && session.traces.length > 0 ? (
                <TraceViewer sessionId={sessionId} traces={session.traces} />
              ) : (
                <p className="text-gray-600">No trace data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </GlobalContextProvider>
    )
  }

  // Show main evaluations dashboard
  return (
    <GlobalContextProvider>
      <div className="relative h-screen">
        <EvaluationsTab />
      </div>
    </GlobalContextProvider>
  )
}
