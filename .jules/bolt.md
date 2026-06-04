## 2024-06-04 - React.memo custom equality comparator caveats
**Learning:** When using a custom equality function for `React.memo`, like checking only specific properties on a deeply nested object, it's critical to ensure *every single property* used by the component's render tree and its helper functions is explicitly checked. Missing one (like a nested property used in a utility function) causes the component to not re-render when that unseen property changes, resulting in stale UI state.
**Action:** Always verify every single property access (e.g. using `grep -o`) within the component and its imported utility functions before finalizing a custom equality comparator.

## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40x speedups when batching mock 10ms queries.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exceptionally large datasets, batching/chunking should also be considered.

## 2025-02-12 - Parallelization of Entity Deletions
**Learning:** Sequential await loops for `listSafe` and `deleteSafe` create significant performance bottlenecks when iterating across multiple module types.
**Action:** When iterating over distinct but unrelated entity types, prefer aggregating all operations in parallel `Promise.all` batches. By mapping the items into a set of promises and returning identifiers on success, accurate state aggregation (like tracking successful deletions by entity) can be performed synchronously on the output of `Promise.all()`.
