# Load test

Goal from the design: **1,000 phones in one lecture on one gateway, with the teacher dashboard lagging under 1.5 s.**

## 1. Install k6

Mac: `brew install k6` (other systems: https://grafana.com/docs/k6/latest/set-up/install-k6/).

## 2. Run it

1. Start the app (`pnpm dev`), sign in, create a lecture and open its live dashboard. Note the join code.
2. Press **Go live**.
3. In another terminal, from the project folder:

   ```bash
   k6 run -e CODE=YOURCODE loadtest/students.js
   ```

   Options: `-e STUDENTS=500` (default 1000), `-e MINUTES=3` (default 5), `-e GATEWAY=wss://your-gateway.up.railway.app` to test a deployed gateway.

4. Watch the dashboard while it runs. `http://localhost:4000/metrics` shows how many sockets the gateway holds.

## What "pass" means

k6 prints a summary at the end. The two lines that matter:

- `join_ok` above 99%: students could join.
- `react_ack_ms p(95)` under 500 ms: taps were accepted quickly.

And on the dashboard, the counters keep moving smoothly.

**On a laptop:** 1,000 sockets from k6 plus the app on the same Mac is a lot for one machine, so if numbers look bad locally, try `STUDENTS=300` first, or run k6 from a second computer. The real test is against the deployed gateway (see DEPLOY.md).

If you see `too many open files`, raise the limit first: `ulimit -n 10000`.

## Without k6

`pnpm simulate YOURCODE 300` runs a smaller, friendlier simulation with Node (students also ask, upvote and vote).
