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
