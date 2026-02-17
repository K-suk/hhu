# Architectural Decisions (ADR)

## ADR 1: Tech Stack
- **Decision**: Next.js (App Router) + Supabase.
- **Rationale**: Speed of development and native support for real-time features (Chat/Matching).

## ADR 2: Database & Transactions
- **Decision**: Use Supabase RPC (PL/pgSQL) for matching logic.
- **Rationale**: To ensure atomicity and prevent race conditions where one user is matched with multiple people simultaneously.

## ADR 3: Data Privacy
- **Decision**: Physical deletion of ephemeral data via pg_cron.
- **Rationale**: Aligns with the "ephemeral" nature of the app and minimizes data liability.

## ADR 4: Design System
- **Decision**: "Cyber-Academic" UI.
- **Rationale**: Blending UBC's academic environment with a neon-lit, nightlife aesthetic using Tailwind CSS.