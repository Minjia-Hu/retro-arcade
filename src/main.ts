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
