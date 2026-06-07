## 2025-05-15 - [Memoization and Single-Pass Optimization in ArvoreLotacao]
**Learning:** String normalization (`normalize('NFD')`) and complex regex replacements are expensive when executed thousands of times in nested loops (like building a military hierarchy tree). Single-pass iterations are significantly faster than multiple specialized passes (filter, map, reduce) on large datasets.
**Action:** Always consider local Map-based memoization for normalization utilities and consolidate multiple array iterations into a single `for...of` loop when dealing with thousands of records.
