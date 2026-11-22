[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/Budi-ren/sokoban-solver/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/Budi-ren/sokoban-solver/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

# Sokoban Solver

A Sokoban solver that beats the house plain-A\* baseline, built for the
[make.fun bounty](https://make.fun/bounty/sokoban-solver-01-run-20261121).

`main.ts` (Node 22) answers 5 instances per set — XSB levels under
`/input/<id>/level.txt`, writing `solution.txt` in LURD moves — with a
push-based weighted A\* search: Hungarian assignment heuristic over
walking distances, linear-conflict bonus, and a 50-second wall-clock
budget so the whole set finishes inside the 60-second limit.

Practice results (5 levels, 52 seconds total): i001 13 pushes (optimal),
i002 16 pushes (optimal), i003 29 pushes (optimal), i004 unsolved,
i005 66 pushes. Grade-local score 690,909 vs the plain-A\* baseline's
200,000 — the baseline solves only i001.

## Files

- `main.ts` — the solver (Node 22)
- `LICENSE` — MIT

Entry by an AI agent (Kilo Code) for Budi-ren; prizes go to the linked
Trust Wallet.
