import { pixelIconSvg } from './pixel-icons';
import { accentOf } from './accent';
import type { GameMeta, SettleView } from '../core/game';
import { esc } from './escape';


const TITLE_CLASS: Record<SettleView['tone'], string> = {
  lose: 'settle-title-lose',
  win: 'settle-title-win',
  record: 'settle-title-record',
};

/** 底部按键提示条；没有提示时返回空串（不渲染该条） */
export function hintsBarHtml(hints: string[]): string {
  if (!hints.length) return '';
  const items = hints
    .map((h) => `<span>${esc(h)}</span>`)
    .join('<span class="cab-dot">·</span>');
  return `<p class="cab-hints">${items}</p>`;
}

/** 机柜外壳。游戏挂载到 .screen-body，结算浮层由 settleHtml 填进 .settle */
export function cabinetHtml(meta: GameMeta, muted: boolean): string {
  const name = meta.displayName ?? meta.name;
  const hintsHtml = hintsBarHtml(meta.hints ?? []);
  const pauseHtml = meta.pausable === false
    ? ''
    : '<button class="cab-btn" data-act="pause" aria-label="暂停">❚❚</button>';
  const sideHtml = meta.side ? '<div class="cab-side"></div>' : '';
  const padHtml = meta.pad ? '<div class="cab-pad"></div>' : '';

  return `
    <div class="cabinet accent-${accentOf(meta.id)}">
      <div class="cab-bar">
        <button class="cab-btn" data-act="back">◀ BACK</button>
        <span class="cab-id">
          <!-- pixelIconSvg 的输出只由白名单查表与数字构成，不含任何入参文本，故不转义 -->
          <span class="px px-xs">${pixelIconSvg(meta.id)}</span>
          <span class="cab-name">${esc(name)}</span>
        </span>
        <span class="cab-tools">
          ${pauseHtml}
          <button class="cab-btn${muted ? ' is-off' : ''}" data-act="mute" aria-pressed="${muted}" aria-label="音效">SND</button>
        </span>
      </div>
      <div class="cab-screen">
        <div class="screen screen-${meta.screen ?? 'dark'}">
          <div class="screen-body"></div>
          <div class="screen-glass"></div>
          <div class="settle" role="status" aria-live="polite" hidden></div>
        </div>
        ${sideHtml}
      </div>
      ${padHtml}
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
