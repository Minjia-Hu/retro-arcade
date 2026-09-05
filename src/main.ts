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
  // 写在这里而不是 frame：frame 不知道 id 的来源，且加载可能失败
  storage.set('lastPlayed', { id: entry.meta.id, at: Date.now() });
  try {
    const game = await entry.load();
    if (token !== nav) return; // 期间用户已跳走
    frame.open(app, game);
  } catch (err) {
    console.error('[arcade] failed to load game:', err);
    location.hash = '#/';
  }
});
