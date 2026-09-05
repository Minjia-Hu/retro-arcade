import { pixelIconSvg } from './icons';
import type { HubModel } from './model';

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
};
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

function dailyBody(prefix: string, name: string, suffix: string): string {
  return [esc(prefix), `<b>${esc(name)}</b>`, esc(suffix)].filter(Boolean).join(' ');
}

export function hubHtml(m: HubModel): string {
  const hall = m.hall.map((r) => `
        <div class="hall-row hall-row-${r.tone}">
          <span><b>${esc(r.rank)}</b> ${esc(r.name)}</span>
          <span class="hall-score">${esc(r.score)}</span>
        </div>`).join('');

  const cards = m.cards.map((c) => `
        <button class="card" data-id="${esc(c.id)}">
          <span class="px px-sm" style="color:${c.accent}">${pixelIconSvg(c.id)}</span>
          <span class="card-name">${esc(c.name)}</span>
          <span class="card-pill ${c.hasRecord ? 'card-pill-on' : 'card-pill-off'}"${
            c.hasRecord ? ` style="background:${c.accent}"` : ''
          }>${esc(c.pill)}</span>
        </button>`).join('');

  return `
    <div class="hub">
      <header class="marquee">
        <div class="marquee-bar marquee-bar-top"></div>
        <h1 class="hub-title">GAME CENTER</h1>
        <p class="hub-sub">THE SUNSET ARCADE — OPEN 24/7</p>
        <div class="marquee-bar marquee-bar-bottom"></div>
      </header>

      <section class="hero">
        <div class="panel continue">
          <span class="panel-label continue-label">${esc(m.featured.label)}</span>
          <div class="continue-well">
            <span class="px px-lg" style="color:${m.featured.accent}">${pixelIconSvg(m.featured.id)}</span>
            <span class="continue-name">${esc(m.featured.name)}</span>
            <button class="btn-start" data-goto="${esc(m.featured.id)}">${esc(m.featured.button)}</button>
            <span class="continue-meta">${esc(m.featured.meta)}</span>
          </div>
        </div>

        <div class="hero-side">
          <div class="panel daily">
            <span class="panel-label daily-label">${esc(m.daily.dateLabel)}</span>
            <span class="daily-body">${dailyBody(m.daily.prefix, m.daily.name, m.daily.suffix)}</span>
            <span class="daily-hint">BEAT IT → YOUR NAME JOINS THE HALL ▼</span>
            <button class="btn-accept" data-goto="${esc(m.daily.id)}">ACCEPT ▸</button>
          </div>

          <div class="panel hall">
            <span class="panel-label hall-label">HALL OF FAME</span>${hall}
            <span class="hall-note">TOP SCORES ACROSS ALL GAMES</span>
          </div>
        </div>
      </section>

      <p class="grid-heading">◆ SELECT YOUR CABINET ◆</p>
      <div class="hub-grid">${cards}</div>
      <p class="hub-footer">${esc(m.footer)}</p>
    </div>`;
}
