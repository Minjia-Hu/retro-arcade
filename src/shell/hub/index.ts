import type { ArcadeStorage } from '../../core/storage';
import type { AudioFx } from '../../core/audio';
import { buildHubModel } from './model';
import { hubHtml } from './view';

export function renderHub(root: HTMLElement, storage: ArcadeStorage, audio: AudioFx): void {
  root.innerHTML = hubHtml(buildHubModel(storage, new Date()));

  // The sound toggle shares AudioFx's state with the in-game SND button; blur after click, same convention as the top-bar wire()
  const sound = root.querySelector<HTMLButtonElement>('[data-act="sound"]');
  sound?.addEventListener('click', () => {
    const muted = audio.toggleMuted();
    sound.textContent = `SOUND ${muted ? 'OFF' : 'ON'}`;
    sound.setAttribute('aria-pressed', String(muted));
    audio.play('click'); // play() is a no-op while muted
    sound.blur();
  });

  // Grid cards use data-id, hero buttons use data-goto, so e2e selectors are unambiguous
  root.querySelectorAll<HTMLElement>('[data-id], [data-goto]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id ?? el.dataset.goto;
      if (id) location.hash = `#/${id}`;
    });
  });
}
