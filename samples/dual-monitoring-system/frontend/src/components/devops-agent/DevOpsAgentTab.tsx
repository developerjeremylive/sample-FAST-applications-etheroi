"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useAuth as useOidcAuth } from "react-oidc-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export function DevOpsAgentTab() {
  const router = useRouter()
  const { isAuthenticated, signIn, signOut } = useAuth()
  const auth = useOidcAuth()

  const [incidentApiUrl, setIncidentApiUrl] = useState("")
  const [configError, setConfigError] = useState("")

  const [priority, setPriority] = useState("HIGH")
  const [title, setTitle] = useState("High CPU usage on production server")
  const [description, setDescription] = useState("High CPU usage on production server host ABC")
  const [awsAccountId, setAwsAccountId] = useState("849621233918")
  const [awsRegion, setAwsRegion] = useState("us-east-1")

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [lastIncidentId, setLastIncidentId] = useState("")
  const [webhookStatus, setWebhookStatus] = useState<number | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/aws-exports.json")
        if (!res.ok) throw new Error("Failed to fetch aws-exports.json")
        const config = await res.json()
        if (config.devopsIncidentApiUrl) {
          setIncidentApiUrl(config.devopsIncidentApiUrl)
        } else {
          setConfigError(
            "devopsIncidentApiUrl is missing from aws-exports.json. " +
              "Re-run deploy-frontend.py to pick up the new CDK output."
          )
        }
      } catch {
        setConfigError("Could not load configuration from aws-exports.json.")
      }
    }
    loadConfig()
  }, [])

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-2xl text-gray-700">Authentication Required</p>
        <p className="text-gray-600">Please sign in to access the DevOps Agent</p>
        <Button onClick={() => signIn()}>Sign In</Button>
      </div>
    )
  }

  const idToken = auth.user?.id_token ?? ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incidentApiUrl) {
      setSubmitError("Incident API URL is missing. Re-run deploy-frontend.py.")
      return
    }
    if (!idToken) {
      setSubmitError("Not authenticated. Please sign in again.")
      return
    }

    setSubmitting(true)
    setSubmitError("")
    setHasSubmitted(false)
    setWebhookStatus(null)
    setLastIncidentId("")

    try {
      const res = await fetch(`${incidentApiUrl}incident`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          priority,
          title,
          description: [
            description,
            awsAccountId && `AWS Account: ${awsAccountId}`,
            awsRegion && `Region: ${awsRegion}`,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error ?? `HTTP ${res.status}`)
        return
      }

      setWebhookStatus(data.webhookStatus ?? null)
      setLastIncidentId(data.incidentId ?? "")
      setHasSubmitted(true)

      if (data.webhookStatus !== undefined && data.webhookStatus >= 400) {
        setSubmitError(`Webhook returned HTTP ${data.webhookStatus}: ${data.webhookResponse ?? ""}`)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b w-full bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">DevOps Agent</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>
            Chat
          </Button>
          <Button variant="outline" onClick={() => router.push("/evaluations")}>
            Evaluations
          </Button>
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
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-1">Submit Incident to DevOps Agent</h2>
            <p className="text-sm text-gray-500">
              Sends an incident event to the AWS DevOps Agent Space via signed webhook.
            </p>
          </div>

          {configError && (
            <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800 rounded">
              {configError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">LOW</SelectItem>
                  <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                  <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the incident"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of the incident"
                className="min-h-[120px]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">AWS Account Number</label>
                <Input
                  value={awsAccountId}
                  onChange={(e) => setAwsAccountId(e.target.value)}
                  placeholder="123456789012"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Region</label>
                <Input
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Invoking DevOps Agent..." : "Invoke DevOps Agent"}
            </Button>
          </form>

          {submitError && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-800 rounded">
              {submitError}
            </div>
          )}

          {hasSubmitted && !submitError && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded p-4">
              <p className="text-sm font-medium text-green-800">
                Incident submitted — webhook HTTP {webhookStatus}
              </p>
              {lastIncidentId && (
                <p className="text-xs text-green-600 mt-0.5">Incident ID: {lastIncidentId}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
