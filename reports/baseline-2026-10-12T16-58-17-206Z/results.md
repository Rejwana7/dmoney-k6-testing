# DMoney results: PASS

Run: baseline-2026-10-12T16-58-17-206Z; planned workload: 120.00 seconds; observed: 120.31 seconds; post-response think time: 1s (capped at phase end).

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deposit | 87 | 1.45 | 0.72 | 44.50 | 59.41 | 109.27 | 0.00 | 0.00 | 100.00 |
| SendMoney | 87 | 0.97 | 0.72 | 44.63 | 61.19 | 124.23 | 0.00 | 0.00 | 100.00 |
| Payment | 203 | 1.69 | 1.69 | 41.05 | 61.36 | 122.41 | 0.00 | 0.00 | 100.00 |

## By time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p1 | 58 | 1.93 | 0.48 | 42.76 | 53.06 | 76.16 | 0.00 | 0.00 | 100.00 |
| p2 | 87 | 2.90 | 0.72 | 44.00 | 51.12 | 66.21 | 0.00 | 0.00 | 100.00 |
| p3 | 116 | 3.87 | 0.97 | 46.37 | 72.56 | 124.23 | 0.00 | 0.00 | 100.00 |
| p4 | 116 | 3.87 | 0.97 | 37.93 | 57.85 | 95.14 | 0.00 | 0.00 | 100.00 |

## API by time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SendMoney / p1 | 29 | 0.97 | 0.24 | 42.01 | 51.04 | 52.99 | 0.00 | 0.00 | 100.00 |
| Payment / p1 | 29 | 0.97 | 0.24 | 43.50 | 58.26 | 76.16 | 0.00 | 0.00 | 100.00 |
| SendMoney / p2 | 29 | 0.97 | 0.24 | 44.46 | 54.47 | 66.21 | 0.00 | 0.00 | 100.00 |
| Deposit / p2 | 29 | 0.97 | 0.24 | 43.39 | 50.31 | 51.29 | 0.00 | 0.00 | 100.00 |
| Payment / p2 | 29 | 0.97 | 0.24 | 44.14 | 53.71 | 55.99 | 0.00 | 0.00 | 100.00 |
| Deposit / p3 | 58 | 1.93 | 0.48 | 45.05 | 63.74 | 109.27 | 0.00 | 0.00 | 100.00 |
| SendMoney / p3 | 29 | 0.97 | 0.24 | 47.44 | 79.15 | 124.23 | 0.00 | 0.00 | 100.00 |
| Payment / p3 | 29 | 0.97 | 0.24 | 47.96 | 75.83 | 122.41 | 0.00 | 0.00 | 100.00 |
| Payment / p4 | 116 | 3.87 | 0.97 | 37.93 | 57.85 | 95.14 | 0.00 | 0.00 | 100.00 |

Thresholds: 111/111 passed.

- Deposit: p2 -> p3, p95 change 26.71%, throughput change 100.00% (29/58 samples).
- SendMoney: p1 -> p2, p95 change 6.71%, throughput change 0.00% (29/29 samples).
- SendMoney: p2 -> p3, p95 change 45.31%, throughput change 0.00% (29/29 samples).
- Payment: p1 -> p2, p95 change -7.80%, throughput change 0.00% (29/29 samples).
- Payment: p2 -> p3, p95 change 41.18%, throughput change 0.00% (29/29 samples).
- Payment: p3 -> p4, p95 change -23.71%, throughput change 300.00% (29/116 samples).

Failed thresholds:

None.

Limitations:

- Closed VU model: each response is followed by a one-second think time, capped at the phase boundary. Slower responses reduce throughput.
- Pacing differs from earlier start-to-start runs; changing pacing and indexes together cannot isolate an index effect.
- Customer limits were temporarily raised but remained active. See run-metadata.json for post-test restoration evidence; transfers and quota usage persist.
- NOT RUN means no transaction samples; INCOMPLETE means the planned workload was not fully observed. Neither is a performance pass.
- This two-minute local run is not a capacity benchmark; small API/phase samples limit tail-latency conclusions.
- API throughput uses active API seconds; whole-test throughput uses the full workload window.
- Authentication, provisioning and limit/balance preflight are excluded from transaction metrics.
- Database indexes were not changed; no indexed/no-index causal claim.
- Latency includes successful and failed responses; quick failures can make latency look better while reliability degrades.
