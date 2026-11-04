<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Frontend only: all data comes from the user's own REST backend via `src/lib/api/*` (base URL `VITE_API_URL`); contract documented in `docs/API.md`. Why: the user builds the backend themselves.
- Authenticated pages live under `src/routes/_authenticated.*` with `ssr: false` because the auth token is stored in the browser.
- Role → page access is defined once in `src/lib/permissions.ts` (NAV); input rules from the spec live in `src/lib/validation.ts`, covered by `src/test/regles.test.ts`.
