"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { DashboardView } from "./DashboardView"
import { SessionExplorer } from "./SessionExplorer"
import { AnalysisPanel } from "./AnalysisPanel"
import { TraceViewer } from "./TraceViewer"
import { OnDemandEvaluation } from "./OnDemandEvaluation"
import { ErrorBoundary } from "./ErrorBoundary"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type ViewType = "dashboard" | "sessions" | "analysis" | "session-detail"

interface EvaluationsTabProps {
  // No props needed - uses global auth context
}

/**
 * EvaluationsTab Component
 * Main container for evaluation features with tab navigation
 * Requirements: 11.1, 11.4
 */
export function EvaluationsTab({}: EvaluationsTabProps) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<ViewType>("dashboard")
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const { isAuthenticated, signIn, signOut } = useAuth()

  // Authentication check - Requirement 11.1, 11.4
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-2xl text-gray-700">Authentication Required</p>
        <p className="text-gray-600">Please sign in to access evaluation features</p>
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    )
  }

  // Handle navigation to session detail view
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setActiveView("session-detail")
  }

  // Handle back navigation from session detail
  const handleBackToSessions = () => {
    setSelectedSessionId(null)
    setActiveView("sessions")
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header - consistent with ChatInterface */}
      <header className="flex items-center justify-between p-4 border-b w-full bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Evaluation Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            Chat
          </Button>
          <Button onClick={() => router.push("/devops-agent")} variant="outline">
            DevOps Agent
          </Button>
          {isAuthenticated && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Logout</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to log out? You will need to sign in again to access your
                    account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => signOut()}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      {activeView !== "session-detail" && (
        <div className="flex-none border-b border-gray-200 bg-white">
          <div className="flex gap-2 p-4">
            <TabButton
              active={activeView === "dashboard"}
              onClick={() => setActiveView("dashboard")}
            >
              Dashboard
            </TabButton>
            <TabButton active={activeView === "sessions"} onClick={() => setActiveView("sessions")}>
              Sessions
            </TabButton>
            <TabButton active={activeView === "analysis"} onClick={() => setActiveView("analysis")}>
              AI Analysis
            </TabButton>
          </div>
        </div>
      )}

      {/* View Content - Wrapped with ErrorBoundary for component error handling */}
      {/* Requirement 13.1, 13.2 - Error boundaries for component errors */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary>{activeView === "dashboard" && <DashboardView />}</ErrorBoundary>

        <ErrorBoundary>
          {activeView === "sessions" && <SessionExplorer onSessionSelect={handleSessionSelect} />}
        </ErrorBoundary>

        <ErrorBoundary>{activeView === "analysis" && <AnalysisPanel />}</ErrorBoundary>

        <ErrorBoundary>
          {activeView === "session-detail" && selectedSessionId && (
            <div className="flex flex-col h-full">
              {/* Back button */}
              <div className="flex-none p-4 border-b border-gray-200 bg-white">
                <Button variant="outline" onClick={handleBackToSessions}>
                  ← Back to Sessions
                </Button>
              </div>

              {/* Session detail content with trace viewer and on-demand evaluation */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left side: Trace viewer */}
                <div className="flex-1 overflow-hidden">
                  <TraceViewer sessionId={selectedSessionId} />
                </div>

                {/* Right side: On-demand evaluation */}
                <div className="w-96 border-l border-gray-200 overflow-y-auto p-4">
                  <OnDemandEvaluation sessionId={selectedSessionId} />
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-md font-medium transition-colors
        ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}
      `}
    >
      {children}
    </button>
  )
}
