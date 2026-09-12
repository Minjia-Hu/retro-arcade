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

let nav = 0; // stops a stale async load from overwriting the new page when routes change quickly

startRouter(async (route) => {
  const token = ++nav;
  frame.close();
  if (route.name === 'hub') {
    renderHub(app, storage, audio);
    return;
  }
  const entry = GAMES.find((g) => g.meta.id === route.id);
  if (!entry?.load) {
    location.hash = '#/';
    return;
  }
  try {
    const game = await entry.load();
    if (token !== nav) return; // the user navigated away in the meantime
    frame.open(app, game);
    // Written here rather than in frame: frame doesn't know where the id came from. After load —
    // a game that failed to load must not show up under CONTINUE PLAYING
    storage.set('lastPlayed', { id: entry.meta.id, at: Date.now() });
  } catch (err) {
    console.error('[arcade] failed to load game:', err);
    location.hash = '#/';
  }
});
