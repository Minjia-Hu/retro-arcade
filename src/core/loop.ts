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
