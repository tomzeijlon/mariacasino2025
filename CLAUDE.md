# CLAUDE.md — Maria Casino (Julklappslek)

This file describes the codebase structure, development conventions, and workflows for AI assistants working in this repository.

---

## Project Overview

**Maria Casino** is a real-time Swedish Christmas gift-guessing game ("Julklappslek"). Players vote on who they think owns each gift package. The admin controls the game flow, and votes synchronize in real-time for all participants.

- **Language:** Swedish UI, English codebase
- **Stack:** React 18 + TypeScript + Vite + Supabase + Tailwind CSS + shadcn/ui
- **Deployment:** Lovable platform (git-based continuous deployment)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18.3, TypeScript 5.8 |
| Build | Vite 5.4 with SWC |
| Routing | React Router v6 |
| Backend | Supabase (PostgreSQL + real-time subscriptions) |
| Styling | Tailwind CSS 3.4, CSS variables |
| Components | shadcn/ui (Radix UI primitives) |
| State | React hooks + TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| DnD | dnd-kit |
| Toasts | Sonner |
| Icons | Lucide React |

---

## Directory Structure

```
/
├── src/
│   ├── components/         # Reusable React components
│   │   ├── ui/             # shadcn/ui primitives (do not manually edit)
│   │   ├── AdminPasswordGate.tsx
│   │   ├── NavLink.tsx
│   │   ├── ParticipantManager.tsx
│   │   ├── Snowfall.tsx
│   │   ├── SortableParticipant.tsx
│   │   ├── VoteChart.tsx
│   │   ├── VoteCountdown.tsx
│   │   ├── VoterNameGate.tsx
│   │   ├── VotingHistory.tsx
│   │   └── VotingPanel.tsx
│   ├── pages/              # Route-level page components
│   │   ├── Index.tsx       # Landing/home page
│   │   ├── Vote.tsx        # Voter interface
│   │   ├── Admin.tsx       # Admin dashboard
│   │   ├── GameSummary.tsx # End-of-game statistics
│   │   └── NotFound.tsx    # 404 fallback
│   ├── hooks/              # Custom React hooks (business logic lives here)
│   │   ├── useVoting.ts    # Core game logic — voting, sessions, participants
│   │   ├── useSoundEffects.ts
│   │   ├── use-toast.ts
│   │   └── use-mobile.tsx
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts   # Supabase client (reads from VITE_SUPABASE_* env vars)
│   │       └── types.ts    # Auto-generated DB types (do not manually edit)
│   ├── lib/
│   │   └── utils.ts        # cn() utility for Tailwind class merging
│   ├── App.tsx             # Root component with router setup
│   ├── main.tsx            # React DOM entry point
│   └── index.css           # Global styles + Tailwind directives
├── supabase/
│   ├── config.toml
│   └── migrations/         # SQL migration files
├── public/                 # Static assets
├── index.html              # App entry HTML (lang="sv")
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── components.json         # shadcn/ui config
```

---

## Development Commands

```bash
npm run dev       # Start dev server (localhost:8080)
npm run build     # Production build
npm run build:dev # Dev-mode build
npm run lint      # ESLint
npm run preview   # Preview production build
```

The dev server binds to `::` (all interfaces) on port **8080**.

---

## Environment Variables

Required in `.env` (never commit secrets):

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-jwt>
VITE_SUPABASE_PROJECT_ID=<project-id>
```

All variables are prefixed with `VITE_` to be exposed to the client bundle.

---

## Database Schema (Supabase/PostgreSQL)

### `participants`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | text | Participant display name |
| is_locked | boolean | True when correct owner confirmed |
| has_received_package | boolean | True after they've received their package |
| sort_order | integer | Display order in UI |
| last_voted_at | timestamptz | |
| created_at | timestamptz | |

### `voting_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| current_participant_id | UUID FK | Points to participants |
| is_active | boolean | |
| created_at | timestamptz | |

### `votes`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| session_id | UUID FK | Points to voting_sessions |
| voted_for_participant_id | UUID FK | Who the voter guessed |
| voter_token | text | localStorage-persisted client identifier |
| voter_name | text | Optional display name |
| created_at | timestamptz | |

### `voting_history`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| participant_id | UUID | Package holder during round |
| package_owner_id | UUID | Who actually owns it |
| original_package_owner_id | UUID | Track moves |
| locked_participant_id | UUID | Confirmed correct owner |
| results | JSONB | Vote count array |
| correct_voters | JSONB | Voter breakdown |
| move_count | integer | How many times the package moved |
| created_at | timestamptz | |

**Real-time:** All tables use Supabase Postgres Change subscriptions. Subscription cleanup is handled in `useVoting.ts` effect cleanups.

---

## Core Game Logic

All game state and mutations live in `src/hooks/useVoting.ts`. Key responsibilities:

- Fetch and subscribe to participants, sessions, and votes
- Cast, count, and display votes in real-time
- Lock participants (confirm correct owner)
- Advance to next participant / handle tiebreakers
- Track voting history and statistics
- Reset the entire game

**Do not duplicate game logic outside this hook.** Pages and components should consume `useVoting` and call its returned functions.

---

## Key Conventions

### File Naming
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` prefixed with `use`
- Utilities: `camelCase.ts`

### Imports
Use the `@/` alias for all src-relative imports:
```ts
import { cn } from "@/lib/utils";
import { useVoting } from "@/hooks/useVoting";
```

### Component Structure
```tsx
interface ComponentNameProps {
  propA: string;
  onAction: () => void;
}

const ComponentName = ({ propA, onAction }: ComponentNameProps) => {
  // hooks first
  // derived state
  // handlers
  // return JSX
};

export default ComponentName;
```

### TypeScript
- `strict: false` and `strictNullChecks: false` in tsconfig — the project tolerates loose typing
- Supabase types in `src/integrations/supabase/types.ts` are auto-generated; do not edit
- Prefer explicit interfaces over `type` aliases for component props

### Styling
- Use Tailwind utility classes as the primary styling mechanism
- Use the `cn()` helper from `@/lib/utils` when conditionally combining classes
- Custom theme tokens (defined in `tailwind.config.ts`):
  - Colors: `gold`, `burgundy`, `forest`, `cream`, `snow`
  - Fonts: `font-display` (Playfair Display), `font-sans` (Inter)
  - Animations: `float`, `pulse-glow`, `bar-grow`
- Dark mode uses the `class` strategy
- Glassmorphism patterns use `backdrop-blur` utilities

### State & Data Fetching
- Server state: TanStack Query (`useQuery`, `useMutation`) for external data
- Local/UI state: `useState`, `useReducer`
- Real-time: Supabase channel subscriptions inside `useEffect` with cleanup
- Persistence: `localStorage` for voter token, voter name, admin auth flag

### Admin Auth
- Password: stored hardcoded as `"kapacitans"` in `AdminPasswordGate.tsx`
- Auth state stored in `sessionStorage` — resets on tab close

### Notifications
Use `sonner` toast via:
```ts
import { toast } from "sonner";
toast.success("Message");
toast.error("Error message");
```

### shadcn/ui Components
- Components live in `src/components/ui/`
- Do not manually edit these files; use the shadcn CLI to add/update
- New shadcn components: `npx shadcn-ui@latest add <component>`

---

## Routing

Defined in `src/App.tsx` using React Router v6:

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Index` | Landing page |
| `/vote` | `Vote` | Voter interface |
| `/admin` | `Admin` | Admin dashboard (password gated) |
| `/game-summary` | `GameSummary` | Post-game statistics |
| `*` | `NotFound` | 404 fallback |

---

## Real-time Architecture

1. Supabase client initialized in `src/integrations/supabase/client.ts`
2. `useVoting.ts` sets up Postgres Change listeners for `participants`, `voting_sessions`, and `votes` tables
3. Changes from any client trigger re-renders across all connected browsers
4. Subscriptions are cleaned up when component unmounts

---

## No Test Infrastructure

This project has no test suite (no Jest, Vitest, Cypress, etc.). It was scaffolded via the Lovable platform. When adding tests, prefer Vitest (aligned with Vite).

---

## Deployment

- **Platform:** Lovable (https://lovable.dev)
- **Method:** Push to `master` branch → Lovable auto-deploys
- **Custom domain:** Configurable in Lovable project settings
- Do not push directly to `main` — use `master` or feature branches

---

## Things to Avoid

- Do not edit files in `src/components/ui/` manually — use shadcn CLI
- Do not edit `src/integrations/supabase/types.ts` — it is auto-generated
- Do not add game logic to page components — keep it in `useVoting.ts`
- Do not commit `.env` files with real credentials
- Do not hardcode strings in Swedish without confirming copy with the product owner
- Do not introduce new state management libraries without discussion — the current hooks + TanStack Query pattern is sufficient
