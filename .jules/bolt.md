## 2024-06-04 - React.memo custom equality comparator caveats
**Learning:** When using a custom equality function for `React.memo`, like checking only specific properties on a deeply nested object, it's critical to ensure *every single property* used by the component's render tree and its helper functions is explicitly checked. Missing one (like a nested property used in a utility function) causes the component to not re-render when that unseen property changes, resulting in stale UI state.
**Action:** Always verify every single property access (e.g. using `grep -o`) within the component and its imported utility functions before finalizing a custom equality comparator.
## 2024-05-18 - Promise.all Optimization
**Learning:** Sequential database updates using `for...await` loops can cause severe N+1 write bottlenecks, especially in serverless functions (like Deno Edge Functions).
**Action:** When updating multiple unrelated entities based on a condition, always use `Promise.all` with `Array.prototype.map` to trigger the updates concurrently. This reduces network roundtrips to O(1) in terms of overall latency wait time.
