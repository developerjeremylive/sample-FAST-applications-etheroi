# Evaluation Dashboard Components

This directory contains the frontend components for the AgentCore Evaluation Dashboard.

## Components

### DashboardView
Main dashboard component that displays evaluation statistics and recent sessions.

**Features:**
- Statistics cards showing total sessions, average score, low/high score counts
- Score distribution chart
- Recent sessions table
- Loading and error states
- Automatic data fetching on mount

**Requirements Satisfied:**
- 3.1: Display overview statistics
- 3.3: Loading indicators
- 3.4: Empty state handling

### ScoreDistributionChart
Bar chart visualization of evaluation score distribution using recharts.

**Features:**
- Histogram with 5 score range bins (0.0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0)
- Color-coded bars (red for low, amber for medium, green for high scores)
- Interactive tooltips on hover
- Empty state handling

**Requirements Satisfied:**
- 6.1: Histogram visualization
- 6.3: Tooltip with detailed information
- 6.5: Empty data state message

### RecentSessionsTable
Table displaying recent evaluation sessions with key metrics.

**Features:**
- Displays session ID, timestamp, score, trace count, span count, and status
- Color-coded scores (red < 0.5, amber < 0.8, green >= 0.8)
- Status badges with appropriate colors
- Click handler for navigation to session detail
- Empty state handling

**Requirements Satisfied:**
- 3.1: Display recent sessions with key metrics
- Navigation to session detail on click

## Usage

```typescript
import { DashboardView } from '@/components/evaluations'

// In your page or component
<DashboardView />
```

## Dependencies

- recharts: Chart visualization library
- react-oidc-context: Authentication
- @/services/evaluationService: API service layer
- @/types/evaluation: TypeScript type definitions
- @/components/ui: shadcn/ui components (Card, Button, etc.)
- @/components/loaders: Loading spinner component

## Implementation Notes

1. All components follow the existing application patterns for styling (Tailwind CSS)
2. Uses shadcn/ui components for consistency
3. Implements proper error handling and loading states
4. TypeScript strict mode compatible
5. Responsive design with mobile support
