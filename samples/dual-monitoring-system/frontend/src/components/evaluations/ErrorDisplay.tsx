"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, RefreshCw, Home } from "lucide-react"
import { useRouter } from "next/navigation"

interface ErrorDisplayProps {
  error: Error | string
  title?: string
  description?: string
  onRetry?: () => void
  showHomeButton?: boolean
}

/**
 * ErrorDisplay Component
 * Displays user-friendly error messages with retry functionality
 * Requirements: 13.1, 13.2, 13.3 - Display errors with retry options
 */
export function ErrorDisplay({
  error,
  title = "Error",
  description,
  onRetry,
  showHomeButton = false,
}: ErrorDisplayProps) {
  const router = useRouter()
  const errorMessage = typeof error === "string" ? error : error.message

  // Determine error type and provide helpful guidance
  const getErrorGuidance = (message: string): string => {
    if (message.includes("Authentication required") || message.includes("401")) {
      return "Please sign in to access this feature."
    }
    if (message.includes("Network") || message.includes("fetch")) {
      return "Please check your internet connection and try again."
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return "Too many requests. Please wait a moment and try again."
    }
    if (message.includes("timeout") || message.includes("504")) {
      return "The request took too long. Please try again."
    }
    if (message.includes("500") || message.includes("Internal Server Error")) {
      return "A server error occurred. Please try again later."
    }
    return "An unexpected error occurred. Please try again."
  }

  const guidance = description || getErrorGuidance(errorMessage)

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{guidance}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{errorMessage}</p>
          </div>

          <div className="flex gap-2">
            {onRetry && (
              <Button onClick={onRetry} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            {showHomeButton && (
              <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Inline error display for smaller error messages
 */
export function InlineError({ error, onRetry }: { error: Error | string; onRetry?: () => void }) {
  const errorMessage = typeof error === "string" ? error : error.message

  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-red-800">{errorMessage}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  )
}
