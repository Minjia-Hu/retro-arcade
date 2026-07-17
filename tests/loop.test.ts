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
});
