import './styles.css';
import {
  calculateRequired,
  validateInputs,
  formatNumber,
  overallForScore,
  currentPercentage,
  bufferForAchievable,
  impossibleGap,
  exploreTargets,
  insight,
} from './calculator.js';

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------
function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const drawer = document.querySelector('[data-mobile-nav]');
  if (!toggle || !drawer) return;

  const iconOpen = toggle.querySelector('[data-icon-open]');
  const iconClose = toggle.querySelector('[data-icon-close]');

  function setOpen(open) {
    drawer.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (iconOpen) iconOpen.style.display = open ? 'none' : 'block';
    if (iconClose) iconClose.style.display = open ? 'block' : 'none';
    const label = open ? 'Close menu' : 'Open menu';
    const span = toggle.querySelector('.sr-only');
    if (span) span.textContent = label;
    drawer.setAttribute('aria-hidden', String(!open));
    if (open) {
      const firstLink = drawer.querySelector('a');
      firstLink?.focus();
    }
  }

  toggle.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('is-open');
    setOpen(!isOpen);
  });

  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 880 && drawer.classList.contains('is-open')) setOpen(false);
  });

  // trap focus? simple: not needed for now
}

// ------------------------------------------------------------------
// URL Share helpers. Shared inputs are intentionally visible in the URL.
// ------------------------------------------------------------------
function buildQuery(inputs) {
  const p = new URLSearchParams();
  // Use concise keys matching spec
  p.set('earned', String(inputs.obtained));
  p.set('possible', String(inputs.possible));
  p.set('final', String(inputs.finalTotal));
  p.set('target', String(inputs.target));
  return p.toString();
}

function parseQuery() {
  const sp = new URLSearchParams(window.location.search);
  const earned = sp.get('earned') ?? sp.get('obtained') ?? sp.get('e');
  const possible = sp.get('possible') ?? sp.get('p');
  const fin = sp.get('final') ?? sp.get('finalTotal') ?? sp.get('f');
  const target = sp.get('target') ?? sp.get('t');
  if (earned == null && possible == null && fin == null && target == null) return null;
  if (earned == null || possible == null || fin == null || target == null) return null;
  return { obtained: earned, possible, finalTotal: fin, target };
}

function updateUrl(inputs) {
  try {
    const qs = buildQuery(inputs);
    const url = `${window.location.pathname}?${qs}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  } catch {}
}

function clearUrl() {
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {}
}

function shareUrlString() {
  return window.location.href;
}

// ------------------------------------------------------------------
// Calculator
// ------------------------------------------------------------------
function initCalculator() {
  const form = document.querySelector('[data-calc-form]');
  if (!form) return;

  const obtainedEl = form.querySelector('#obtained');
  const possibleEl = form.querySelector('#possible');
  const finalTotalEl = form.querySelector('#finalTotal');
  const targetEl = form.querySelector('#target');
  const targetRangeEl = form.querySelector('#targetRange');
  const resultEl = document.querySelector('[data-result]');
  const presetBtns = form.querySelectorAll('[data-preset]');
  const liveSignalEl = document.getElementById('live-signal');

  // Sync target inputs
  function syncTarget(value, source) {
    const v = String(value);
    if (source !== 'range' && targetRangeEl) targetRangeEl.value = v;
    if (source !== 'number' && targetEl) targetEl.value = v;
    updatePresetActive(Number(v));
    const disp = document.querySelector('[data-target-display]');
    if (disp) disp.textContent = `${formatNumber(Number(v) || 0, 0)}%`;
  }

  function updatePresetActive(val) {
    presetBtns.forEach((b) => {
      const pv = Number(b.dataset.preset);
      const active = pv === val;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  targetEl?.addEventListener('input', (e) => {
    syncTarget(e.target.value, 'number');
    clearFieldError('target');
    updateLiveSignal();
  });
  targetRangeEl?.addEventListener('input', (e) => {
    syncTarget(e.target.value, 'range');
    clearFieldError('target');
    updateLiveSignal();
  });
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      syncTarget(btn.dataset.preset, 'both');
      clearFieldError('target');
      updateLiveSignal();
      // auto-recalc if result visible
      if (resultEl.querySelector('.result-card')) form.requestSubmit();
    });
  });

  [obtainedEl, possibleEl, finalTotalEl].forEach((el) => {
    el?.addEventListener('input', () => {
      clearFieldError(el.id);
      updateLiveSignal();
    });
  });

  // Live position signal
  function updateLiveSignal() {
    if (!liveSignalEl) return;
    const oStr = obtainedEl?.value.trim() ?? '';
    const pStr = possibleEl?.value.trim() ?? '';
    const fStr = finalTotalEl?.value.trim() ?? '';
    const o = Number(oStr);
    const p = Number(pStr);
    const f = Number(fStr);

    const validCurrent =
      oStr !== '' &&
      pStr !== '' &&
      Number.isFinite(o) &&
      Number.isFinite(p) &&
      p > 0 &&
      o >= 0 &&
      o <= p &&
      p <= 100000;

    if (!validCurrent) {
      liveSignalEl.hidden = true;
      liveSignalEl.innerHTML = '';
      return;
    }

    const curPct = (o / p) * 100;
    const hasFinal = fStr !== '' && Number.isFinite(f) && f > 0 && f <= 100000;

    // bar proportions: possible / total
    let barHtml = '';
    if (hasFinal) {
      const total = p + f;
      const curShare = (p / total) * 100;
      const remShare = 100 - curShare;
      barHtml = `<div class="live-signal__bar" aria-hidden="true"><div class="live-signal__bar-fill" style="width:${curShare}%"></div><div class="live-signal__bar-remaining" style="width:${remShare}%"></div></div>`;
    }

    const curLabel = `${formatNumber(curPct, 1)}% so far`;
    const remainingLabel = hasFinal ? `You have ${formatNumber(f, 0)} marks remaining.` : `${formatNumber(p, 0)} marks possible so far. Add your final total.`;

    liveSignalEl.hidden = false;
    liveSignalEl.innerHTML = `
      <span class="live-signal__pill"><span class="live-signal__dot" aria-hidden="true"></span> ${o} / ${p} = ${formatNumber(curPct, 1)}%</span>
      <span style="font-size:12px; color:var(--color-body);">${curLabel} · ${remainingLabel}</span>
      ${barHtml}
    `;
  }

  function clearFieldError(id) {
    const input = document.getElementById(id);
    const errEl = document.getElementById(`${id}-error`);
    if (input) {
      input.removeAttribute('aria-invalid');
      // keep describedby for hint? just remove error ref but keep hint exists – simplest remove
      const hintMap = {
        obtained: 'obtained-hint obtained-error',
        possible: 'possible-error',
        finalTotal: 'finalTotal-error',
        target: 'target-error',
      };
      // restore default describedby if needed – not critical
    }
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.remove('is-visible');
    }
  }

  function showFieldError(id, msg) {
    const input = document.getElementById(id);
    const errEl = document.getElementById(`${id}-error`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (errEl) input.setAttribute('aria-describedby', `${id}-error`);
    }
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('is-visible');
    }
  }

  function clearAllErrors() {
    ['obtained', 'possible', 'finalTotal', 'target'].forEach(clearFieldError);
    const general = document.getElementById('calc-general-error');
    if (general) {
      general.textContent = '';
      general.hidden = true;
    }
  }

  function renderEmpty() {
    if (!resultEl) return;
    resultEl.innerHTML = `
      <div class="result-empty">
        <div class="result-empty__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h5M8 18h5"/></svg>
        </div>
        <h3 class="result-empty__title">Enter your marks to see what you need</h3>
        <p class="result-empty__text">Fill in your current marks, the final exam total, and your target. We’ll tell you the exact marks required — plus what-if scenarios — instantly.</p>
        <div class="result-empty__example">
          <div class="result-empty__example-label">Try this example — click to fill</div>
          <button type="button" data-fill-example-inline style="display:block; width:100%; text-align:left; background:transparent; border:none; padding:0; cursor:pointer;">
            <dl class="result-empty__example-grid">
              <dt>Current</dt><dd>72 / 80</dd>
              <dt>Final exam</dt><dd>100 marks</dd>
              <dt>Target</dt><dd>90%</dd>
              <dt><strong>You need</strong></dt><dd><strong>90 / 100</strong></dd>
            </dl>
          </button>
        </div>
        <p style="font-size:11px; color:var(--color-body); margin-top:12px; line-height:1.4;">Calculations run in your browser. Visitor usage may be measured through Google Analytics. <a href="/Grade-Calculator/privacy/" style="color:var(--color-ink); text-decoration:underline; text-underline-offset:2px;">Privacy</a></p>
      </div>
    `;
    resultEl.querySelector('[data-fill-example-inline]')?.addEventListener('click', () => {
      obtainedEl.value = '72';
      possibleEl.value = '80';
      finalTotalEl.value = '100';
      syncTarget(90, 'both');
      clearAllErrors();
      updateLiveSignal();
      form.requestSubmit();
    });
  }

  function buildShareText(data, inputs) {
    const o = Number(inputs.obtained), p = Number(inputs.possible), f = Number(inputs.finalTotal), t = Number(inputs.target);
    const curPct = currentPercentage({ obtained: o, possible: p });
    if (data.status === 'already') {
      const overallZero = (o / (p + f)) * 100;
      return `I already have enough for ${formatNumber(t, 0)}% — need 0/${f} on the final! Current: ${o}/${p} (${formatNumber(curPct, 1)}%). Even with 0 I finish at ${formatNumber(overallZero, 1)}%.`;
    }
    if (data.status === 'impossible') {
      return `My ${formatNumber(t, 0)}% target isn't mathematically possible anymore. Maximum possible: ${formatNumber(data.maxPercentage, 1)}% with ${f}/${f} on the final. Current: ${o}/${p} (${formatNumber(curPct, 1)}%). Gap: ${formatNumber(impossibleGap(data, t), 1)} points.`;
    }
    // achievable
    return `I need ${data.required}/${f} on my final (${formatNumber(data.requiredPercentage, 1)}%) to finish with ${formatNumber(t, 0)}% overall. Current: ${o}/${p} (${formatNumber(curPct, 1)}%). ${data.needsRounding ? `Exact: ${formatNumber(data.raw, 1)} → min whole-mark ${data.required}.` : `Exact: ${formatNumber(data.raw, 1)}.`}`;
  }

  function buildWhatsAppLikeShare(data, inputs) {
    // concise for Discord/Notes per spec
    const o = Number(inputs.obtained), p = Number(inputs.possible), f = Number(inputs.finalTotal), t = Number(inputs.target);
    const curPct = currentPercentage({ obtained: o, possible: p });
    if (data.status === 'already') return `I already have enough for ${formatNumber(t, 0)}% — need 0/${f}. Current: ${o}/${p} (${formatNumber(curPct, 1)}%).`;
    if (data.status === 'impossible') return `My ${formatNumber(t, 0)}% target isn't mathematically possible anymore. Maximum possible: ${formatNumber(data.maxPercentage, 1)}% with ${f}/${f} on the final.`;
    return `I need ${data.required}/${f} on my final (${formatNumber(data.requiredPercentage, 1)}%) to finish with ${formatNumber(t, 0)}% overall. Current: ${o}/${p} (${formatNumber(curPct, 1)}%).`;
  }

  function explorerHtml(inputs, currentTarget) {
    const targets = [60, 70, 80, 85, 90, 95, 100];
    const rows = exploreTargets({ obtained: Number(inputs.obtained), possible: Number(inputs.possible), finalTotal: Number(inputs.finalTotal) }, targets);
    const trs = rows
      .map((r) => {
        const isCurrent = r.target === Number(currentTarget);
        const isImpossible = r.status === 'impossible';
        const neededCell = isImpossible
          ? `<span style="color:var(--color-error); font-weight:600;">Impossible</span> <span style="font-size:11px; color:var(--color-body);">(max ${formatNumber(r.maxPercentage, 1)}%)</span>`
          : r.status === 'already'
            ? `0 / ${inputs.finalTotal} <span style="font-size:11px; color:var(--color-success);">already</span>`
            : `${r.required} / ${inputs.finalTotal} <span style="font-size:11px; color:var(--color-body);">(${formatNumber((r.required / Number(inputs.finalTotal)) * 100, 1)}%)</span>`;
        return `
          <tr class="${isCurrent ? 'is-current' : ''} ${isImpossible ? 'is-impossible' : ''}">
            <td><strong>${r.target}%</strong></td>
            <td>${neededCell}</td>
            <td style="text-align:right;">
              <button type="button" class="explorer__btn ${isCurrent ? 'is-active' : ''}" data-explorer-target="${r.target}" ${isImpossible ? 'disabled aria-disabled="true" title="Not achievable"' : ''} aria-label="Set target to ${r.target} percent">
                ${isCurrent ? 'Current' : isImpossible ? '—' : 'Use'}
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
    return `
      <div class="explorer" role="region" aria-label="What targets can you still reach">
        <div class="explorer__head">
          <span class="explorer__title">What targets can you still reach?</span>
          <span class="explorer__hint">Click to use</span>
        </div>
        <table class="explorer__table">
          <thead><tr><th>Target</th><th>Required final</th><th></th></tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    `;
  }

  function whatIfHtml(inputs, data) {
    const o = Number(inputs.obtained), p = Number(inputs.possible), f = Number(inputs.finalTotal);
    // default slider value: if achievable, required, else 70% of final or half
    let defaultScore;
    if (data.status === 'achievable') defaultScore = data.required;
    else if (data.status === 'already') defaultScore = 0;
    else defaultScore = Math.round(f * 0.8);
    defaultScore = Math.max(0, Math.min(f, defaultScore));
    const overall = overallForScore({ obtained: o, possible: p, finalTotal: f }, defaultScore);
    const chips = [60, 70, 80, 90, 100]
      .map((pct) => {
        const sc = Math.round((pct / 100) * f);
        // label chip as score
        return `<button type="button" class="whatif__chip ${sc === defaultScore ? 'is-active' : ''}" data-whatif="${sc}">${sc}</button>`;
      })
      .join('');
    return `
      <div class="whatif" role="region" aria-label="What-if explorer">
        <div class="whatif__head">
          <span class="whatif__title">What if I score…</span>
          <span class="whatif__value" data-whatif-display>${defaultScore} / ${f}</span>
        </div>
        <label class="sr-only" for="whatif-range">What-if final exam score</label>
        <input class="whatif__slider" id="whatif-range" data-whatif-range type="range" min="0" max="${f}" step="1" value="${defaultScore}" aria-label="What-if final score slider" />
        <div class="whatif__chips" role="group" aria-label="Quick scores">
          ${chips}
        </div>
        <div class="whatif__overall">
          <div class="whatif__overall-label">Your overall grade</div>
          <div class="whatif__overall-value" data-whatif-overall>${formatNumber(overall, 1)}%</div>
          <div class="whatif__overall-note" data-whatif-note>${o} + ${defaultScore} = ${o + defaultScore} / ${p + f} total</div>
        </div>
      </div>
    `;
  }

  function auditGridHtml(inputs, data) {
    const o = Number(inputs.obtained), p = Number(inputs.possible), f = Number(inputs.finalTotal), t = Number(inputs.target);
    const total = p + f;
    const curPct = currentPercentage({ obtained: o, possible: p });
    // after hitting required
    let finalScoreForAudit;
    let overallLabel;
    if (data.status === 'achievable') {
      finalScoreForAudit = data.required;
      overallLabel = `${formatNumber(t, 1)}% overall`;
    } else if (data.status === 'already') {
      finalScoreForAudit = 0;
      overallLabel = `${formatNumber((o / total) * 100, 1)}% overall (with 0)`;
    } else {
      finalScoreForAudit = f;
      overallLabel = `${formatNumber(data.maxPercentage, 1)}% max`;
    }
    const auditTotal = o + finalScoreForAudit;
    return `
      <div class="audit-grid" aria-label="Your numbers">
        <div class="audit-cell">
          <div class="audit-cell__label">Current</div>
          <div class="audit-cell__value">${o} / ${p}</div>
          <div class="audit-cell__sub">${formatNumber(curPct, 1)}% so far</div>
        </div>
        <div class="audit-cell">
          <div class="audit-cell__label">Final</div>
          <div class="audit-cell__value">${finalScoreForAudit} / ${f}</div>
          <div class="audit-cell__sub">${f > 0 ? formatNumber((finalScoreForAudit / f) * 100, 1) : '0'}% on final</div>
        </div>
        <div class="audit-cell">
          <div class="audit-cell__label">Total</div>
          <div class="audit-cell__value">${auditTotal} / ${total}</div>
          <div class="audit-cell__sub">combined</div>
        </div>
        <div class="audit-cell audit-cell--accent">
          <div class="audit-cell__label">Overall</div>
          <div class="audit-cell__value">${overallLabel.split(' ')[0]}</div>
          <div class="audit-cell__sub">${overallLabel.includes('overall') ? overallLabel.split(' ').slice(1).join(' ') : 'overall'}</div>
        </div>
      </div>
    `;
  }

  function gapVisHtml(inputs, data) {
    const o = Number(inputs.obtained), p = Number(inputs.possible), f = Number(inputs.finalTotal), t = Number(inputs.target);
    const curPct = currentPercentage({ obtained: o, possible: p });
    const maxPct = data.maxPercentage;
    let reqPct;
    let reqLabel = 'Required';
    if (data.status === 'achievable') reqPct = data.requiredPercentage;
    else if (data.status === 'already') { reqPct = 0; reqLabel = 'Required (0%)'; }
    else { reqPct = 100; reqLabel = 'Needed (impossible)'; }

    // clamp for display
    return `
      <div class="gap-vis" aria-label="Where you are, what you need, and your maximum">
        <div class="gap-vis__col gap-vis__col--current">
          <div class="gap-vis__label">Current</div>
          <div class="gap-vis__value">${formatNumber(curPct, 1)}%</div>
        </div>
        <div class="gap-vis__arrow" aria-hidden="true">→</div>
        <div class="gap-vis__col gap-vis__col--required">
          <div class="gap-vis__label">${reqLabel}</div>
          <div class="gap-vis__value">${data.status === 'impossible' ? '—' : formatNumber(reqPct, 1) + '%'}</div>
        </div>
        <div class="gap-vis__arrow" aria-hidden="true">→</div>
        <div class="gap-vis__col gap-vis__col--max">
          <div class="gap-vis__label">Maximum</div>
          <div class="gap-vis__value">${formatNumber(maxPct, 1)}%</div>
        </div>
      </div>
    `;
  }

  function shareBarHtml() {
    const url = shareUrlString();
    return `
      <div class="share-bar" role="region" aria-label="Share this calculation">
        <div style="flex:1 1 100%; font-weight:600; font-size:12px; color:var(--color-ink); display:flex; align-items:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/></svg>
          Share this calculation
        </div>
        <div class="share-bar__url" title="${url}">${url}</div>
        <button type="button" class="btn btn--outline" style="font-size:12px; padding:8px 12px; white-space:nowrap;" data-action="copy-link">Copy link</button>
        <span class="share-bar__hint">Values are in the URL. Anyone with the link can see them and restore the calculation; the page visit may also be included in analytics.</span>
      </div>
    `;
  }

  function renderResult(data, inputs) {
    if (!resultEl) return;
    const { obtained, possible, finalTotal, target } = inputs;
    const o = Number(obtained), p = Number(possible), f = Number(finalTotal), t = Number(target);
    const currentPct = currentPercentage({ obtained: o, possible: p });
    const maxPct = data.maxPercentage;
    const neededPct = data.requiredPercentage;
    const minOverallWithZero = (o / (p + f)) * 100;

    let html = '';
    const insightText = insight({ obtained: o, possible: p, finalTotal: f, target: t }, data);
    const buffer = data.status === 'achievable' ? bufferForAchievable({ finalTotal: f }, data.required) : 0;

    if (data.status === 'already') {
      html = `
        <div class="result-card result--already" role="status" aria-live="polite">
          <div class="result-badge result-badge--success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
            Already there
          </div>
          <div class="result-main">
            <div class="result-main__label">Your required final score</div>
            <div class="result-main__score"><div class="result-main__score-row">0 <small>/ ${f}</small></div></div>
            <div class="result-main__percent">You already have enough for <strong>${formatNumber(t, 0)}%</strong> overall.</div>
            <p class="result-main__note">Even with 0 on the final, you finish at <strong>${formatNumber(minOverallWithZero, 1)}%</strong>. Anything you earn just adds a buffer.</p>
            <div class="buffer-line" style="justify-content:center; width:fit-content; margin-inline:auto;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              ${formatNumber(buffer, 0)}-mark buffer to 100 — total safety margin.
            </div>
            <p class="insight-line">${insightText}</p>
          </div>
          ${auditGridHtml(inputs, data)}
          ${gapVisHtml(inputs, data)}
          <div class="result-footnote">Nice work — you can walk into the final with no pressure. Still aim to do your best to keep your current average strong.</div>
          ${whatIfHtml(inputs, data)}
          ${explorerHtml(inputs, t)}
          ${shareBarHtml()}
          <div class="result-actions">
            <button type="button" class="btn btn--outline" data-action="reset">Start over</button>
            <button type="button" class="btn btn--primary" data-action="share">Copy result</button>
          </div>
        </div>
      `;
    } else if (data.status === 'impossible') {
      const gap = impossibleGap(data, t);
      html = `
        <div class="result-card result--impossible" role="status" aria-live="polite">
          <div class="result-badge result-badge--error">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
            Not possible
          </div>
          <div class="result-main">
            <div class="result-main__label">This target is no longer mathematically possible</div>
            <div class="result-main__score"><div class="result-main__score-row">${f} <small>/ ${f}</small></div></div>
            <div class="result-main__percent">Even with <strong>${f}/${f} (100%)</strong> you reach <strong>${formatNumber(maxPct, 1)}%</strong>, short of <strong>${formatNumber(t, 0)}%</strong>.</div>
            <p class="result-main__note">Required was <strong>${formatNumber(data.raw, 1)} marks</strong> — more than the final offers (${formatNumber((data.raw / f) * 100, 1)}%).</p>
            <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:10px;">
              <span class="buffer-line" style="background:var(--color-error-bg); border-color:#fecaca; color:var(--color-error);">
                Gap: ${formatNumber(gap, 1)} percentage points
              </span>
              <span class="buffer-line" style="background:var(--color-canvas-soft); border-color:var(--color-hairline); color:var(--color-body);">
                Max: ${formatNumber(maxPct, 1)}%
              </span>
            </div>
            <p class="insight-line">${insightText}</p>
          </div>
          <div class="result-details">
            <div class="result-details__row"><dt>Current</dt><dd>${o} / ${p} (${formatNumber(currentPct, 1)}%)</dd></div>
            <div class="result-details__row"><dt>Target overall</dt><dd>${formatNumber(t, 0)}%</dd></div>
            <div class="result-details__row"><dt>Final needed</dt><dd>${formatNumber(data.raw, 1)} / ${f} (needs ${formatNumber((data.raw / f) * 100, 1)}%)</dd></div>
            <div class="result-details__divider" aria-hidden="true"></div>
            <div class="result-details__row"><dt>Maximum overall</dt><dd>${formatNumber(maxPct, 1)}% with ${f}/${f}</dd></div>
          </div>
          ${gapVisHtml(inputs, data)}
          ${explorerHtml(inputs, t)}
          ${whatIfHtml(inputs, data)}
          <div class="result-footnote"><strong>Okay — what is still possible?</strong> Click any achievable target above to instantly recalculate, or try ${formatNumber(Math.floor(maxPct), 0)}% as a nearby goal.</div>
          ${shareBarHtml()}
          <div class="result-actions">
            <button type="button" class="btn btn--outline" data-action="reset">Try another target</button>
            <button type="button" class="btn btn--primary" data-action="share">Copy result</button>
          </div>
        </div>
      `;
    } else {
      const roundedNote = data.needsRounding
        ? `We rounded up from ${formatNumber(data.raw, 1)} — you need the smallest whole mark that hits ${formatNumber(t, 0)}%.`
        : `Exactly ${formatNumber(data.raw, 1)} marks — no rounding needed.`;
      const bufferNote =
        buffer > 0
          ? `You have a <strong>${formatNumber(buffer, 0)}-mark margin</strong> above the minimum if you score ${f}/${f}. A score of ${Math.min(f, data.required + Math.ceil(buffer / 2))} gives you a ${Math.min(f, data.required + Math.ceil(buffer / 2)) - data.required}-mark safety margin.`
          : `You need a perfect or near-perfect final — no margin above the minimum.`;
      html = `
        <div class="result-card result--achievable" role="status" aria-live="polite">
          <div class="result-badge result-badge--success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
            Here’s what you need
          </div>
          <div class="result-main">
            <div class="result-main__label">You need</div>
            <div class="result-main__score"><div class="result-main__score-row">${data.required} <small>/ ${f}</small></div></div>
            <div class="result-main__percent"><strong>${formatNumber(neededPct, 1)}%</strong> on the final to finish with <strong>${formatNumber(t, 0)}% overall</strong></div>
            <p class="result-main__note">${roundedNote}</p>
            <div style="margin-top:10px; display:flex; justify-content:center;">
              <span class="buffer-line">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                ${formatNumber(buffer, 0)}-mark buffer to ${f}
              </span>
            </div>
            <p class="insight-line">${insightText}</p>
            <p class="insight-line" style="font-size:11px; opacity:0.9;">${bufferNote}</p>
          </div>

          <div class="exact-clarity">
            <div class="exact-clarity__box">
              <div class="exact-clarity__label">Exact requirement</div>
              <div class="exact-clarity__value">${formatNumber(data.raw, 1)} marks</div>
              <div style="font-size:11px; color:var(--color-body); margin-top:2px;">${formatNumber((data.raw / f) * 100, 1)}% on final</div>
            </div>
            <div class="exact-clarity__box exact-clarity__box--highlight">
              <div class="exact-clarity__label">Minimum whole-mark score</div>
              <div class="exact-clarity__value">${data.required} marks</div>
              <div style="font-size:11px; color:var(--color-body); margin-top:2px;">${formatNumber(neededPct, 1)}% — rounded up</div>
            </div>
          </div>

          ${auditGridHtml(inputs, data)}
          ${gapVisHtml(inputs, data)}

          <div class="weighting-notice" style="margin-top:4px;">
            <span class="weighting-notice__icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 8v5"/><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></svg></span>
            <div><strong>Check your weighting:</strong> This result assumes total points ( ${p} + ${f} = ${p + f} ). If your final is “worth 40% regardless of points”, ask your instructor or try the weighted calculator (coming soon).</div>
          </div>

          ${whatIfHtml(inputs, data)}
          ${explorerHtml(inputs, t)}
          ${shareBarHtml()}

          <div class="result-actions">
            <button type="button" class="btn btn--outline" data-action="reset">Reset</button>
            <button type="button" class="btn btn--primary" data-action="share">Copy result</button>
          </div>
        </div>
      `;
    }

    resultEl.innerHTML = html;

    // Wire result actions
    const resetBtn = resultEl.querySelector('[data-action="reset"]');
    resetBtn?.addEventListener('click', () => {
      form.reset();
      syncTarget(90, 'both');
      clearAllErrors();
      updateLiveSignal();
      clearUrl();
      renderEmpty();
      obtainedEl?.focus();
      if (window.innerWidth < 768) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const shareBtn = resultEl.querySelector('[data-action="share"]');
    shareBtn?.addEventListener('click', async () => {
      const text = buildShareText(data, inputs);
      const concise = buildWhatsAppLikeShare(data, inputs);
      // prefer concise for clipboard per spec? Use concise for WhatsApp, but full is more useful. Use concise as spec example.
      const toCopy = concise;
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(toCopy);
          showToast('Copied — paste to WhatsApp, Notes, Discord');
        } else throw new Error('no clipboard');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = toCopy;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Copied — paste to WhatsApp, Notes, Discord');
      }
    });

    // Copy link handler
    resultEl.querySelector('[data-action="copy-link"]')?.addEventListener('click', async () => {
      const url = shareUrlString();
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          showToast('Link copied — values are in the URL');
        } else throw new Error();
      } catch {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Link copied — values are in the URL');
      }
    });

    // Explorer wiring
    resultEl.querySelectorAll('[data-explorer-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tgt = btn.getAttribute('data-explorer-target');
        if (!tgt) return;
        syncTarget(tgt, 'both');
        updateLiveSignal();
        // resubmit with new target, keep other inputs
        const v = {
          obtained: obtainedEl.value.trim(),
          possible: possibleEl.value.trim(),
          finalTotal: finalTotalEl.value.trim(),
          target: tgt,
        };
        const { valid } = validateInputs(v);
        if (valid) {
          const nums = {
            obtained: Number(v.obtained),
            possible: Number(v.possible),
            finalTotal: Number(v.finalTotal),
            target: Number(v.target),
          };
          const r = calculateRequired(nums);
          updateUrl(v);
          renderResult(r, v);
          showToast(`Target set to ${tgt}%`);
        }
      });
    });

    // What-if wiring
    const whatRange = resultEl.querySelector('[data-whatif-range]');
    const whatDisplay = resultEl.querySelector('[data-whatif-display]');
    const whatOverall = resultEl.querySelector('[data-whatif-overall]');
    const whatNote = resultEl.querySelector('[data-whatif-note]');
    const whatChips = resultEl.querySelectorAll('[data-whatif]');
    function updateWhatIf(score) {
      const s = Number(score);
      const ov = overallForScore({ obtained: o, possible: p, finalTotal: f }, s);
      if (whatDisplay) whatDisplay.textContent = `${s} / ${f}`;
      if (whatOverall) whatOverall.textContent = `${formatNumber(ov, 1)}%`;
      if (whatNote) whatNote.textContent = `${o} + ${s} = ${o + s} / ${p + f} total`;
      whatChips.forEach((c) => {
        const cv = Number(c.getAttribute('data-whatif'));
        c.classList.toggle('is-active', cv === s);
      });
      if (whatRange && Number(whatRange.value) !== s) whatRange.value = String(s);
    }
    whatRange?.addEventListener('input', (e) => updateWhatIf(e.target.value));
    whatChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const sc = chip.getAttribute('data-whatif');
        updateWhatIf(sc);
        if (whatRange) whatRange.value = sc;
      });
    });

    // Announce to screen readers via live region fallback
    const live = document.getElementById('calc-live');
    if (live) {
      if (data.status === 'already') live.textContent = `You already have enough. You need 0 out of ${f} on the final.`;
      else if (data.status === 'impossible')
        live.textContent = `Target ${formatNumber(t, 0)} percent is not possible. Maximum overall is ${formatNumber(maxPct, 1)} percent. Gap ${formatNumber(impossibleGap(data, t), 1)} points.`;
      else live.textContent = `You need ${data.required} out of ${f}, which is ${formatNumber(neededPct, 1)} percent, to finish with ${formatNumber(t, 0)} percent. Exact ${formatNumber(data.raw, 1)}, minimum ${data.required}.`;
    }

    // Smooth scroll result into view on mobile if not visible
    if (window.innerWidth < 1024) {
      const rect = resultEl.getBoundingClientRect();
      if (rect.top > window.innerHeight - 120 || rect.bottom > window.innerHeight) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Update URL after success
    updateUrl(inputs);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    const values = {
      obtained: obtainedEl.value.trim(),
      possible: possibleEl.value.trim(),
      finalTotal: finalTotalEl.value.trim(),
      target: targetEl.value.trim(),
    };

    const { valid, errors } = validateInputs(values);
    if (!valid) {
      Object.entries(errors).forEach(([k, msg]) => showFieldError(k, msg));
      const firstErr = Object.keys(errors)[0];
      const el = document.getElementById(firstErr);
      el?.focus();
      // ensure error visible to screen reader
      const general = document.getElementById('calc-general-error');
      if (general) {
        general.textContent = 'Please fix the highlighted fields.';
        general.hidden = false;
        general.focus?.();
      }
      return;
    }

    const nums = {
      obtained: Number(values.obtained),
      possible: Number(values.possible),
      finalTotal: Number(values.finalTotal),
      target: Number(values.target),
    };
    const result = calculateRequired(nums);
    renderResult(result, values);
  });

  // Reset button
  form.querySelector('[data-reset]')?.addEventListener('click', () => {
    form.reset();
    syncTarget(90, 'both');
    clearAllErrors();
    updateLiveSignal();
    clearUrl();
    renderEmpty();
    obtainedEl?.focus();
  });

  // Example button -> fill example
  document.querySelector('[data-fill-example]')?.addEventListener('click', () => {
    obtainedEl.value = '72';
    possibleEl.value = '80';
    finalTotalEl.value = '100';
    syncTarget(90, 'both');
    clearAllErrors();
    updateLiveSignal();
    form.requestSubmit();
  });

  // Init display
  syncTarget(targetEl?.value || 90, 'both');
  renderEmpty();
  updateLiveSignal();

  // Restore from URL if present. Shared values are expected to be visible in the URL.
  const restored = parseQuery();
  if (restored) {
    const { valid } = validateInputs(restored);
    if (valid) {
      obtainedEl.value = restored.obtained;
      possibleEl.value = restored.possible;
      finalTotalEl.value = restored.finalTotal;
      syncTarget(restored.target, 'both');
      updateLiveSignal();
      // auto-calculate and show result without scrolling madness
      const nums = {
        obtained: Number(restored.obtained),
        possible: Number(restored.possible),
        finalTotal: Number(restored.finalTotal),
        target: Number(restored.target),
      };
      const r = calculateRequired(nums);
      // small timeout to let DOM settle
      setTimeout(() => renderResult(r, restored), 50);
      showToast('Restored calculation from link — values are visible in the URL');
    }
  }

  // Live recalc when result already shown (debounced)
  let debounce;
  [obtainedEl, possibleEl, finalTotalEl, targetEl, targetRangeEl].forEach((el) => {
    el?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (resultEl.querySelector('.result-card')) {
          const v = {
            obtained: obtainedEl.value.trim(),
            possible: possibleEl.value.trim(),
            finalTotal: finalTotalEl.value.trim(),
            target: targetEl.value.trim(),
          };
          const { valid } = validateInputs(v);
          if (valid) {
            const nums = {
              obtained: Number(v.obtained),
              possible: Number(v.possible),
              finalTotal: Number(v.finalTotal),
              target: Number(v.target),
            };
            renderResult(calculateRequired(nums), v);
          }
        }
      }, 400);
    });
  });
}

// ------------------------------------------------------------------
// Contact form (frontend-only, shows toast)
// ------------------------------------------------------------------
function initContact() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();
    let ok = true;
    const setErr = (id, msg) => {
      const el = document.getElementById(id + '-error');
      const input = document.getElementById(id);
      if (msg) {
        ok = false;
        if (el) {
          el.textContent = msg;
          el.classList.add('is-visible');
        }
        if (input) input.setAttribute('aria-invalid', 'true');
      } else {
        if (el) {
          el.textContent = '';
          el.classList.remove('is-visible');
        }
        if (input) input.removeAttribute('aria-invalid');
      }
    };
    setErr('c-name', !name ? 'Name is required.' : name.length < 2 ? 'Enter at least 2 characters.' : '');
    setErr('c-email', !email ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '');
    setErr('c-message', !message ? 'Message is required.' : message.length < 10 ? 'Message is too short — add a bit more detail.' : '');
    if (!ok) return;

    form.reset();
    showToast('Message ready — opening your email app…');
    const subject = encodeURIComponent(`GradeCalculator contact from ${name}`);
    const body = encodeURIComponent(message + `\n\n— ${name} (${email})`);
    setTimeout(() => {
      window.location.href = `mailto:yashkharb37@gmail.com?subject=${subject}&body=${body}`;
    }, 600);
  });
}

// ------------------------------------------------------------------
// Toast
// ------------------------------------------------------------------
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('is-visible'), 3000);
}

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------
initNav();
initCalculator();
initContact();

// Expose for testing
window.__calc = { calculateRequired, validateInputs, formatNumber, overallForScore, currentPercentage };
