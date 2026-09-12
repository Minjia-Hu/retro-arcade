import { describe, it, expect } from 'vitest';
import { parseHash } from '../src/shell/router';

describe('parseHash', () => {
  it('an empty hash and #/ are both the hub', () => {
    expect(parseHash('')).toEqual({ name: 'hub' });
    expect(parseHash('#')).toEqual({ name: 'hub' });
    expect(parseHash('#/')).toEqual({ name: 'hub' });
  });
  it('#/<id> parses as a game route', () => {
    expect(parseHash('#/flappy')).toEqual({ name: 'game', id: 'flappy' });
    expect(parseHash('#/gomoku')).toEqual({ name: 'game', id: 'gomoku' });
  });
});
