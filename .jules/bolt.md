## 2024-06-04 - React.memo custom equality comparator caveats
**Learning:** When using a custom equality function for `React.memo`, like checking only specific properties on a deeply nested object, it's critical to ensure *every single property* used by the component's render tree and its helper functions is explicitly checked. Missing one (like a nested property used in a utility function) causes the component to not re-render when that unseen property changes, resulting in stale UI state.
**Action:** Always verify every single property access (e.g. using `grep -o`) within the component and its imported utility functions before finalizing a custom equality comparator.

## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40x speedups when batching mock 10ms queries.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exceptionally large datasets, batching/chunking should also be considered.

## 2024-05-18 - Promise.all Optimization
**Learning:** Sequential database updates using `for...await` loops can cause severe N+1 write bottlenecks, especially in serverless functions (like Deno Edge Functions).
**Action:** When updating multiple unrelated entities based on a condition, always use `Promise.all` with `Array.prototype.map` to trigger the updates concurrently. This reduces network roundtrips to O(1) in terms of overall latency wait time.
