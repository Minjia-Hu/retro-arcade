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
