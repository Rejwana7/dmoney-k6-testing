# DMoney results: FAIL

Run: baseline-2026-10-12T17-17-17-627Z; planned workload: 120.00 seconds; observed: 120.16 seconds; post-response think time: 1s (capped at phase end).

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Deposit | 90 | 1.50 | 0.75 | 28.40 | 44.86 | 49.43 | 0.00 | 0.00 | 100.00 |
| SendMoney | 90 | 1.00 | 0.75 | 27.56 | 37.77 | 49.92 | 1.11 | 1.11 | 98.89 |
| Payment | 210 | 1.75 | 1.75 | 24.65 | 40.69 | 53.61 | 0.00 | 0.00 | 100.00 |

## By time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| p1 | 60 | 2.00 | 0.50 | 25.84 | 37.78 | 43.74 | 0.00 | 0.00 | 100.00 |
| p2 | 90 | 3.00 | 0.75 | 28.36 | 44.40 | 50.69 | 0.00 | 0.00 | 100.00 |
| p3 | 120 | 4.00 | 1.00 | 28.73 | 44.86 | 53.61 | 0.83 | 0.83 | 99.17 |
| p4 | 120 | 4.00 | 1.00 | 22.20 | 30.17 | 52.57 | 0.00 | 0.00 | 100.00 |

## API by time window

| API / phase | Requests | req/s active | req/s full window | Avg ms | p95 ms | Max ms | HTTP fail % | Transaction fail % | Checks pass % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| SendMoney / p1 | 30 | 1.00 | 0.25 | 25.76 | 36.35 | 40.07 | 0.00 | 0.00 | 100.00 |
| Payment / p1 | 30 | 1.00 | 0.25 | 25.91 | 40.26 | 43.74 | 0.00 | 0.00 | 100.00 |
| SendMoney / p2 | 30 | 1.00 | 0.25 | 28.36 | 41.75 | 49.92 | 0.00 | 0.00 | 100.00 |
| Deposit / p2 | 30 | 1.00 | 0.25 | 28.10 | 43.53 | 49.43 | 0.00 | 0.00 | 100.00 |
| Payment / p2 | 30 | 1.00 | 0.25 | 28.62 | 43.83 | 50.69 | 0.00 | 0.00 | 100.00 |
| Deposit / p3 | 60 | 2.00 | 0.50 | 28.54 | 43.62 | 47.90 | 0.00 | 0.00 | 100.00 |
| SendMoney / p3 | 30 | 1.00 | 0.25 | 28.57 | 36.91 | 47.64 | 3.33 | 3.33 | 96.67 |
| Payment / p3 | 30 | 1.00 | 0.25 | 29.25 | 45.87 | 53.61 | 0.00 | 0.00 | 100.00 |
| Payment / p4 | 120 | 4.00 | 1.00 | 22.20 | 30.17 | 52.57 | 0.00 | 0.00 | 100.00 |

Thresholds: 103/111 passed.

- Deposit: p2 -> p3, p95 change 0.21%, throughput change 100.00% (30/60 samples).
- SendMoney: p1 -> p2, p95 change 14.88%, throughput change 0.00% (30/30 samples).
- SendMoney: p2 -> p3, p95 change -11.61%, throughput change 0.00% (30/30 samples).
- Payment: p1 -> p2, p95 change 8.88%, throughput change 0.00% (30/30 samples).
- Payment: p2 -> p3, p95 change 4.65%, throughput change 0.00% (30/30 samples).
- Payment: p3 -> p4, p95 change -34.22%, throughput change 300.00% (30/120 samples).

Failed thresholds:

- http_req_failed{api:SendMoney}: rate<0.01
- checks{api:SendMoney,kind:transaction}: rate>=0.99
- transaction_http_failed{api:SendMoney}: rate<0.01
- transaction_success{api:SendMoney}: rate>=0.99
- transaction_checks{api:SendMoney,phase:p3}: rate>=0.99
- transaction_http_failed{api:SendMoney,phase:p3}: rate<0.01
- transaction_success{api:SendMoney,phase:p3}: rate>=0.99
- transaction_checks{api:SendMoney}: rate>=0.99

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
