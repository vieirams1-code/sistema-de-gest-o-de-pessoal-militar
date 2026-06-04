## 2024-06-04 - React.memo custom equality comparator caveats
**Learning:** When using a custom equality function for `React.memo`, like checking only specific properties on a deeply nested object, it's critical to ensure *every single property* used by the component's render tree and its helper functions is explicitly checked. Missing one (like a nested property used in a utility function) causes the component to not re-render when that unseen property changes, resulting in stale UI state.
**Action:** Always verify every single property access (e.g. using `grep -o`) within the component and its imported utility functions before finalizing a custom equality comparator.

## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40x speedups when batching mock 10ms queries.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exceptionally large datasets, batching/chunking should also be considered.

## 2023-10-27 - [Concurrent Promise Mapping over Sequential Awaits in Lists]
**Learning:** For array iterations dealing with independent asynchronous calls like `gerarPendencia`, executing them sequentially using a `for...of` loop with `await` introduces significant wait time. Simulating 10ms per item over a dataset of 50 items proved concurrent execution to be roughly ~48x faster (513ms vs 10ms).
**Action:** When working on array data transformations where item operations do not share dependency, leverage `Promise.all` with `.map()` instead of loop-based `await` block. Always provide a benchmark using simulated data delays to evaluate execution improvement.
