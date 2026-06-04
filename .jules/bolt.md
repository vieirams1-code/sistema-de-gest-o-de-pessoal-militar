## 2024-06-04 - Parallelizing list fetches over delete operations
**Learning:** For database or API cleanup operations, read operations can be safely parallelized using Promise.all to improve throughput. However, applying the same parallelization to delete operations violates order dependency and can break foreign key constraints, cause deadlocks, or trigger API rate limits.
**Action:** Always maintain sequential execution for deletion logic unless specifically architected to handle concurrent deletions safely. Apply parallelization primarily to read paths.
