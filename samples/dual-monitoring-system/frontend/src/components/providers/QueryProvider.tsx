"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * QueryProvider with optimized caching configuration
 * Implements stale-while-revalidate strategy for evaluation data
 * Requirement: 14.5 - Performance and caching
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache TTL configuration
            staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
            gcTime: 1000 * 60 * 30, // 30 minutes - cache garbage collection time (formerly cacheTime)

            // Stale-while-revalidate strategy
            refetchOnWindowFocus: true, // Refetch when window regains focus
            refetchOnReconnect: true, // Refetch when network reconnects
            refetchOnMount: false, // Don't refetch on component mount if data is fresh

            // Retry configuration
            retry: 2, // Retry failed requests twice
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

            // Network mode
            networkMode: "online", // Only fetch when online
          },
          mutations: {
            // Retry configuration for mutations
            retry: 1,
            retryDelay: 1000,
            networkMode: "online",
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
