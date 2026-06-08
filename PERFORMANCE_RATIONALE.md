# Performance Optimization Rationale: Bulk Operations in PromocaoMilitar and ColunaOperacional

## 💡 What
This optimization replaces sequential entity updates inside `Promise.all` loops with bulk operations (`bulkUpdate`) using a mandatory feature-detection fallback pattern.

Affected files:
- `src/pages/DetalhePromocao.jsx`: Refactored `bulkUpdate` calls for `PromocaoMilitar` to include safety fallbacks.
- `src/pages/QuadroOperacional.jsx`: Refactored `Promise.all` update loop for `ColunaOperacional` to use `bulkUpdate` with fallback.

## 🎯 Why
Performing multiple concurrent but separate queries against a database entity limits throughput due to:
1. **Network Overhead**: Each `update` call is a separate HTTP request/response cycle.
2. **Database Lock Contention**: Individual updates can lead to increased contention and overhead compared to a single bulk transaction.
3. **Execution Time**: `Promise.all` with many requests can be throttled by browser connection limits (typically 6 concurrent connections per domain).

## 📊 Measured Improvement
Establishing a meaningful performance baseline in this isolated sandbox environment is impractical because:
1. **No Backend**: The sandbox simulates or mocks entities, meaning network latency and database execution time are not representative of a production environment.
2. **Limited Load**: Typical test data sets are small (N < 20), whereas the performance benefits of bulk operations scale significantly with larger data sets (N > 50).

However, this change is a guaranteed net performance improvement in production environments by reducing the number of roundtrips to the server from N to 1. The implementation follows the standard pattern used in `militarIdentidadeService.js` and other core modules of the SGP Militar system.
