/**
 * Evaluation Data Types
 * TypeScript interfaces for evaluation dashboard data models
 * Matches backend Python dataclasses for API consistency
 */

export enum SessionStatus {
  COMPLETED = "completed",
  FAILED = "failed",
  IN_PROGRESS = "in_progress",
}

export interface Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  name: string
  startTime: string // ISO8601
  endTime: string // ISO8601
  durationMs: number
  attributes: Record<string, unknown>
  status: string
}

export interface Trace {
  traceId: string
  spans: Span[]
  startTime: string
  endTime: string
  durationMs: number
}

export interface EvaluationResult {
  evaluationId: string
  sessionId: string
  score: number
  criteria: Record<string, number>
  feedback?: string
  timestamp: string
}

export interface Session {
  sessionId: string
  timestamp: string
  traces: Trace[]
  evaluation?: EvaluationResult
  status: SessionStatus
  metadata: Record<string, unknown>
  score?: number
  traceCount: number
  spanCount: number
}

export interface SessionListResponse {
  sessions: Session[]
  nextToken?: string
  statistics: {
    totalSessions: number
    averageScore: number
  }
}

export interface SessionDetail extends Session {
  // Full session with all traces and spans
}

export interface Pattern {
  pattern: string
  frequency: number
  affectedSessions: string[]
  evidence: string
}

export interface AnalysisResult {
  analysisId: string
  patterns: Pattern[]
  summary: string
  recommendations: string[]
  timestamp: string
}

export interface PromptChange {
  section: string
  reasoning: string
  impact: string
}

export interface PromptImprovement {
  improvementId: string
  originalPrompt: string
  improvedPrompt: string
  changes: PromptChange[]
  timestamp: string
}

// Filter and query types
export interface SessionFilters {
  startDate?: Date
  endDate?: Date
  minScore?: number
  maxScore?: number
  searchQuery?: string
}

export interface SessionQueryParams {
  startDate?: string
  endDate?: string
  minScore?: number
  maxScore?: number
  limit?: number
  nextToken?: string
}

export interface AnalysisConfig {
  scoreThreshold: number
  limit: number
}

export interface PromptImprovementRequest {
  currentPrompt: string
  analysisId?: string
  scoreThreshold?: number
  limit?: number
}
