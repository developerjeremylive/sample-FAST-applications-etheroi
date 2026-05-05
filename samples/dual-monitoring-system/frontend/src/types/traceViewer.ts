/**
 * Trace Viewer Types
 * Shared types for trace visualization components
 */

import type { Span } from "./evaluation"

export interface SpanNode {
  span: Span
  children: SpanNode[]
  depth: number
  lane: number
}
