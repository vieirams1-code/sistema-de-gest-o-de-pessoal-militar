## 2026-06-04 - [Parallelization of Database Updates]
**Learning:** Batching database updates using `Promise.all` or `Promise.allSettled` can significantly reduce latency in service operations, especially when dealing with N+1 patterns.
**Action:** Always identify loops containing sequential `await` calls for database operations and refactor them to use concurrent promise execution.
