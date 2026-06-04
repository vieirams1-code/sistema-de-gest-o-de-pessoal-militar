## 2024-06-04 - React.memo custom equality comparator caveats
**Learning:** When using a custom equality function for `React.memo`, like checking only specific properties on a deeply nested object, it's critical to ensure *every single property* used by the component's render tree and its helper functions is explicitly checked. Missing one (like a nested property used in a utility function) causes the component to not re-render when that unseen property changes, resulting in stale UI state.
**Action:** Always verify every single property access (e.g. using `grep -o`) within the component and its imported utility functions before finalizing a custom equality comparator.
## 2024-06-04 - Promise.all Concurrency in React Hooks
**Learning:** Sequential async database calls inside synchronous-looking iteration (`for...of`) are a common pattern that unnecessarily stall frontend hook evaluations. This particular iteration was over at most 2 emails but fetched 3 endpoints each.
**Action:** When auditing custom hooks for performance, map iterables to arrays of `Promise.all` and then await the aggregated results to ensure full parallelism.
