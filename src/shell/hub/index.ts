import type { ArcadeStorage } from '../../core/storage';
import type { AudioFx } from '../../core/audio';
import { buildHubModel } from './model';
import { hubHtml } from './view';

export function renderHub(root: HTMLElement, storage: ArcadeStorage, audio: AudioFx): void {
  root.innerHTML = hubHtml(buildHubModel(storage, new Date()));

  // 声音开关与游戏顶栏的 SND 共用 AudioFx 里的同一份状态；点完 blur，与顶栏 wire() 同一约定
  const sound = root.querySelector<HTMLButtonElement>('[data-act="sound"]');
  sound?.addEventListener('click', () => {
    const muted = audio.toggleMuted();
    sound.textContent = `SOUND ${muted ? 'OFF' : 'ON'}`;
    sound.setAttribute('aria-pressed', String(muted));
    audio.play('click'); // 静音时 play 自己会跳过
    sound.blur();
  });

  // 网格卡片用 data-id，hero 按钮用 data-goto，避免 e2e 选择器歧义
  root.querySelectorAll<HTMLElement>('[data-id], [data-goto]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id ?? el.dataset.goto;
      if (id) location.hash = `#/${id}`;
    });
  });
}
