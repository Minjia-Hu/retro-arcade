# Retro Arcade 脚手架 + Flappy Bird 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 retro-arcade 游戏合集的完整外壳（路由/首页/游戏外框）与 core 公共模块，并交付第一款可玩游戏 Flappy Bird，验证整体架构。

**Architecture:** Vite + TypeScript 纯静态 SPA，hash 路由。外壳为普通 DOM；游戏跑在 Canvas 上，实现统一 `Game` 接口。游戏规则写成纯函数（`logic.ts`），渲染只消费状态；Vitest 只测纯逻辑，Playwright 做端到端冒烟。

**Tech Stack:** Vite 5, TypeScript 5, Vitest 2, @playwright/test。零运行时依赖、零素材（音效用 Web Audio 合成）。

**规格文档:** `docs/superpowers/specs/2026-07-17-retro-arcade-design.md`（本计划对应其"实施顺序"第 1、2 步）

**约定:** commit 一律英文；开发在分支 `feature/scaffold-flappy` 上进行，最后 `merge --no-ff` 到 main 并 push（远程为 private 备份仓库，push ≠ 上线）。

---

## 文件结构总览

```
retro-arcade/
├── package.json / tsconfig.json / vite.config.ts / playwright.config.ts / .gitignore
├── index.html
├── src/
│   ├── main.ts               # 入口：装配 storage/audio/frame + 路由分发
│   ├── styles/arcade.css     # 街机主题全局样式
│   ├── core/
│   │   ├── theme.ts          # 颜色/字体常量
│   │   ├── storage.ts        # localStorage 封装（可注入后端，失败降级内存）
│   │   ├── audio.ts          # Web Audio 8-bit 音效合成
│   │   ├── loop.ts           # rAF 游戏循环（可注入 raf 供测试）
│   │   ├── input.ts          # 键盘/点按/滑动统一输入
│   │   └── game.ts           # Game / GameContext 接口
│   ├── shell/
│   │   ├── router.ts         # hash 路由
│   │   ├── hub.ts            # 首页卡片网格
│   │   └── frame.ts          # 游戏页外框（返回/暂停/静音/错误兜底）
│   └── games/
│       ├── registry.ts       # 8 款游戏注册表（未实装 = COMING SOON）
│       └── flappy/
│           ├── logic.ts      # 纯逻辑：物理/管道/碰撞/计分
│           └── index.ts      # Canvas 渲染 + Game 接口实现
├── tests/                    # Vitest 单测
│   ├── storage.test.ts / audio.test.ts / loop.test.ts
│   ├── input.test.ts / router.test.ts / flappy-logic.test.ts
└── e2e/smoke.spec.ts         # Playwright 冒烟
```

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts`

- [ ] **Step 1: 建开发分支**

```bash
cd retro-arcade
git checkout -b feature/scaffold-flappy
```

- [ ] **Step 2: 创建 `package.json`**

```json
{
  "name": "retro-arcade",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "@playwright/test": "^1.46.0"
  }
}
```

- [ ] **Step 3: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "e2e"]
}
```

- [ ] **Step 4: 创建 `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

// base 保持 '/'；部署 GitHub Pages 时（阶段 5）改为 '/retro-arcade/'
export default defineConfig({
  base: '/',
  // 限定单测目录，避免 Vitest 误收集 e2e/ 下的 Playwright 用例
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: 创建 `.gitignore`**

```
node_modules/
dist/
test-results/
playwright-report/
```

- [ ] **Step 6: 创建 `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>Game Center · 复古街机</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 7: 创建占位 `src/main.ts`**

```ts
document.getElementById('app')!.textContent = 'GAME CENTER BOOTING…';
```

- [ ] **Step 8: 安装依赖并验证**

```bash
npm install
npx tsc
npm run build
```
Expected: tsc 无输出（无错误）；build 生成 `dist/`。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + TypeScript project"
```

---

### Task 2: 主题常量与全局样式

**Files:**
- Create: `src/core/theme.ts`, `src/styles/arcade.css`

- [ ] **Step 1: 创建 `src/core/theme.ts`**

```ts
export const THEME = {
  bg: '#0d0d16',
  panel: '#16121f',
  text: '#e8e6ff',
  dim: '#665f7a',
  neonGreen: '#39ff14',
  neonPink: '#ff2fd6',
  neonCyan: '#00e5ff',
  neonYellow: '#ffe600',
  font: "'Courier New', ui-monospace, monospace",
} as const;
```

- [ ] **Step 2: 创建 `src/styles/arcade.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body {
  background: #0d0d16;
  color: #e8e6ff;
  font-family: 'Courier New', ui-monospace, monospace;
  -webkit-tap-highlight-color: transparent;
}
#app { height: 100%; display: flex; flex-direction: column; }
button { font-family: inherit; cursor: pointer; }

/* ---- 首页 ---- */
.hub { padding: 24px 16px; max-width: 720px; margin: 0 auto; width: 100%; }
.hub-title {
  text-align: center; color: #39ff14; letter-spacing: 4px;
  text-shadow: 0 0 10px #39ff14; font-size: clamp(18px, 5vw, 28px);
}
.hub-sub { text-align: center; color: #665f7a; font-size: 12px; margin: 8px 0 24px; letter-spacing: 2px; }
.hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.card {
  --neon: #00e5ff;
  background: #16121f; border: 2px solid var(--neon); border-radius: 6px;
  color: var(--neon); padding: 16px 8px; text-align: center;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
  transition: box-shadow .15s;
}
.card:not(:disabled):hover { box-shadow: 0 0 14px var(--neon); }
.hub-grid .card:nth-child(4n+1) { --neon: #39ff14; }
.hub-grid .card:nth-child(4n+2) { --neon: #ff2fd6; }
.hub-grid .card:nth-child(4n+3) { --neon: #00e5ff; }
.hub-grid .card:nth-child(4n+4) { --neon: #ffe600; }
.card-icon { font-size: 32px; }
.card-name { font-weight: bold; letter-spacing: 1px; }
.card-best { font-size: 11px; color: #665f7a; }
.card-soon { opacity: .45; cursor: default; }

/* ---- 游戏外框 ---- */
.frame { display: flex; flex-direction: column; height: 100%; }
.frame-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #16121f; border-bottom: 1px solid #2a2438;
}
.frame-title { color: #e8e6ff; letter-spacing: 2px; font-size: 14px; }
.frame-right { display: flex; gap: 8px; }
.btn {
  background: none; border: 1px solid #00e5ff; border-radius: 4px;
  color: #00e5ff; padding: 4px 10px; font-size: 13px;
}
.frame-body { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.frame-body canvas { max-width: 100%; max-height: 100%; }

/* ---- 错误兜底 ---- */
.frame-error {
  height: 100%; display: flex; flex-direction: column; gap: 16px;
  align-items: center; justify-content: center; color: #ff2fd6;
}
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc
```
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add arcade theme constants and global styles"
```

---

### Task 3: core/storage — localStorage 封装

**Files:**
- Create: `src/core/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: 写失败测试 `tests/storage.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ArcadeStorage, memoryBackend, type KVBackend } from '../src/core/storage';

describe('ArcadeStorage', () => {
  it('set 后能 get 回同一值（带 arcade. 命名空间）', () => {
    const backend = memoryBackend();
    const s = new ArcadeStorage(backend);
    s.set('best.flappy', 42);
    expect(s.get('best.flappy', 0)).toBe(42);
    expect(backend.getItem('arcade.best.flappy')).toBe('42');
  });

  it('缺失键返回 fallback', () => {
    const s = new ArcadeStorage(memoryBackend());
    expect(s.get('nope', 'x')).toBe('x');
  });

  it('损坏的 JSON 返回 fallback', () => {
    const backend = memoryBackend();
    backend.setItem('arcade.bad', '{oops');
    const s = new ArcadeStorage(backend);
    expect(s.get('bad', 7)).toBe(7);
  });

  it('后端抛异常时 get 返回 fallback、set 不抛', () => {
    const broken: KVBackend = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const s = new ArcadeStorage(broken);
    expect(s.get('k', 1)).toBe(1);
    expect(() => s.set('k', 2)).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/storage.test.ts
```
Expected: FAIL（找不到模块 `../src/core/storage`）。

- [ ] **Step 3: 实现 `src/core/storage.ts`**

```ts
export interface KVBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryBackend(): KVBackend {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
  };
}

function defaultBackend(): KVBackend {
  try {
    const ls = window.localStorage;
    ls.setItem('arcade.__probe', '1');
    ls.removeItem('arcade.__probe');
    return ls;
  } catch {
    // 隐私模式等场景下 localStorage 不可用，降级为内存存储
    return memoryBackend();
  }
}

export class ArcadeStorage {
  constructor(private backend: KVBackend = defaultBackend()) {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.backend.getItem(`arcade.${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.backend.setItem(`arcade.${key}`, JSON.stringify(value));
    } catch {
      // 写入失败不影响游戏
    }
  }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/storage.test.ts
```
Expected: 4 passed。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add namespaced storage with memory fallback"
```

---

### Task 4: core/audio — 8-bit 音效合成

**Files:**
- Create: `src/core/audio.ts`
- Test: `tests/audio.test.ts`

- [ ] **Step 1: 写失败测试 `tests/audio.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { AudioFx, SFX } from '../src/core/audio';
import { ArcadeStorage, memoryBackend } from '../src/core/storage';

describe('AudioFx', () => {
  it('SFX 音符数据合法（频率/时长为正）', () => {
    for (const notes of Object.values(SFX)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const [freq, dur] of notes) {
        expect(freq).toBeGreaterThan(0);
        expect(dur).toBeGreaterThan(0);
      }
    }
  });

  it('无 AudioContext 环境下 play 静默不抛', () => {
    const fx = new AudioFx(new ArcadeStorage(memoryBackend()));
    expect(() => fx.play('score')).not.toThrow();
  });

  it('静音状态持久化到 storage', () => {
    const storage = new ArcadeStorage(memoryBackend());
    const fx = new AudioFx(storage);
    expect(fx.isMuted()).toBe(false);
    expect(fx.toggleMuted()).toBe(true);
    // 重新构造，读回持久化状态
    expect(new AudioFx(storage).isMuted()).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/audio.test.ts
```
Expected: FAIL（找不到模块 `../src/core/audio`）。

- [ ] **Step 3: 实现 `src/core/audio.ts`**

```ts
import type { ArcadeStorage } from './storage';

// 名字保持游戏无关的通用语义（'action' 而非 'flap'），避免各游戏词汇泄漏进 core
export type SfxName = 'action' | 'score' | 'hit' | 'win' | 'over' | 'click';

// 每个音效 = 一串 [频率Hz, 时长s] 音符，方波依次播放
export const SFX: Record<SfxName, [number, number][]> = {
  action: [[600, 0.05], [900, 0.05]],
  score: [[880, 0.06], [1320, 0.09]],
  hit: [[200, 0.1], [120, 0.15]],
  win: [[660, 0.1], [880, 0.1], [1100, 0.2]],
  over: [[400, 0.12], [300, 0.12], [200, 0.25]],
  click: [[700, 0.04]],
};

export class AudioFx {
  private ctx: AudioContext | null = null;
  private muted: boolean;

  constructor(private storage: ArcadeStorage) {
    this.muted = storage.get('muted', false);
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    this.storage.set('muted', this.muted);
    return this.muted;
  }

  play(name: SfxName): void {
    if (this.muted) return;
    try {
      // 首次调用（必然发生在用户交互后）才创建 AudioContext，符合自动播放策略
      this.ctx ??= new AudioContext();
      // iOS Safari 等会在切后台后挂起 AudioContext，此处正值用户手势，允许 resume
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      let t = this.ctx.currentTime;
      for (const [freq, dur] of SFX[name]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
    } catch {
      // 环境不支持 Web Audio 时静默降级
    }
  }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/audio.test.ts
```
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Web Audio 8-bit sound synthesis"
```

---

### Task 5: core/loop — 游戏循环

**Files:**
- Create: `src/core/loop.ts`
- Test: `tests/loop.test.ts`

- [ ] **Step 1: 写失败测试 `tests/loop.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { GameLoop } from '../src/core/loop';

// 手动驱动的 raf：收集回调，由测试逐帧触发
function manualRaf() {
  const queue: ((t: number) => void)[] = [];
  return {
    raf: (cb: (t: number) => void) => { queue.push(cb); return 0; },
    fire(t: number) { const cbs = queue.splice(0); cbs.forEach((cb) => cb(t)); },
  };
}

describe('GameLoop', () => {
  it('按帧调用 update(dt 秒) 和 render', () => {
    const calls: number[] = [];
    let renders = 0;
    const m = manualRaf();
    const loop = new GameLoop((dt) => calls.push(dt), () => { renders += 1; }, m.raf);
    loop.start();
    m.fire(1000); // 首帧建立基准，dt=0
    m.fire(1016); // +16ms
    expect(calls.length).toBe(2);
    expect(calls[1]).toBeCloseTo(0.016, 3);
    expect(renders).toBe(2);
  });

  it('dt 上限 50ms（后台切回不产生大跳帧）', () => {
    const calls: number[] = [];
    const m = manualRaf();
    const loop = new GameLoop((dt) => calls.push(dt), () => {}, m.raf);
    loop.start();
    m.fire(0);
    m.fire(5000); // 5 秒后切回
    expect(calls[1]).toBe(0.05);
  });

  it('pause 后不再 update，resume 后恢复且不补帧', () => {
    const calls: number[] = [];
    const m = manualRaf();
    const loop = new GameLoop((dt) => calls.push(dt), () => {}, m.raf);
    loop.start();
    m.fire(0);
    loop.pause();
    m.fire(100);
    expect(calls.length).toBe(1);
    loop.resume();
    m.fire(200); // resume 后首帧重新建立基准
    m.fire(216);
    expect(calls.length).toBe(3);
    expect(calls[2]).toBeCloseTo(0.016, 3);
  });

  it('stop 后彻底停止', () => {
    let n = 0;
    const m = manualRaf();
    const loop = new GameLoop(() => { n += 1; }, () => {}, m.raf);
    loop.start();
    m.fire(0);
    loop.stop();
    m.fire(16);
    expect(n).toBe(1);
  });

  it('重复 start 不会叠加并行 rAF 链', () => {
    let n = 0;
    const m = manualRaf();
    const loop = new GameLoop(() => { n += 1; }, () => {}, m.raf);
    loop.start();
    loop.start();
    m.fire(0);
    expect(n).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/loop.test.ts
```
Expected: FAIL（找不到模块 `../src/core/loop`）。

- [ ] **Step 3: 实现 `src/core/loop.ts`**

```ts
type Raf = (cb: (t: number) => void) => number;

export class GameLoop {
  private running = false;
  private paused = false;
  private last = 0;
  private hasBase = false; // 是否已建立时间基准（不能用 last===0 当哨兵：真实时间戳可能恰为 0）

  constructor(
    private update: (dt: number) => void,
    private render: () => void,
    private raf: Raf = (cb) => requestAnimationFrame(cb),
  ) {}

  start(): void {
    if (this.running) return; // 防重入：避免叠加并行 rAF 链
    this.running = true;
    this.paused = false;
    this.hasBase = false;
    this.raf(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.hasBase = false; // 重建时间基准，避免暂停时长被算进 dt
  }

  private frame = (t: number): void => {
    if (!this.running) return;
    if (!this.paused) {
      if (!this.hasBase) {
        this.hasBase = true;
        this.last = t;
      }
      const dt = Math.min((t - this.last) / 1000, 0.05);
      this.last = t;
      this.update(dt);
      this.render();
    }
    this.raf(this.frame);
  };
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/loop.test.ts
```
Expected: 5 passed。

**注意**：时间基准必须用独立的 `hasBase` 布尔标志，不能用 `last===0` 当哨兵——真实时间戳可能恰好为 0，会导致下一帧 dt 被误判为首帧而算成 0。测试的 `m.fire(0)` 用例专门覆盖此场景，若实现方式改变必须保留。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add rAF game loop with pause and dt clamping"
```

---

### Task 6: core/input — 统一输入层

**Files:**
- Create: `src/core/input.ts`
- Test: `tests/input.test.ts`

- [ ] **Step 1: 写失败测试 `tests/input.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { swipeDirection } from '../src/core/input';

describe('swipeDirection', () => {
  it('位移小于阈值返回 null', () => {
    expect(swipeDirection(10, 10)).toBeNull();
  });
  it('水平位移大则判左右', () => {
    expect(swipeDirection(80, 20)).toBe('right');
    expect(swipeDirection(-80, 20)).toBe('left');
  });
  it('垂直位移大则判上下', () => {
    expect(swipeDirection(20, 80)).toBe('down');
    expect(swipeDirection(20, -80)).toBe('up');
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/input.test.ts
```
Expected: FAIL（找不到模块 `../src/core/input`）。

- [ ] **Step 3: 实现 `src/core/input.ts`**

```ts
export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export function swipeDirection(dx: number, dy: number, threshold = 24): SwipeDir | null {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export class InputService {
  private disposers: (() => void)[] = [];

  /** 各 on* 方法均返回单独的解绑函数；dispose() 仍可整体清理 */
  onKey(handler: (code: string) => void): () => void {
    const fn = (e: KeyboardEvent) => handler(e.code);
    window.addEventListener('keydown', fn);
    return this.track(() => window.removeEventListener('keydown', fn));
  }

  onTap(el: HTMLElement, handler: () => void): () => void {
    const fn = (e: PointerEvent) => { e.preventDefault(); handler(); };
    el.addEventListener('pointerdown', fn);
    return this.track(() => el.removeEventListener('pointerdown', fn));
  }

  onSwipe(el: HTMLElement, handler: (dir: SwipeDir) => void): () => void {
    let sx = 0;
    let sy = 0;
    const down = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; };
    const up = (e: PointerEvent) => {
      const dir = swipeDirection(e.clientX - sx, e.clientY - sy);
      if (dir) handler(dir);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    return this.track(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
    });
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  private track(off: () => void): () => void {
    this.disposers.push(off);
    return off;
  }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/input.test.ts
```
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add unified input layer with swipe detection"
```

---

### Task 7: core/game 接口 + 游戏注册表

**Files:**
- Create: `src/core/game.ts`, `src/games/registry.ts`

- [ ] **Step 1: 创建 `src/core/game.ts`**

```ts
import type { AudioFx } from './audio';
import type { ArcadeStorage } from './storage';
import type { InputService } from './input';

export interface GameMeta {
  id: string;
  name: string;
  icon: string;
}

export interface GameContext {
  audio: AudioFx;
  storage: ArcadeStorage;
  input: InputService;
  /** 注册容器尺寸变化回调，返回解除函数 */
  onResize(cb: () => void): () => void;
}

export interface Game {
  meta: GameMeta;
  mount(container: HTMLElement, ctx: GameContext): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
```

- [ ] **Step 2: 创建 `src/games/registry.ts`**（此时全部为 COMING SOON，Task 12 给 flappy 接上 load）

```ts
import type { Game, GameMeta } from '../core/game';

export interface GameEntry {
  meta: GameMeta;
  /** 未实装的游戏没有 load，首页显示 COMING SOON */
  load?: () => Promise<Game>;
}

export const GAMES: GameEntry[] = [
  { meta: { id: 'snake', name: '贪吃蛇', icon: '🐍' } },
  { meta: { id: 'tetris', name: '俄罗斯方块', icon: '🧱' } },
  { meta: { id: 'breakout', name: '打砖块', icon: '🕹️' } },
  { meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦' } },
  { meta: { id: 'g2048', name: '2048', icon: '🔢' } },
  { meta: { id: 'minesweeper', name: '扫雷', icon: '💣' } },
  { meta: { id: 'sudoku', name: '数独', icon: '✏️' } },
  { meta: { id: 'gomoku', name: '五子棋', icon: '⚫' } },
];
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc
```
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: define Game interface and game registry"
```

---

### Task 8: shell/router — hash 路由

**Files:**
- Create: `src/shell/router.ts`
- Test: `tests/router.test.ts`

- [ ] **Step 1: 写失败测试 `tests/router.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseHash } from '../src/shell/router';

describe('parseHash', () => {
  it('空 hash 与 #/ 都是首页', () => {
    expect(parseHash('')).toEqual({ name: 'hub' });
    expect(parseHash('#')).toEqual({ name: 'hub' });
    expect(parseHash('#/')).toEqual({ name: 'hub' });
  });
  it('#/<id> 解析为游戏路由', () => {
    expect(parseHash('#/flappy')).toEqual({ name: 'game', id: 'flappy' });
    expect(parseHash('#/gomoku')).toEqual({ name: 'game', id: 'gomoku' });
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/router.test.ts
```
Expected: FAIL（找不到模块 `../src/shell/router`）。

- [ ] **Step 3: 实现 `src/shell/router.ts`**

```ts
export type Route = { name: 'hub' } | { name: 'game'; id: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  return path === '' ? { name: 'hub' } : { name: 'game', id: path };
}

export function startRouter(onChange: (route: Route) => void): () => void {
  const fire = () => onChange(parseHash(location.hash));
  window.addEventListener('hashchange', fire);
  fire(); // 启动时按当前 hash 渲染一次
  return () => window.removeEventListener('hashchange', fire);
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/router.test.ts
```
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add hash router"
```

---

### Task 9: shell/hub — 首页卡片网格

**Files:**
- Create: `src/shell/hub.ts`
- Modify: `src/main.ts`（替换占位内容）

- [ ] **Step 1: 创建 `src/shell/hub.ts`**

```ts
import { GAMES } from '../games/registry';
import type { ArcadeStorage } from '../core/storage';

export function renderHub(root: HTMLElement, storage: ArcadeStorage): void {
  const cards = GAMES.map((g) => {
    const playable = Boolean(g.load);
    const raw = storage.get<number | null>(`best.${g.meta.id}`, null);
    const best = Number.isFinite(raw) ? (raw as number) : null; // 存量数据可能被写坏，只信数字
    const sub = playable ? (best === null ? '—' : `BEST ${best}`) : 'COMING SOON';
    return `
      <button class="card${playable ? '' : ' card-soon'}" data-id="${g.meta.id}"${playable ? '' : ' disabled'}>
        <span class="card-icon">${g.meta.icon}</span>
        <span class="card-name">${g.meta.name}</span>
        <span class="card-best">${sub}</span>
      </button>`;
  }).join('');

  root.innerHTML = `
    <div class="hub">
      <h1 class="hub-title">★ GAME CENTER ★</h1>
      <p class="hub-sub">INSERT COIN · PRESS START</p>
      <div class="hub-grid">${cards}</div>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>('.card:not([disabled])').forEach((el) => {
    el.addEventListener('click', () => {
      location.hash = `#/${el.dataset.id}`;
    });
  });
}
```

- [ ] **Step 2: 改写 `src/main.ts`**（游戏路由暂时跳回首页，Task 10 接入外框）

```ts
import './styles/arcade.css';
import { startRouter } from './shell/router';
import { renderHub } from './shell/hub';
import { ArcadeStorage } from './core/storage';

const app = document.getElementById('app')!;
const storage = new ArcadeStorage();

startRouter((route) => {
  if (route.name === 'hub') {
    renderHub(app, storage);
    return;
  }
  location.hash = '#/'; // 游戏路由在 Task 10 接入
});
```

- [ ] **Step 3: 编译并人工验证**

```bash
npx tsc && npm run build
```
Expected: 无错误。再 `npm run dev` 打开 http://localhost:5173 ：暗底首页，霓虹标题"★ GAME CENTER ★"，8 张卡片全部为 COMING SOON（四色轮换描边）。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: render hub with 8 game cards"
```

---

### Task 10: shell/frame — 游戏外框与错误兜底

**Files:**
- Create: `src/shell/frame.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建 `src/shell/frame.ts`**

```ts
import type { Game, GameContext } from '../core/game';
import type { AudioFx } from '../core/audio';
import type { ArcadeStorage } from '../core/storage';
import { InputService } from '../core/input';

export class GameFrame {
  private game: Game | null = null;
  private input: InputService | null = null;
  private observer: ResizeObserver | null = null;
  private paused = false;

  constructor(private audio: AudioFx, private storage: ArcadeStorage) {}

  open(root: HTMLElement, game: Game): void {
    this.close();
    this.paused = false;
    root.innerHTML = `
      <div class="frame">
        <div class="frame-bar">
          <button class="btn" data-act="back">◀ 返回</button>
          <span class="frame-title">${game.meta.icon} ${game.meta.name}</span>
          <span class="frame-right">
            <button class="btn" data-act="pause">⏸</button>
            <button class="btn" data-act="mute">${this.audio.isMuted() ? '🔇' : '🔊'}</button>
          </span>
        </div>
        <div class="frame-body"></div>
      </div>`;

    const body = root.querySelector<HTMLElement>('.frame-body')!;
    const btn = (act: string) => root.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;

    btn('back').addEventListener('click', () => {
      this.audio.play('click');
      location.hash = '#/';
    });
    btn('mute').addEventListener('click', () => {
      const muted = this.audio.toggleMuted();
      btn('mute').textContent = muted ? '🔇' : '🔊';
      this.audio.play('click');
    });
    btn('pause').addEventListener('click', () => {
      if (!this.game) return;
      this.paused = !this.paused;
      btn('pause').textContent = this.paused ? '▶' : '⏸';
      try {
        if (this.paused) this.game.pause();
        else this.game.resume();
      } catch (err) {
        console.error('[arcade] game crashed on pause/resume:', err);
      }
    });

    const resizeCbs = new Set<() => void>();
    this.observer = new ResizeObserver(() => resizeCbs.forEach((cb) => cb()));
    this.observer.observe(body);
    this.input = new InputService();

    const ctx: GameContext = {
      audio: this.audio,
      storage: this.storage,
      input: this.input,
      onResize: (cb) => {
        resizeCbs.add(cb);
        return () => resizeCbs.delete(cb);
      },
    };

    try {
      game.mount(body, ctx);
      this.game = game;
    } catch (err) {
      console.error('[arcade] game crashed on mount:', err);
      try { game.destroy(); } catch { /* 尽力清理半挂载游戏的自有资源（rAF/定时器） */ }
      this.showError(root);
    }
  }

  close(): void {
    try {
      this.game?.destroy();
    } catch (err) {
      console.error('[arcade] game crashed on destroy:', err);
    }
    this.game = null;
    this.input?.dispose();
    this.input = null;
    this.observer?.disconnect();
    this.observer = null;
  }

  private showError(root: HTMLElement): void {
    root.innerHTML = `
      <div class="frame-error">
        <p>💥 GAME ERROR · 游戏出错了</p>
        <button class="btn" data-act="home">返回首页</button>
      </div>`;
    root.querySelector('[data-act="home"]')!.addEventListener('click', () => {
      location.hash = '#/';
    });
  }
}
```

- [ ] **Step 2: 改写 `src/main.ts`（完整版）**

```ts
import './styles/arcade.css';
import { startRouter } from './shell/router';
import { renderHub } from './shell/hub';
import { GameFrame } from './shell/frame';
import { ArcadeStorage } from './core/storage';
import { AudioFx } from './core/audio';
import { GAMES } from './games/registry';

const app = document.getElementById('app')!;
const storage = new ArcadeStorage();
const audio = new AudioFx(storage);
const frame = new GameFrame(audio, storage);

let nav = 0; // 防止快速切换路由时旧的异步加载覆盖新页面

startRouter(async (route) => {
  const token = ++nav;
  frame.close();
  if (route.name === 'hub') {
    renderHub(app, storage);
    return;
  }
  const entry = GAMES.find((g) => g.meta.id === route.id);
  if (!entry?.load) {
    location.hash = '#/';
    return;
  }
  try {
    const game = await entry.load();
    if (token !== nav) return; // 期间用户已跳走
    frame.open(app, game);
  } catch (err) {
    console.error('[arcade] failed to load game:', err);
    location.hash = '#/';
  }
});
```

- [ ] **Step 3: 编译并人工验证**

```bash
npx tsc && npm run build
```
Expected: 无错误。`npm run dev` 下手动把地址改成 `http://localhost:5173/#/unknown`，应自动跳回首页。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add game frame with pause, mute and error fallback"
```

---

### Task 11: Flappy Bird 纯逻辑

**Files:**
- Create: `src/games/flappy/logic.ts`
- Test: `tests/flappy-logic.test.ts`

- [ ] **Step 1: 写失败测试 `tests/flappy-logic.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createState, flap, tick, H, BIRD_X, BIRD_R, PIPE_W, PIPE_GAP,
} from '../src/games/flappy/logic';

const rand = () => 0.5; // 固定随机数便于断言

describe('flappy logic', () => {
  it('初始状态：ready、小鸟居中、零分', () => {
    const s = createState();
    expect(s.status).toBe('ready');
    expect(s.birdY).toBe(H / 2);
    expect(s.score).toBe(0);
    expect(s.pipes).toEqual([]);
  });

  it('ready 状态下 tick 不产生任何变化', () => {
    const s = createState();
    tick(s, 0.016, rand);
    expect(s.birdY).toBe(H / 2);
    expect(s.pipes).toEqual([]);
  });

  it('flap 进入 playing 并给向上速度', () => {
    const s = createState();
    flap(s);
    expect(s.status).toBe('playing');
    expect(s.birdVy).toBeLessThan(0);
  });

  it('重力使下落速度随时间增加', () => {
    const s = createState();
    flap(s);
    const vy1 = s.birdVy;
    tick(s, 0.1, rand);
    expect(s.birdVy).toBeGreaterThan(vy1);
  });

  it('坠地判死', () => {
    const s = createState();
    flap(s);
    s.birdY = H - BIRD_R; // 贴地
    s.birdVy = 100;
    tick(s, 0.1, rand);
    expect(s.status).toBe('dead');
  });

  it('管道完全越过小鸟时得 1 分且 tick 返回 true', () => {
    const s = createState();
    flap(s);
    s.birdY = H / 2;
    // 放一根即将越过的管道，缺口对准小鸟避免碰撞
    s.pipes.push({ x: BIRD_X - PIPE_W - 0.5, gapY: H / 2, passed: false });
    const scored = tick(s, 0.016, rand);
    expect(scored).toBe(true);
    expect(s.score).toBe(1);
    expect(s.status).toBe('playing');
  });

  it('撞管道判死', () => {
    const s = createState();
    flap(s);
    // 管道正压在小鸟 x 上，缺口远离小鸟
    s.pipes.push({ x: BIRD_X - PIPE_W / 2, gapY: H / 2 + PIPE_GAP * 2, passed: false });
    s.birdY = H / 2;
    s.birdVy = 0;
    tick(s, 0.001, rand);
    expect(s.status).toBe('dead');
  });

  it('dead 后 flap 无效', () => {
    const s = createState();
    s.status = 'dead';
    flap(s);
    expect(s.status).toBe('dead');
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npm test -- tests/flappy-logic.test.ts
```
Expected: FAIL（找不到模块 `../src/games/flappy/logic`）。

- [ ] **Step 3: 实现 `src/games/flappy/logic.ts`**

```ts
// 逻辑坐标系：320 × 480，渲染层负责缩放
export const W = 320;
export const H = 480;
export const BIRD_X = 80;
export const BIRD_R = 12;
export const PIPE_W = 52;
export const PIPE_GAP = 130;

const GRAVITY = 1200; // px/s²
const FLAP_VY = -380; // px/s
const PIPE_SPEED = 120; // px/s
const PIPE_SPACING = 190; // 相邻管道水平间距 px

export type FlappyStatus = 'ready' | 'playing' | 'dead';

export interface Pipe {
  x: number; // 管道左缘
  gapY: number; // 缺口中心
  passed: boolean;
}

export interface FlappyState {
  birdY: number;
  birdVy: number;
  pipes: Pipe[];
  score: number;
  status: FlappyStatus;
}

export function createState(): FlappyState {
  return { birdY: H / 2, birdVy: 0, pipes: [], score: 0, status: 'ready' };
}

export function flap(s: FlappyState): void {
  if (s.status === 'dead') return;
  s.status = 'playing';
  s.birdVy = FLAP_VY;
}

/** 推进一帧；返回本帧是否得分（供播放音效） */
export function tick(s: FlappyState, dt: number, rand: () => number = Math.random): boolean {
  if (s.status !== 'playing') return false;

  s.birdVy += GRAVITY * dt;
  s.birdY += s.birdVy * dt;

  // 生成新管道
  const lastX = s.pipes.length > 0 ? s.pipes[s.pipes.length - 1].x : -Infinity;
  if (lastX < W - PIPE_SPACING) {
    const gapY = 80 + rand() * (H - 240);
    s.pipes.push({ x: W + PIPE_W, gapY, passed: false });
  }

  // 移动、清理出屏管道
  for (const p of s.pipes) p.x -= PIPE_SPEED * dt;
  s.pipes = s.pipes.filter((p) => p.x + PIPE_W > 0);

  // 计分
  let scored = false;
  for (const p of s.pipes) {
    if (!p.passed && p.x + PIPE_W < BIRD_X) {
      p.passed = true;
      s.score += 1;
      scored = true;
    }
  }

  // 碰撞：天地边界
  if (s.birdY + BIRD_R >= H || s.birdY - BIRD_R <= 0) {
    s.status = 'dead';
    return scored;
  }
  // 碰撞：管道
  for (const p of s.pipes) {
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    const inGap =
      s.birdY - BIRD_R > p.gapY - PIPE_GAP / 2 && s.birdY + BIRD_R < p.gapY + PIPE_GAP / 2;
    if (inX && !inGap) {
      s.status = 'dead';
      break;
    }
  }
  return scored;
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npm test -- tests/flappy-logic.test.ts
```
Expected: 8 passed。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add flappy bird pure game logic"
```

---

### Task 12: Flappy Bird 渲染 + 接入注册表

**Files:**
- Create: `src/games/flappy/index.ts`
- Modify: `src/games/registry.ts`（flappy 条目加 load）

- [ ] **Step 1: 创建 `src/games/flappy/index.ts`**

```ts
import type { Game, GameContext } from '../../core/game';
import { GameLoop } from '../../core/loop';
import { THEME } from '../../core/theme';
import * as L from './logic';

export function createFlappy(): Game {
  let state = L.createState();
  let canvas: HTMLCanvasElement | null = null;
  let g: CanvasRenderingContext2D | null = null;
  let loop: GameLoop | null = null;
  let ctx: GameContext | null = null;
  let best = 0;
  let deadHandled = false;

  function act(): void {
    if (state.status === 'dead') {
      state = L.createState();
      deadHandled = false;
      return;
    }
    L.flap(state);
    ctx?.audio.play('action');
  }

  function update(dt: number): void {
    const scored = L.tick(state, dt);
    if (scored) {
      ctx?.audio.play('score');
      if (state.score > best) {
        best = state.score;
        ctx?.storage.set('best.flappy', best);
      }
    }
    if (state.status === 'dead' && !deadHandled) {
      deadHandled = true;
      ctx?.audio.play('hit');
    }
  }

  function render(): void {
    if (!g) return;
    g.fillStyle = THEME.bg;
    g.fillRect(0, 0, L.W, L.H);

    // 管道：霓虹绿
    g.fillStyle = THEME.neonGreen;
    g.shadowColor = THEME.neonGreen;
    g.shadowBlur = 8;
    for (const p of state.pipes) {
      g.fillRect(p.x, 0, L.PIPE_W, p.gapY - L.PIPE_GAP / 2);
      g.fillRect(p.x, p.gapY + L.PIPE_GAP / 2, L.PIPE_W, L.H - p.gapY - L.PIPE_GAP / 2);
    }

    // 小鸟：霓虹黄圆
    g.shadowColor = THEME.neonYellow;
    g.fillStyle = THEME.neonYellow;
    g.beginPath();
    g.arc(L.BIRD_X, state.birdY, L.BIRD_R, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;

    // 分数
    g.fillStyle = THEME.text;
    g.font = `bold 28px ${THEME.font}`;
    g.textAlign = 'center';
    g.fillText(String(state.score), L.W / 2, 48);

    // 状态提示
    g.font = `14px ${THEME.font}`;
    if (state.status === 'ready') {
      g.fillStyle = THEME.neonCyan;
      g.fillText('点按 / 空格 起飞', L.W / 2, L.H / 2 + 60);
    } else if (state.status === 'dead') {
      g.fillStyle = THEME.neonPink;
      g.font = `bold 24px ${THEME.font}`;
      g.fillText('GAME OVER', L.W / 2, L.H / 2 - 20);
      g.font = `14px ${THEME.font}`;
      g.fillText(`BEST ${best} · 点按重来`, L.W / 2, L.H / 2 + 12);
    }
  }

  return {
    meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦' },

    mount(container: HTMLElement, context: GameContext): void {
      ctx = context;
      best = ctx.storage.get('best.flappy', 0);
      canvas = document.createElement('canvas');
      canvas.width = L.W;
      canvas.height = L.H;
      canvas.style.touchAction = 'none';
      container.appendChild(canvas);
      g = canvas.getContext('2d')!;

      ctx.input.onTap(canvas, act);
      ctx.input.onKey((code) => {
        if (code === 'Space' || code === 'ArrowUp') act();
      });

      loop = new GameLoop(update, render);
      loop.start();
    },

    pause(): void {
      loop?.pause();
    },

    resume(): void {
      loop?.resume();
    },

    destroy(): void {
      loop?.stop();
      loop = null;
      canvas?.remove();
      canvas = null;
      g = null;
      ctx = null; // 事件监听由 frame 的 InputService.dispose() 统一清理
    },
  };
}
```

- [ ] **Step 2: 修改 `src/games/registry.ts` 中 flappy 条目**

将

```ts
  { meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦' } },
```

改为

```ts
  {
    meta: { id: 'flappy', name: 'FLAPPY BIRD', icon: '🐦' },
    load: async () => (await import('./flappy')).createFlappy(),
  },
```

- [ ] **Step 3: 编译 + 全量单测**

```bash
npx tsc && npm test
```
Expected: 无编译错误；25 tests passed（storage 4 + audio 3 + loop 5 + input 3 + router 2 + flappy 8）。

- [ ] **Step 4: 人工验证（dev server）**

`npm run dev` 打开 http://localhost:5173 ：
- 首页 flappy 卡片不再是 COMING SOON，点击进入游戏
- 空格/点按起飞，有 8-bit 音效；撞管道 GAME OVER；再点按重开
- 顶栏 ⏸ 暂停/恢复、🔊 静音、◀ 返回首页均正常
- 死亡后返回首页，flappy 卡片显示 BEST 分数

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add playable Flappy Bird with canvas rendering and sfx"
```

---

### Task 13: Playwright 冒烟测试

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

- [ ] **Step 1: 创建 `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 固定专用端口，避免与本机其他 Vite 项目（另一个常驻 5173 的本机项目）撞车
  use: { baseURL: 'http://localhost:5183' },
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: 创建 `e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('首页显示 8 张游戏卡片', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hub-title')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(8);
});

test('进入 flappy 有画布渲染，返回首页正常', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-id="flappy"]');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.frame-title')).toContainText('FLAPPY');
  await page.click('[data-act="back"]');
  await expect(page.locator('.hub-title')).toBeVisible();
});

test('未实装游戏卡片为禁用状态', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-id="snake"]')).toBeDisabled();
});
```

- [ ] **Step 3: 安装浏览器并运行**

```bash
npx playwright install chromium
npm run e2e
```
Expected: 3 passed。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add Playwright smoke tests for hub and flappy"
```

---

### Task 14: 合并回 main 并推送备份

- [ ] **Step 1: 最终全量验证**

```bash
npx tsc && npm test && npm run build && npm run e2e
```
Expected: 全部通过。

- [ ] **Step 2: 合并并推送**

```bash
git checkout main
git merge --no-ff feature/scaffold-flappy -m "Merge feature/scaffold-flappy: arcade shell + Flappy Bird"
git push origin main
```
（push 仅为 private 仓库备份，不触发任何部署。）

---

## 本计划之外（后续计划逐一覆盖）

贪吃蛇、2048、打砖块、扫雷、俄罗斯方块、数独、五子棋（含 AI 与 Web Worker）各出独立计划；最后是全局打磨与部署上线计划（仅在用户确认后执行）。
