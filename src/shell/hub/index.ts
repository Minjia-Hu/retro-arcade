import type { ArcadeStorage } from '../../core/storage';
import { buildHubModel } from './model';
import { hubHtml } from './view';

export function renderHub(root: HTMLElement, storage: ArcadeStorage): void {
  root.innerHTML = hubHtml(buildHubModel(storage, new Date()));

  // 网格卡片用 data-id，hero 按钮用 data-goto，避免 e2e 选择器歧义
  root.querySelectorAll<HTMLElement>('[data-id], [data-goto]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id ?? el.dataset.goto;
      if (id) location.hash = `#/${id}`;
    });
  });
}
