import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WEIGHT = 15;
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const DIRS: [number, number, string][] = [
  [0, -1, 'u'],
  [0, 1, 'd'],
  [-1, 0, 'l'],
  [1, 0, 'r'],
];

// Wall-clock budget for the whole run: the entry must solve all 5 levels
// in one run of at most 60 s, so stop searching after 50 s and return
// an empty solution for any level not finished by then.
const T0 = Date.now();
const TIME_BUDGET_MS = 50000;

function hungarian(cost: number[][]): number {
  const n = cost.length;
  if (n === 0) return 0;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  let total = 0;
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) total += cost[p[j] - 1][j - 1];
  }
  return total;
}

function solve(text: string): string {
  process.stderr.write('solve called\n');
  let freezeHits = 0;
  const rows = text.split('\n').filter((r) => r.length > 0);
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const size = w * h;
  const wall = new Uint8Array(size).fill(1);
  const goal = new Uint8Array(size);
  const goals: number[] = [];
  let boxes: number[] = [];
  let player = 0;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = x < row.length ? row[x] : '#';
      const i = y * w + x;
      if (ch === '#') { wall[i] = 1; continue; }
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') { goal[i] = 1; goals.push(i); }
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  boxes.sort((a, b) => a - b);
  goals.sort((a, b) => a - b);
  process.stderr.write('boxes='+boxes.length+' goals='+goals.length+' player='+player+'\n');

  // walking distance from each goal over static walls (ignores boxes)
  const goalDist: number[][] = goals.map((g) => {
    const dist = new Array(size).fill(1e9);
    const q: number[] = [g];
    dist[g] = 0;
    let qi = 0;
    while (qi < q.length) {
      const cur = q[qi++]!;
      const x = cur % w;
      const y = Math.floor(cur / w);
      const nd = dist[cur] + 1;
      // neighbors
      const cand = [cur - w, cur + w, cur - 1, cur + 1];
      // careful with row boundaries; check x
      // up
      if (y > 0) {
        const ni = cur - w;
        if (wall[ni] === 0 && dist[ni] > nd) { dist[ni] = nd; q.push(ni); }
      }
      if (y < h - 1) {
        const ni = cur + w;
        if (wall[ni] === 0 && dist[ni] > nd) { dist[ni] = nd; q.push(ni); }
      }
      if (x > 0) {
        const ni = cur - 1;
        if (wall[ni] === 0 && dist[ni] > nd) { dist[ni] = nd; q.push(ni); }
      }
      if (x < w - 1) {
        const ni = cur + 1;
        if (wall[ni] === 0 && dist[ni] > nd) { dist[ni] = nd; q.push(ni); }
      }
    }
    return dist;
  });

  const hasDeadlock = (bs: number[]): boolean => {
    const boxSet = new Uint8Array(size);
    for (const b of bs) boxSet[b] = 1;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i]!;
      if (goal[b]) continue;
      const x = b % w;
      const y = Math.floor(b / w);
      const up = y === 0 || wall[b - w] === 1;
      const down = y === h - 1 || wall[b + w] === 1;
      const left = x === 0 || wall[b - 1] === 1;
      const right = x === w - 1 || wall[b + 1] === 1;
      if ((up && left) || (up && right) || (down && left) || (down && right)) return true;
    }
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const cells = [y * w + x, y * w + x + 1, (y + 1) * w + x, (y + 1) * w + x + 1];
        let hasBox = false;
        let allBlocked = true;
        let hasGoal = false;
        for (const c of cells) {
          if (goal[c]) { hasGoal = true; break; }
          const isBox = boxSet[c] === 1;
          const isWall = wall[c] === 1;
          if (isBox) hasBox = true;
          if (!isBox && !isWall) { allBlocked = false; break; }
        }
        if (hasGoal) continue;
        if (!allBlocked) continue;
        if (!hasBox) continue;
        return true;
      }
    }
    // freeze deadlock (linear)
    const wallInDir = (idx: number, dir: number): boolean => {
      const x = idx % w, y = Math.floor(idx / w);
      if (dir === 0) return y === 0 || wall[idx - w] === 1;
      if (dir === 1) return y === h - 1 || wall[idx + w] === 1;
      if (dir === 2) return x === 0 || wall[idx - 1] === 1;
      return x === w - 1 || wall[idx + 1] === 1;
    };
    for (const b of bs) {
      if (goal[b]) continue;
      for (const wd of [0, 1, 2, 3]) {
        if (!wallInDir(b, wd)) continue;
        const horizontal = wd === 0 || wd === 1;
        const x0 = b % w, y0 = Math.floor(b / w);
        let l = 0, r = 0, leftHard = false, rightHard = false;
        if (horizontal) {
          l = x0; r = x0;
          while (l > 0) {
            const ni = y0 * w + (l - 1);
            if (wall[ni] === 1) { leftHard = true; break; }
            if (!wallInDir(ni, wd)) break;
            l--;
          }
          if (l === 0) leftHard = true;
          while (r < w - 1) {
            const ni = y0 * w + (r + 1);
            if (wall[ni] === 1) { rightHard = true; break; }
            if (!wallInDir(ni, wd)) break;
            r++;
          }
          if (r === w - 1) rightHard = true;
          if (!leftHard || !rightHard) continue;
          let hasGoal = false;
          for (let xx = l; xx <= r; xx++) {
            if (goal[y0 * w + xx]) { hasGoal = true; break; }
          }
          if (!hasGoal) { freezeHits++; return true; }
        } else {
          l = y0; r = y0;
          while (l > 0) {
            const ni = (l - 1) * w + x0;
            if (wall[ni] === 1) { leftHard = true; break; }
            if (!wallInDir(ni, wd)) break;
            l--;
          }
          if (l === 0) leftHard = true;
          while (r < h - 1) {
            const ni = (r + 1) * w + x0;
            if (wall[ni] === 1) { rightHard = true; break; }
            if (!wallInDir(ni, wd)) break;
            r++;
          }
          if (r === h - 1) rightHard = true;
          if (!leftHard || !rightHard) continue;
          let hasGoal = false;
          for (let yy = l; yy <= r; yy++) {
            if (goal[yy * w + x0]) { hasGoal = true; break; }
          }
          if (!hasGoal) { freezeHits++; return true; }
        }
      }
    }
    return false;
  };

  if (hasDeadlock(boxes)) { process.stderr.write('INITIAL DEADLOCK\n'); return ''; }

  const heurCache = new Map<string, number>();
  const heuristic = (bs: number[]): number => {
    const key = bs.join(',');
    const cached = heurCache.get(key);
    if (cached !== undefined) return cached;
    const n = bs.length;
    const m = goals.length;
    if (n === 0) { heurCache.set(key, 0); return 0; }
    if (n !== m) {
      let sum = 0;
      for (const b of bs) {
        let best = 1e9;
        for (let j = 0; j < m; j++) {
          const d = goalDist[j]![b]!;
          if (d < best) best = d;
        }
        sum += best === 1e9 ? 1000 : best;
      }
      heurCache.set(key, sum);
      return sum;
    }
    const cost: number[][] = [];
    for (let i = 0; i < n; i++) {
      cost[i] = [];
      for (let j = 0; j < m; j++) {
        const d = goalDist[j]![bs[i]!]!;
        cost[i][j] = d >= 1e9 ? 1000 : d;
      }
    }
    const h0 = hungarian(cost);
    // linear conflict: rows and columns
    let lc = 0;
    // rows
    const rowMap = new Map<number, number[]>();
    for (const b of bs) {
      const y = Math.floor(b / w);
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push(b);
    }
    for (const [y, bsRow] of rowMap) {
      const gRow = goals.filter((g) => Math.floor(g / w) === y);
      if (bsRow.length < 2 || gRow.length < 2) continue;
      const bsSorted = bsRow.slice().sort((a,b)=>a-b);
      const gSorted = gRow.slice().sort((a,b)=>a-b);
      // count inversions between bsSorted and gSorted by pairing sorted order
      for (let i = 0; i < bsSorted.length; i++) {
        for (let j = i + 1; j < bsSorted.length; j++) {
          if (bsSorted[i]! < bsSorted[j]! && gSorted[i]! > gSorted[j]!) lc += 2;
        }
      }
    }
    // columns
    const colMap = new Map<number, number[]>();
    for (const b of bs) {
      const x = b % w;
      if (!colMap.has(x)) colMap.set(x, []);
      colMap.get(x)!.push(b);
    }
    for (const [x, bsCol] of colMap) {
      const gCol = goals.filter((g) => g % w === x);
      if (bsCol.length < 2 || gCol.length < 2) continue;
      const bsSorted = bsCol.slice().sort((a,b)=>Math.floor(a/w)-Math.floor(b/w));
      const gSorted = gCol.slice().sort((a,b)=>Math.floor(a/w)-Math.floor(b/w));
      for (let i = 0; i < bsSorted.length; i++) {
        for (let j = i + 1; j < bsSorted.length; j++) {
          if (Math.floor(bsSorted[i]!/w) < Math.floor(bsSorted[j]!/w) && Math.floor(gSorted[i]!/w) > Math.floor(gSorted[j]!/w)) lc += 2;
        }
      }
    }
    const h = h0 + lc;
    heurCache.set(key, h);
    return h;
  };

  const stateKey = (p: number, bs: number[]): string => {
    let s = String.fromCharCode(p);
    for (const b of bs) s += String.fromCharCode(b);
    return s;
  };

  const P: number[] = [player];
  const B: number[][] = [boxes.slice()];
  const G: number[] = [0];
  const parent: number[] = [-1];
  const seg: string[] = [''];

  const best = new Map<string, number>();
  best.set(stateKey(player, boxes), 0);
  const bestComp = new Map<string, number>();

  const heap: [number, number, number][] = [];
  const heapPush = (e: [number, number, number]) => {
    let i = heap.length;
    heap.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!(heap[i]![0] < heap[p]![0] || (heap[i]![0] === heap[p]![0] && heap[i]![1] < heap[p]![1]))) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const heapPop = (): [number, number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        let c = 2 * i + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && (heap[c + 1]![0] < heap[c]![0] || (heap[c + 1]![0] === heap[c]![0] && heap[c + 1]![1] < heap[c]![1]))) c++;
        if (!(heap[c]![0] < heap[i]![0] || (heap[c]![0] === heap[i]![0] && heap[c]![1] < heap[i]![1]))) break;
        [heap[i], heap[c]] = [heap[c]!, heap[i]!];
        i = c;
      }
    }
    return top;
  };

  heapPush([WEIGHT * heuristic(boxes), 0, 0]);

  const isGoalState = (bs: number[]): boolean => {
    for (const b of bs) if (goal[b] !== 1) return false;
    return true;
  };

  const t0 = Date.now();
  let prunedComp = 0, prunedDead = 0;
  let expanded = 0;
  const LIMIT = 8_000_000;
  while (heap.length > 0 && expanded < LIMIT) {
    const [, g, s] = heapPop();
    const ps = P[s]!;
    const bs = B[s]!;
    const k = stateKey(ps, bs);
    if (best.get(k) !== g) continue;
    if (isGoalState(bs)) {
      let moves = '';
      for (let t = s; t > 0; t = parent[t]!) moves = seg[t] + moves;
      return moves;
    }
    expanded++;
    if (expanded % 20000 === 0 && Date.now() - T0 > TIME_BUDGET_MS) { process.stderr.write('TIME CAP after '+expanded+' expansions\n'); return ''; }
    if (expanded % 100000 === 0) process.stderr.write('expanded='+expanded+' heap='+heap.length+' t='+ (Date.now()-t0) +'ms pc='+prunedComp+' pd='+prunedDead+' fh='+freezeHits+'\n');
    const boxSet = new Uint8Array(size);
    for (const b of bs) boxSet[b] = 1;
    const reach = new Uint8Array(size);
    const par = new Int32Array(size).fill(-1);
    const pstep: string[] = new Array(size).fill('');
    const q: number[] = [ps];
    reach[ps] = 1;
    let minReach = ps;
    let qi = 0;
    while (qi < q.length) {
      const cur = q[qi++]!;
      const x = cur % w;
      const y = Math.floor(cur / w);
      // up
      if (y > 0) {
        const ni = cur - w;
        if (wall[ni] === 0 && boxSet[ni] === 0 && !reach[ni]) { reach[ni]=1; par[ni]=cur; pstep[ni]='u'; q.push(ni); if (ni < minReach) minReach = ni; }
      }
      if (y < h - 1) {
        const ni = cur + w;
        if (wall[ni] === 0 && boxSet[ni] === 0 && !reach[ni]) { reach[ni]=1; par[ni]=cur; pstep[ni]='d'; q.push(ni); if (ni < minReach) minReach = ni; }
      }
      if (x > 0) {
        const ni = cur - 1;
        if (wall[ni] === 0 && boxSet[ni] === 0 && !reach[ni]) { reach[ni]=1; par[ni]=cur; pstep[ni]='l'; q.push(ni); if (ni < minReach) minReach = ni; }
      }
      if (x < w - 1) {
        const ni = cur + 1;
        if (wall[ni] === 0 && boxSet[ni] === 0 && !reach[ni]) { reach[ni]=1; par[ni]=cur; pstep[ni]='r'; q.push(ni); if (ni < minReach) minReach = ni; }
      }
    }

    const compKey = stateKey(minReach, bs);
    if (bestComp.has(compKey) && bestComp.get(compKey)! <= g) { prunedComp++; continue; }
    bestComp.set(compKey, g);

    const walkPath = (target: number): string | null => {
      if (target === ps) return '';
      if (!reach[target]) return null;
      const steps: string[] = [];
      let cur = target;
      while (cur !== ps) {
        steps.push(pstep[cur]!);
        cur = par[cur]!;
        if (cur === -1) return null;
      }
      steps.reverse();
      return steps.join('');
    };

    for (let bi = 0; bi < bs.length; bi++) {
      const boxIdx = bs[bi]!;
      for (const [dx, dy, letter] of DIRS) {
        const d = dy * w + dx;
        const newBox = boxIdx + d;
        if (newBox < 0 || newBox >= size) continue;
        if (wall[newBox] === 1) continue;
        if (boxSet[newBox] === 1) continue;
        const behind = boxIdx - d;
        if (behind < 0 || behind >= size) continue;
        if (wall[behind] === 1) continue;
        if (boxSet[behind] === 1) continue;
        if (!reach[behind]) continue;
        const newBoxes = bs.slice();
        newBoxes[bi] = newBox;
        newBoxes.sort((a, b) => a - b);
        if (hasDeadlock(newBoxes)) { prunedDead++; continue; }
        const walk = walkPath(behind);
        if (walk === null) continue;
        const playerEnd = boxIdx;
        const nk = stateKey(playerEnd, newBoxes);
        const ng = g + 1;
        if (best.has(nk) && best.get(nk)! <= ng) continue;
        const t = P.length;
        P.push(playerEnd);
        B.push(newBoxes);
        G.push(ng);
        parent.push(s);
        seg.push(walk + letter.toUpperCase());
        best.set(nk, ng);
        heapPush([ng + WEIGHT * heuristic(newBoxes), ng, t]);
      }
    }
  }
  process.stderr.write('NO SOLUTION expanded='+expanded+' prunedComp='+prunedComp+' prunedDead='+prunedDead+'\n'); return '';
}

function popcount(x: number): number {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}

console.error('START', I, O); for (const id of readdirSync(I).sort()) {
  const moves = solve(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
