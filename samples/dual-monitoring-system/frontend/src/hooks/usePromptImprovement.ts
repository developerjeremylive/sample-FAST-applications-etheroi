import { useMutation, useQuery } from "@tanstack/react-query"
import { improvePrompt, getPromptImprovementStatus } from "@/services/evaluationService"
import type { PromptImprovementRequest, PromptImprovement } from "@/types/evaluation"
import { useState, useEffect } from "react"

/**
 * Hook for generating prompt improvements with async polling
 * Uses React Query's useMutation for async state management
 */
export function usePromptImprovement(idToken?: string) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [finalResult, setFinalResult] = useState<PromptImprovement | null>(null)

  // Mutation to start prompt improvement
  const startMutation = useMutation<
    { jobId: string; status: string; message: string },
    Error,
    PromptImprovementRequest
  >({
    mutationFn: async (request: PromptImprovementRequest) => {
      if (!idToken) {
        throw new Error("Authentication required")
      }
      return await improvePrompt(request, idToken)
    },
    onSuccess: (data) => {
      setJobId(data.jobId)
      setFinalResult(null)
    },
  })

  // Query to poll for results
  const { data: statusData } = useQuery({
    queryKey: ["promptImprovementStatus", jobId],
    queryFn: async () => {
      if (!jobId || !idToken) return null
      return await getPromptImprovementStatus(jobId, idToken)
    },
    enabled: !!jobId && !!idToken,
    staleTime: 0,
    gcTime: 0,
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
