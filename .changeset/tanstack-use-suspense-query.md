---
"@hey-api/openapi-ts": minor
---

**plugin(@tanstack/react-query, @tanstack/preact-query)**: feat: add `useSuspenseQuery` hook generation

Opt in with `useSuspenseQuery: true` in your plugin config. Each query operation gets a `use{{name}}SuspenseQuery` hook that calls `useSuspenseQuery` with the operation's generated query options, the suspense counterpart of the `useQuery` hooks.
