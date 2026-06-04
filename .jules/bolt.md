## 2024-06-04 - React.memo custom equality comparator caveats
**Learning:** When using a custom equality function for `React.memo`, like checking only specific properties on a deeply nested object, it's critical to ensure *every single property* used by the component's render tree and its helper functions is explicitly checked. Missing one (like a nested property used in a utility function) causes the component to not re-render when that unseen property changes, resulting in stale UI state.
**Action:** Always verify every single property access (e.g. using `grep -o`) within the component and its imported utility functions before finalizing a custom equality comparator.

## 2024-06-04 - Promise.all Concurrency in React Hooks
**Learning:** Sequential async database calls inside synchronous-looking iteration (`for...of`) are a common pattern that unnecessarily stall frontend hook evaluations. This particular iteration was over at most 2 emails but fetched 3 endpoints each.
**Action:** When auditing custom hooks for performance, map iterables to arrays of `Promise.all` and then await the aggregated results to ensure full parallelism.

## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40% time reductions by refactoring sequentially independent updates.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exclusively isolated mutations where order does not matter, consider background dispatches to unblock UI logic entirely.
