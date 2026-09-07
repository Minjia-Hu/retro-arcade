import { pixelIconSvg } from './pixel-icons';
import { accentOf } from './accent';
import type { GameMeta, OverlayView } from '../core/game';
import { esc } from './escape';


const TITLE_CLASS: Record<OverlayView['tone'], string> = {
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

/** 机柜外壳。游戏挂载到 .screen-body，浮层由 overlayHtml 填进 .settle */
export function cabinetHtml(meta: GameMeta, muted: boolean): string {
  const name = meta.displayName ?? meta.name;
  const hintsHtml = hintsBarHtml(meta.hints ?? []);
  const pauseHtml = meta.pausable === false
    ? ''
    : '<button class="cab-btn" data-act="pause" aria-label="暂停">❚❚</button>';
  const sideHtml = meta.side ? '<div class="cab-side"></div>' : '';
  const headHtml = meta.head ? '<div class="cab-head"></div>' : '';
  const padHtml = meta.pad ? '<div class="cab-pad"></div>' : '';
  const toolsHtml = (meta.tools ?? [])
    .map((t) => `<button class="cab-btn" data-act="tool:${esc(t.id)}" aria-label="${esc(t.aria)}">${esc(t.label)}</button>`)
    .join('');
  // 药丸始终渲染、起手隐藏，靠 ctx.setPill 填内容——这样它不必凭空插入节点
  const pillHtml = '<span class="cab-pill" aria-label="当前难度" hidden></span>';

  return `
    <div class="cabinet accent-${accentOf(meta.id)}">
      <div class="cab-bar">
        <button class="cab-btn" data-act="back">◀ BACK</button>
        <span class="cab-id">
          <!-- pixelIconSvg 的输出只由白名单查表与数字构成，不含任何入参文本，故不转义 -->
          <span class="px px-xs">${pixelIconSvg(meta.id)}</span>
          <span class="cab-name">${esc(name)}</span>
          ${pillHtml}
        </span>
        <span class="cab-tools">
          ${pauseHtml}
          ${toolsHtml}
          <button class="cab-btn${muted ? ' is-off' : ''}" data-act="mute" aria-pressed="${muted}" aria-label="音效">SND</button>
        </span>
      </div>
      <div class="cab-screen">
        <div class="cab-stack">
          ${headHtml}
          <div class="screen screen-${meta.screen ?? 'dark'}">
            <div class="screen-body"></div>
            <div class="screen-glass"></div>
            <div class="settle" role="status" aria-live="polite" hidden></div>
          </div>
        </div>
        ${sideHtml}
      </div>
      ${padHtml}
      ${hintsHtml}
    </div>`;
}

/** 浮层卡片。按钮的点击由 frame 绑定，data-act 用下标寻址 */
export function overlayHtml(view: OverlayView): string {
  const lines = view.lines
    .map((l) => `<span class="settle-line">${esc(l)}</span>`)
    .join('');
  const actions = view.actions
    .map((a, i) => {
      const secondary = a.kind === 'secondary' ? ' settle-action-secondary' : '';
      return `<button class="settle-action${secondary}" data-act="overlay:${i}">${esc(a.label)}</button>`;
    })
    .join('');
  const quit = view.quit === false
    ? ''
    : '<button class="settle-quit" data-act="overlay-quit">QUIT TO HUB</button>';
  return `
    <div class="settle-card">
      <span class="settle-title ${TITLE_CLASS[view.tone]}">${esc(view.title)}</span>
      ${lines}
      <div class="settle-actions">${actions}</div>
      ${quit}
    </div>`;
}
