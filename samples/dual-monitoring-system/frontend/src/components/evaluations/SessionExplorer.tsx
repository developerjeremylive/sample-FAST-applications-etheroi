"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "react-oidc-context"
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/loaders/LoadingSpinner"
import type { Session, SessionFilters, SessionListResponse } from "@/types/evaluation"
import { FilterBar } from "./FilterBar"
import { useInfiniteSessions } from "@/hooks/useInfiniteSessions"
import { ErrorDisplay } from "./ErrorDisplay"

interface SessionExplorerProps {
  onSessionSelect?: (sessionId: string) => void
}

/**
 * SessionExplorer Component with Virtual Scrolling
 * Implements virtualization for large datasets
 * Requirement: 14.3 - Performance optimization for large datasets
 */
export function SessionExplorer({ onSessionSelect }: SessionExplorerProps) {
  const router = useRouter()
  const auth = useAuth()
  const [filters, setFilters] = useState<SessionFilters>({})
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Ref for virtualization container
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Use infinite query hook for pagination
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteSessions(filters, auth.user?.id_token)

  // Flatten paginated data
  const sessions = useMemo(() => {
    return data?.pages.flatMap((page: SessionListResponse) => page.sessions) ?? []
  }, [data])

  // Define table columns
  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      {
        accessorKey: "sessionId",
        header: "Session ID",
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <span className="font-mono text-sm">{value.substring(0, 12)}...</span>
        },
      },
      {
        accessorKey: "timestamp",
        header: "Timestamp",
        cell: ({ getValue }) => {
          const value = getValue() as string
          try {
            return format(new Date(value), "MMM dd, yyyy HH:mm:ss")
          } catch {
            return value
          }
        },
        sortingFn: "datetime",
      },
      {
        accessorKey: "traceCount",
        header: "Traces",
        cell: ({ getValue }) => <span className="text-sm">{getValue() as number}</span>,
      },
      {
        accessorKey: "spanCount",
        header: "Spans",
        cell: ({ getValue }) => <span className="text-sm">{getValue() as number}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue() as string
          const statusColors: Record<string, string> = {
            completed: "bg-green-100 text-green-800",
            failed: "bg-red-100 text-red-800",
            in_progress: "bg-blue-100 text-blue-800",
          }
          const colorClass = statusColors[status] || "bg-gray-100 text-gray-800"

          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
              {status.replace("_", " ")}
            </span>
          )
        },
      },
    ],
    []
  )

  // Initialize table
  const table = useReactTable({
    data: sessions,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const { rows } = table.getRowModel()

  // Setup virtualizer for rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 10, // Number of items to render outside visible area
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0

  const handleRowClick = (session: Session) => {
    if (onSessionSelect) {
      onSessionSelect(session.sessionId)
    } else {
      // Use query parameter instead of dynamic route for static export compatibility
      router.push(`/evaluations?sessionId=${session.sessionId}`)
    }
  }

  const handleFilterChange = (newFilters: SessionFilters) => {
    setFilters(newFilters)
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        title="Session Loading Error"
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Added overflow-hidden */}
      {/* Filter Bar */}
      <FilterBar filters={filters} onChange={handleFilterChange} />

      {/* Table Card */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle>Evaluation Sessions</CardTitle>
          <CardDescription>
            Browse and filter agent evaluation sessions (virtualized for performance)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col">
          {isLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner message="Loading sessions..." />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>No sessions match the current filters</p>
              <Button onClick={() => setFilters({})} variant="outline" className="mt-4">
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={tableContainerRef}
                className="overflow-auto flex-1"
                style={{ contain: "strict" }}
              >
                <table className="w-full">
                  <thead className="sticky top-0 bg-white z-10">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-gray-200">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                          >
                            {header.isPlaceholder ? null : (
                              <div
                                className={
                                  header.column.getCanSort()
                                    ? "cursor-pointer select-none flex items-center gap-2"
                                    : ""
                                }
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getCanSort() && (
                                  <span className="text-gray-400">
                                    {{
                                      asc: "↑",
                                      desc: "↓",
                                    }[header.column.getIsSorted() as string] ?? "↕"}
                                  </span>
                                )}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {paddingTop > 0 && (
                      <tr>
                        <td style={{ height: `${paddingTop}px` }} />
                      </tr>
                    )}
                    {virtualRows.map((virtualRow: VirtualItem) => {
                      const row = rows[virtualRow.index]
                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleRowClick(row.original)}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          style={{ height: `${virtualRow.size}px` }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="py-3 px-4">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                    {paddingBottom > 0 && (
                      <tr>
                        <td style={{ height: `${paddingBottom}px` }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Load More Button */}
              {hasNextPage && (
                <div className="flex justify-center py-4 border-t border-gray-200">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    variant="outline"
                  >
                    {isFetchingNextPage ? "Loading..." : "Load More"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
