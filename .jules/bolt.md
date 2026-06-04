## 2024-06-04 - Optimize Historico Comportamento N+1 Queries
**Learning:** Sequential `await` in loops for database updates causes severe N+1 latency, particularly observable during batch enrichments. We can observe up to 40x speedups when batching mock 10ms queries.
**Action:** Use Promise accumulation (`Array.push(promise.catch(e => ...))`) and `Promise.allSettled()` / `Promise.all()` to resolve updates concurrently. For exceptionally large datasets, batching/chunking should also be considered.
## 2023-10-27 - Parallelized Entity Fetching

**Learning:** When executing multiple independent operations sequentially in a loop (like fetching or updating different unrelated entities), execution time can grow linearly with the number of entities due to repeated network/DB latencies.
**Action:** Replace `for...of` loops containing independent async operations with `await Promise.all(array.map(async item => { ... }))` to parallelize requests and significantly reduce overall latency.

## 2026-06-04 - Parallelized Principal Status Updates in MilitarFuncao
**Learning:** Sequential updates in a loop for database writes (e.g., clearing the "principal" flag for multiple records) introduce unnecessary N+1 latency. Parallelizing with `Promise.all` achieved ~90% latency reduction in benchmarks for 10 items.
**Action:** Always favor `Promise.all` or `Promise.allSettled` for batch updates of independent records in backend functions to minimize total I/O wait time.
