"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { SessionFilters } from "@/types/evaluation"

interface FilterBarProps {
  filters: SessionFilters
  onChange: (filters: SessionFilters) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [minScore, setMinScore] = useState<string>("")
  const [maxScore, setMaxScore] = useState<string>("")

  // Initialize local state from filters prop
  useEffect(() => {
    setStartDate(filters.startDate ? format(filters.startDate, "yyyy-MM-dd") : "")
    setEndDate(filters.endDate ? format(filters.endDate, "yyyy-MM-dd") : "")
    setMinScore(filters.minScore !== undefined ? String(filters.minScore) : "")
    setMaxScore(filters.maxScore !== undefined ? String(filters.maxScore) : "")
  }, [filters])

  const handleApplyFilters = () => {
    const newFilters: SessionFilters = {}

    if (startDate) {
      newFilters.startDate = new Date(startDate)
    }
    if (endDate) {
      newFilters.endDate = new Date(endDate)
    }
    if (minScore !== "") {
      const parsed = parseFloat(minScore)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        newFilters.minScore = parsed
      }
    }
    if (maxScore !== "") {
      const parsed = parseFloat(maxScore)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        newFilters.maxScore = parsed
      }
    }

    onChange(newFilters)
  }

  const handleClearFilters = () => {
    setStartDate("")
    setEndDate("")
    setMinScore("")
    setMaxScore("")
    onChange({})
  }

  const hasActiveFilters = startDate !== "" || endDate !== "" || minScore !== "" || maxScore !== ""

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date Filter */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Min Score Filter */}
          <div>
            <label htmlFor="minScore" className="block text-sm font-medium text-gray-700 mb-1">
              Min Score
            </label>
            <input
              id="minScore"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Score Filter */}
          <div>
            <label htmlFor="maxScore" className="block text-sm font-medium text-gray-700 mb-1">
              Max Score
            </label>
            <input
              id="maxScore"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              placeholder="1.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button onClick={handleApplyFilters} variant="default">
            Apply Filters
          </Button>
          {hasActiveFilters && (
            <Button onClick={handleClearFilters} variant="outline">
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
