# Optimization Analysis - Medalhas Module

## Identified Inefficiencies

1. **O(N) Database Queries in Scoped Listings**:
   - Files: `src/services/medalhasAcessoService.js`
   - Functions: `listarMedalhasEscopo`, `listarImpedimentosEscopo`
   - Issue: For each military ID in scope, a separate concurrent query was fired using `Promise.all(militarIds.map(...))`.
   - Rationale: Consolidating these into 1 query using `{ in: ids }` significantly reduces network overhead.

2. **O(N) String Formatting in Reset Mutations**:
   - Files: `src/pages/ApuracaoMedalhasTempoServico.jsx`, `src/pages/IndicacoesDomPedroII.jsx`
   - Issue: `new Date().toLocaleDateString('pt-BR')` was called inside `payloads.map(...)`.
   - Rationale: The date is constant for the entire batch. Formatting it once outside the map avoids redundant CPU cycles.

3. **Inconsistent Bulk Update Patterns**:
   - Issue: Feature detection for `bulkUpdate` was duplicated across multiple pages.
   - Rationale: Centralizing this logic in a service layer improves maintainability and ensures the mandatory fallback pattern is always followed.

## Implemented Improvements

- **Bulk Filtering**: Refactored `listarMedalhasEscopo` and `listarImpedimentosEscopo` to use a single request with the `{ militar_id: { in: militarIds } }` filter.
- **Centralized Bulk Updates**: Created `bulkUpdateMedalhas` in `medalhasAcessoService.js` to handle the `bulkUpdate` vs `Promise.all` fallback logic centrally.
- **Micro-optimizations**: Moved date formatting outside batch loops in `ApuracaoMedalhasTempoServico.jsx` and `IndicacoesDomPedroII.jsx`.
- **Efficient Deduplication**: Improved `listarMilitaresEscopo` with O(1) deduplication using a Map instead of flattening and re-processing.

## Performance Impact

- **Scoped Listings**: Reduced from 1 + N requests to exactly 2 requests (1 for military personnel + 1 for their medal records).
- **Reset Payloads**: Reduced date formatting overhead from O(N) to O(1).
- **Update Operations**: Enforced `bulkUpdate` where available, reducing network round-trips for batch status changes.
