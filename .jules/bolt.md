## 2024-06-04 - Promise.all Optimization for Sequential Network Calls
**Learning:** Sequential network calls inside a loop can be a major bottleneck. By converting the loop to `Promise.all` combined with `.map`, concurrent network requests execute significantly faster.
**Action:** Identify `for` loops making `await` calls on network functions and replace them with `Promise.all(array.map(async () => ...))` for concurrent execution when requests are independent.
