# DMoney assignment plan

Code preparation only. Do not execute seed, performance load, or database writes.

1. Reuse the existing DMoney APIs and six saved dedicated test identities.
2. Keep all 13 explicit constant-VU scenarios in `dmoney-transaction.js`.
   Four concurrent windows: 0-30, 30-60, 60-90 and 90-120 seconds.
   Wait one second after each response, capped at phase end. Keep this pacing
   identical between index-comparison runs; earlier start-to-start runs differ.
3. Authenticate each account with its own credentials; keep credentials untracked.
4. Reuse API-based seed/funding. Do not reset passwords, bypass ledger validation,
   delete data, change indexes/schema automatically, or replace existing accounts blindly.
5. Normal `npm run perf` respects existing limits and preflights account history.
6. Optional `npm run perf -- --temporary-limits` requires explicit interactive
   confirmation that all other traffic is stopped or the local DB is disposable.
   Back up only the Customer daily/monthly rules, raise max_count to at least 10000
   and max_amount to at least 1000000, and leave is_active unchanged. Restrict DB
   operations to local dmoneydb using the actual running backend's configuration.
7. Restore and verify original settings in finally after success/failure/handled
   interruption. Keep backup and recovery command for force-kill or DB outage.
   Refuse concurrent adjustments and refuse overwriting unrelated rule edits.
8. Compare latency, p95, throughput, failures and checks by API and phase.
   Require failure rate <1%, p95 <1000ms and checks >=99%, globally and per API.
   Zero samples must report NOT RUN / N/A, never a performance pass.
9. Document the two ordinary commands and optional recovery clearly. Preserve
   existing credential files and reports. New results/screenshots/publication
   require a separately executed run and cannot be fabricated.
10. Provide explicit index:check/add/drop commands for Transactions(account).
    Never drop PRIMARY, application indexes or unowned indexes. Persist helper
    ownership locally. Do not execute index changes during code preparation.
11. Provide perf:without-index and perf:with-index commands with verified account
    index state, separate named reports and before/after index/ledger metadata.
    Keep the same workload/pacing. Limits restore independently; indexes persist
    until explicitly dropped. Without matching DB snapshots, comparisons are
    observational because balances/history/quota change across runs.

Restoring limits is not restoring balances, usage or transaction records.
All Customer accounts share these rules; separate test accounts do not isolate
the database. A separate test DB is safest. On the existing local DB, the operator
must pause other traffic and explicitly confirm before any temporary adjustment.
