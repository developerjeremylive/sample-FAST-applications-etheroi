import { useMutation, useQuery } from "@tanstack/react-query"
import { analyzeSessions, getAnalysisStatus } from "@/services/evaluationService"
import type { AnalysisConfig, AnalysisResult } from "@/types/evaluation"
import { useState, useEffect } from "react"

/**
 * Hook for triggering AI analysis of sessions with async polling
 * Uses React Query's useMutation for async state management
 */
export function useAnalysis(idToken?: string) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [finalResult, setFinalResult] = useState<AnalysisResult | null>(null)

  // Mutation to start analysis
  const startMutation = useMutation<
    { jobId: string; status: string; message: string },
    Error,
    AnalysisConfig
  >({
    mutationFn: async (config: AnalysisConfig) => {
      if (!idToken) {
        throw new Error("Authentication required")
      }
      return await analyzeSessions(config, idToken)
    },
    onSuccess: (data) => {
      setJobId(data.jobId)
      setFinalResult(null)
    },
  })

  // Query to poll for results
  const { data: statusData } = useQuery({
    queryKey: ["analysisStatus", jobId], // Remove timestamp from query key - it causes constant refetching
    queryFn: async () => {
      if (!jobId || !idToken) return null
      return await getAnalysisStatus(jobId, idToken)
    },
    enabled: !!jobId && !!idToken,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache
    refetchInterval: (query) => {
      const data = query.state.data
      // Stop polling if COMPLETED or FAILED
      if (data?.status === "COMPLETED" || data?.status === "FAILED") {
        return false
      }
      // Poll every 10 seconds if PENDING or PROCESSING
      if (data?.status === "PENDING" || data?.status === "PROCESSING") {
        return 10000
      }
      // Default: poll every 10 seconds
      return 10000
    },
  })

  // Update final result when job completes
  useEffect(() => {
    if (statusData?.status === "COMPLETED" && statusData.result) {
      setFinalResult(statusData.result)
      setJobId(null) // Stop polling
    } else if (statusData?.status === "FAILED") {
      setJobId(null) // Stop polling
    }
  }, [statusData])

  return {
    mutate: startMutation.mutate,
    data: finalResult,
    isPending:
      startMutation.isPending ||
      statusData?.status === "PENDING" ||
      statusData?.status === "PROCESSING",
    error:
      startMutation.error || (statusData?.status === "FAILED" ? new Error(statusData.error) : null),
    status: statusData?.status,
  }
}
