import { useInfiniteQuery } from "@tanstack/react-query"
import { listSessions } from "@/services/evaluationService"
import type { SessionFilters, SessionListResponse, SessionQueryParams } from "@/types/evaluation"

/**
 * Hook for fetching sessions with infinite scroll pagination
 * Uses React Query's useInfiniteQuery for automatic pagination management
 * Implements optimized caching with stale-while-revalidate strategy
 * Requirement: 14.5 - Cache effectiveness
 */
export function useInfiniteSessions(filters: SessionFilters, idToken?: string) {
  return useInfiniteQuery<SessionListResponse, Error>({
    queryKey: ["sessions", filters],
    queryFn: async ({ pageParam }) => {
      if (!idToken) {
        throw new Error("Authentication required")
      }

      // Convert filters to query params
      const params: SessionQueryParams = {
        limit: 50, // Fetch 50 sessions per page
        nextToken: pageParam as string | undefined,
      }

      // Add date filters
      if (filters.startDate) {
        params.startDate = filters.startDate.toISOString()
      }
      if (filters.endDate) {
        params.endDate = filters.endDate.toISOString()
      }

      // Add score filters
      if (filters.minScore !== undefined) {
        params.minScore = filters.minScore
      }
      if (filters.maxScore !== undefined) {
        params.maxScore = filters.maxScore
      }

      return await listSessions(params, idToken)
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextToken ?? undefined,
    enabled: !!idToken, // Only run query if authenticated

    // Optimized caching configuration
    staleTime: 1000 * 60 * 3, // 3 minutes - sessions data is relatively stable
    gcTime: 1000 * 60 * 15, // 15 minutes - keep in cache for quick access
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: false, // Use cached data on mount if fresh

    // Placeholders for better UX during refetch
    placeholderData: (previousData) => previousData, // Keep showing old data while refetching
  })
}
