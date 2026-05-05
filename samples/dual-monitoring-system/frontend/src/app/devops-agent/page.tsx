"use client"

import { DevOpsAgentTab } from "@/components/devops-agent/DevOpsAgentTab"
import { GlobalContextProvider } from "@/app/context/GlobalContext"

export default function DevOpsAgentPage() {
  return (
    <GlobalContextProvider>
      <div className="relative h-screen">
        <DevOpsAgentTab />
      </div>
    </GlobalContextProvider>
  )
}
