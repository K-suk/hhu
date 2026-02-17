# Task Completion Checklist
- Run lint: `npm run lint`.
- If behavior changed, run app locally: `npm run dev` and verify affected route(s).
- If production behavior matters, ensure build succeeds: `npm run build`.
- Validate TypeScript errors indirectly via build/lint (no dedicated `typecheck` script defined).
- Review changed files for App Router conventions and consistent Tailwind/CSS usage.
- Confirm no unintended edits in unrelated files before finalizing (`git status`, `git diff`).