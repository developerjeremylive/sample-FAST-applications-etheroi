import { useQuery } from "@tanstack/react-query"
import { getSession } from "@/services/evaluationService"
import type { SessionDetail } from "@/types/evaluation"

/**
 * Hook for fetching individual session details
 * Implements optimized caching for session data
 * Requirement: 14.5 - Cache effectiveness
 */
export function useSession(sessionId: string, idToken?: string) {
  return useQuery<SessionDetail, Error>({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      if (!idToken) {
        throw new Error("Authentication required")
      }
      return await getSession(sessionId, idToken)
    },
    enabled: !!idToken && !!sessionId,

    // Optimized caching - session details rarely change
    staleTime: 1000 * 60 * 10, // 10 minutes - session details are stable
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch on focus for stable data
    refetchOnMount: false, // Use cached data on mount
  })
}
