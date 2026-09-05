import { pixelIconSvg } from './pixel-icons';
import { accentOf } from './accent';
import type { GameMeta, SettleView } from '../core/game';

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
};
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

const TITLE_CLASS: Record<SettleView['tone'], string> = {
  lose: 'settle-title-lose',
  win: 'settle-title-win',
  record: 'settle-title-record',
};

/** 机柜外壳。游戏挂载到 .screen-body，结算浮层由 settleHtml 填进 .settle */
export function cabinetHtml(meta: GameMeta, muted: boolean): string {
  const name = meta.displayName ?? meta.name;
  const hints = meta.hints ?? [];
  const hintsHtml = hints.length
    ? `<p class="cab-hints">${hints
        .map((h) => `<span>${esc(h)}</span>`)
        .join('<span class="cab-dot">·</span>')}</p>`
    : '';

  return `
    <div class="cabinet accent-${accentOf(meta.id)}">
      <div class="cab-bar">
        <button class="cab-btn" data-act="back">◀ BACK</button>
        <span class="cab-id">
          <span class="px px-xs">${pixelIconSvg(meta.id)}</span>
          <span class="cab-name">${esc(name)}</span>
        </span>
        <span class="cab-tools">
          <button class="cab-btn" data-act="pause">❚❚</button>
          <button class="cab-btn${muted ? ' is-off' : ''}" data-act="mute">SND</button>
        </span>
      </div>
      <div class="cab-screen">
        <div class="screen screen-${meta.screen ?? 'dark'}">
          <div class="screen-body"></div>
          <div class="screen-glass"></div>
          <div class="settle" hidden></div>
        </div>
      </div>
      ${hintsHtml}
    </div>`;
}

/** 结算浮层卡片。按钮的点击由 frame 绑定 */
export function settleHtml(view: SettleView): string {
  const lines = view.lines
    .map((l) => `<span class="settle-line">${esc(l)}</span>`)
    .join('');
  return `
    <div class="settle-card">
      <span class="settle-title ${TITLE_CLASS[view.tone]}">${esc(view.title)}</span>
      ${lines}
      <button class="settle-action" data-act="settle-action">${esc(view.action.label)}</button>
      <button class="settle-quit" data-act="settle-quit">QUIT TO HUB</button>
    </div>`;
}
