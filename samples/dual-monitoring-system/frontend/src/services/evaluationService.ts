/**
 * Evaluation Service
 * Handles API calls for evaluation dashboard features
 * Provides methods for querying sessions, triggering AI analysis, and generating prompt improvements
 */

import type {
  SessionListResponse,
  SessionDetail,
  SessionQueryParams,
  AnalysisConfig,
  AnalysisResult,
  PromptImprovementRequest,
  PromptImprovement,
} from "@/types/evaluation"

// Load API URL from aws-exports.json
let EVALUATION_API_URL = ""

function validateApiUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid API URL: ${url}`)
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`API URL must use HTTPS, got: ${parsed.protocol}`)
  }

  const hostname = parsed.hostname.toLowerCase()

  const blockedPatterns = [
    /^127\./,
    /^localhost$/,
    /^10\./,
    /^0\.0\.0\.0/,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ]

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error(`Blocked internal address: ${hostname}`)
    }
  }

  const allowedPatterns = [/\.execute-api\.[a-z0-9-]+\.amazonaws\.com$/, /\.amazonaws\.com$/]

  if (!allowedPatterns.some((p) => p.test(hostname))) {
    throw new Error(`API hostname not in allowlist: ${hostname}`)
  }

  return url
}

export function sanitizePathParam(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9\-_]/g, "")
  if (sanitized !== value) {
    throw new Error(`Invalid path parameter: ${value}`)
  }
  return sanitized
}

/**
 * Dynamically load the API URL from aws-exports.json
 */
async function loadApiUrl(): Promise<string> {
  if (EVALUATION_API_URL) {
    return EVALUATION_API_URL
  }

  try {
    const response = await fetch("/aws-exports.json")
    const config = await response.json()

    let baseUrl = ""
    if (config.evaluationApiUrl) {
      baseUrl = config.evaluationApiUrl
    } else if (config.feedbackApiUrl) {
      baseUrl = config.feedbackApiUrl
    } else {
      throw new Error("No API URL found in aws-exports.json")
    }

    baseUrl = validateApiUrl(baseUrl) // ✅ only new line added
    baseUrl = baseUrl.replace(/\/$/, "")
    EVALUATION_API_URL = `${baseUrl}/evaluations`

    return EVALUATION_API_URL
  } catch (error) {
    console.error("Failed to load API URL from aws-exports.json:", error)
    throw new Error("Evaluation API URL not configured")
  }
}

/**
 * Handle authentication errors by redirecting to login
 * Requirement 11.4 - Redirect to login on 401 responses
 */
function handleAuthError(response: Response): void {
  if (response.status === 401) {
    // Store current path for redirect after login
    if (typeof window !== "undefined") {
      sessionStorage.setItem("redirectAfterLogin", window.location.pathname)
      // Trigger sign in redirect
      window.location.href = "/"
    }
  }
}

/**
 * List evaluation sessions with optional filtering
 *
 * @param params - Query parameters for filtering and pagination
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with session list response
 */

export async function listSessions(params: SessionQueryParams, idToken: string): Promise {
  try {
    const apiUrl = await loadApiUrl()

    // ✅ Build URL using URL object with searchParams (no template literal + URLSearchParams)
    const requestUrl = new URL(`${apiUrl}/sessions`)

    Object.entries(params)
      .filter(([_k, v]) => v !== undefined && v !== null)
      .forEach(([k, v]) => {
        const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase()
        requestUrl.searchParams.set(snakeKey, String(v))
      })

    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch sessions: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching sessions:", error)
    throw error
  }
}

/**
 * Get detailed session data including all traces and spans
 *
 * @param sessionId - Session ID to retrieve
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with session detail
 */
export async function getSession(sessionId: string, idToken: string): Promise<SessionDetail> {
  try {
    const apiUrl = await loadApiUrl()
    const safeSessionId = sanitizePathParam(sessionId)

    const requestUrl = new URL(`${apiUrl}/sessions/${safeSessionId}`)
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      // Handle 401 authentication errors - Requirement 11.4
      handleAuthError(response)

      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch session: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching session:", error)
    throw error
  }
}

/**
 * Trigger AI analysis of low-scoring sessions (Async)
 *
 * @param config - Analysis configuration (score threshold and limit)
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with job ID for polling
 */
export async function analyzeSessions(
  config: AnalysisConfig,
  idToken: string
): Promise<{ jobId: string; status: string; message: string }> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      // Handle 401 authentication errors - Requirement 11.4
      handleAuthError(response)

      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Analysis failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error analyzing sessions:", error)
    throw error
  }
}

/**
 * Get analysis job status and results
 *
 * @param jobId - Analysis job ID
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with job status and results
 */
export async function getAnalysisStatus(
  jobId: string,
  idToken: string
): Promise<Record<string, unknown>> {
  try {
    const apiUrl = await loadApiUrl()
    const safeJobId = sanitizePathParam(jobId)
    // Add timestamp to prevent caching
    const requestUrl = new URL(`${apiUrl}/analyze/${safeJobId}`)
    requestUrl.searchParams.set("_t", Date.now().toString())
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get analysis status: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting analysis status:", error)
    throw error
  }
}

/**
 * Generate prompt improvements based on analysis results
 *
 * @param request - Prompt improvement request with current prompt and optional analysis ID
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with job ID and status
 */
export async function improvePrompt(
  request: PromptImprovementRequest,
  idToken: string
): Promise<{ jobId: string; status: string; message: string }> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/improve-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      // Handle 401 authentication errors - Requirement 11.4
      handleAuthError(response)

      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Prompt improvement failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error improving prompt:", error)
    throw error
  }
}

/**
 * Get status of prompt improvement job
 *
 * @param jobId - Job ID returned from improvePrompt
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with job status and results if complete
 */
export async function getPromptImprovementStatus(
  jobId: string,
  idToken: string
): Promise<{
  jobId: string
  status: string
  createdAt: string
  updatedAt: string
  result?: PromptImprovement
  error?: string
}> {
  try {
    const apiUrl = await loadApiUrl()
    const safeJobId = sanitizePathParam(jobId)
    const requestUrl = new URL(`${apiUrl}/improve-prompt/status/${safeJobId}`)
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      // Handle 401 authentication errors
      handleAuthError(response)

      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || `Failed to get prompt improvement status: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting prompt improvement status:", error)
    throw error
  }
}

/**
 * EvaluationService class for managing evaluation API calls
 * Provides a class-based interface for evaluation operations
 */
export class EvaluationService {
  private apiUrl: string | null = null

  /**
   * Initialize the service and load API URL
   */
  async initialize(): Promise<void> {
    this.apiUrl = await loadApiUrl()
  }

  /**
   * Get the API URL, loading it if necessary
   */
  private async getApiUrl(): Promise<string> {
    if (!this.apiUrl) {
      this.apiUrl = await loadApiUrl()
    }
    return this.apiUrl
  }

  /**
   * List evaluation sessions with optional filtering
   */
  async listSessions(params: SessionQueryParams, idToken: string): Promise<SessionListResponse> {
    return listSessions(params, idToken)
  }

  /**
   * Get detailed session data
   */
  async getSession(sessionId: string, idToken: string): Promise<SessionDetail> {
    return getSession(sessionId, idToken)
  }

  /**
   * Trigger AI analysis of sessions
   */
  async analyzeSessions(config: AnalysisConfig, idToken: string): Promise<AnalysisResult> {
    return analyzeSessions(config, idToken)
  }

  /**
   * Generate prompt improvements
   */
  async improvePrompt(
    request: PromptImprovementRequest,
    idToken: string
  ): Promise<PromptImprovement> {
    return improvePrompt(request, idToken)
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService()

/**
 * Setup AgentCore online evaluation with default evaluators
 *
 * @param config - Setup configuration (optional)
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with setup result
 */
export async function setupEvaluation(
  config: { configName?: string; samplingRate?: number; enableOnCreate?: boolean },
  idToken: string
): Promise<Record<string, unknown>> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Setup failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error setting up evaluation:", error)
    throw error
  }
}

/**
 * Get AgentCore evaluation metrics
 *
 * @param configId - Evaluation configuration ID
 * @param params - Query parameters (start_date, end_date)
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with evaluation metrics
 */
export async function getEvaluationMetrics(
  configId: string,
  params: { start_date?: string; end_date?: string },
  idToken: string
): Promise<Record<string, unknown>> {
  try {
    // Validate config ID before making the request
    if (!configId || configId.trim() === "") {
      throw new Error("Config ID is required to fetch evaluation metrics")
    }

    const safeConfigId = sanitizePathParam(configId)
    const apiUrl = await loadApiUrl()

    const requestUrl = new URL(`${apiUrl}/metrics`)
    requestUrl.searchParams.set("config_id", safeConfigId)
    requestUrl.searchParams.set("_t", Date.now().toString())
    Object.entries(params)
      .filter(([_k, v]) => v !== undefined && v !== null)
      .forEach(([k, v]) => requestUrl.searchParams.set(k, String(v)))
    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch metrics: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching evaluation metrics:", error)
    throw error
  }
}

/**
 * List all online evaluation configurations
 *
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with list of configurations
 */
export async function listEvaluationConfigs(idToken: string): Promise<Record<string, unknown>> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/configs`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch configs: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching evaluation configs:", error)
    throw error
  }
}

/**
 * List all available evaluators (built-in and custom)
 *
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with list of evaluators
 */
export async function listEvaluators(idToken: string): Promise<Record<string, unknown>> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/evaluators`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch evaluators: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching evaluators:", error)
    throw error
  }
}

/**
 * Run on-demand evaluation on a specific session
 *
 * @param sessionId - Session ID to evaluate
 * @param evaluatorId - Evaluator ID to use
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with evaluation results
 */
export async function evaluateSession(
  sessionId: string,
  evaluatorId: string,
  idToken: string
): Promise<Record<string, unknown>> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        sessionId,
        evaluatorId,
      }),
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Evaluation failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error evaluating session:", error)
    throw error
  }
}

/**
 * Run batch evaluation on multiple sessions with multiple evaluators
 *
 * @param sessionIds - List of session IDs to evaluate
 * @param evaluatorIds - List of evaluator IDs to use
 * @param idToken - Cognito ID token for authentication
 * @returns Promise with batch evaluation results
 */
export async function evaluateBatch(
  sessionIds: string[],
  evaluatorIds: string[],
  idToken: string
): Promise<Record<string, unknown>> {
  try {
    const apiUrl = await loadApiUrl()

    const response = await fetch(`${apiUrl}/evaluate-batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        sessionIds,
        evaluatorIds,
      }),
    })

    if (!response.ok) {
      handleAuthError(response)
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Batch evaluation failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error running batch evaluation:", error)
    throw error
  }
}
