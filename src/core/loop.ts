type Raf = (cb: (t: number) => void) => number;

export class GameLoop {
  private running = false;
  private paused = false;
  private last = 0;
  private hasBase = false; // whether a time base exists (last===0 can't be the sentinel: a real timestamp can be exactly 0)

  constructor(
    private update: (dt: number) => void,
    private render: () => void,
    private raf: Raf = (cb) => requestAnimationFrame(cb),
  ) {}

  start(): void {
    if (this.running) return; // re-entrancy guard: never stack parallel rAF chains
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
    this.hasBase = false; // rebuild the time base so the paused span isn't counted in dt
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
