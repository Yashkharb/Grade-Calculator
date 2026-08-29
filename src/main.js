import './styles.css';
import { calculateRequired, validateInputs, formatNumber } from './calculator.js';

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
  }

  toggle.addEventListener('click', () => {
    const isOpen = drawer.classList.contains('is-open');
    setOpen(!isOpen);
  });

  // Close on link click or escape
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false);
  });
  // Close on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 880 && drawer.classList.contains('is-open')) setOpen(false);
  });
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

  // Sync target inputs
  function syncTarget(value, source) {
    const v = String(value);
    if (source !== 'range' && targetRangeEl) targetRangeEl.value = v;
    if (source !== 'number' && targetEl) targetEl.value = v;
    updatePresetActive(Number(v));
    // Update large display
    const disp = document.querySelector('[data-target-display]');
    if (disp) disp.textContent = `${formatNumber(Number(v), 0)}%`;
  }

  function updatePresetActive(val) {
    presetBtns.forEach(b => {
      const pv = Number(b.dataset.preset);
      b.classList.toggle('is-active', pv === val);
      b.setAttribute('aria-pressed', String(pv === val));
    });
  }

  targetEl?.addEventListener('input', (e) => {
    syncTarget(e.target.value, 'number');
    clearFieldError('target');
  });
  targetRangeEl?.addEventListener('input', (e) => {
    syncTarget(e.target.value, 'range');
    clearFieldError('target');
  });
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      syncTarget(btn.dataset.preset, 'both');
      clearFieldError('target');
    });
  });

  // Clear errors on input
  [obtainedEl, possibleEl, finalTotalEl].forEach(el => {
    el?.addEventListener('input', () => clearFieldError(el.id));
  });

  function clearFieldError(id) {
    const input = document.getElementById(id);
    const errEl = document.getElementById(`${id}-error`);
    if (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
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
    ['obtained','possible','finalTotal','target'].forEach(clearFieldError);
    const general = document.getElementById('calc-general-error');
    if (general) { general.textContent=''; general.hidden=true; }
  }

  function renderEmpty() {
    if (!resultEl) return;
    resultEl.innerHTML = `
      <div class="result-empty">
        <div class="result-empty__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h5M8 18h5"/></svg>
        </div>
        <h3 class="result-empty__title">Enter your marks to see what you need</h3>
        <p class="result-empty__text">Fill in your current marks, the final exam total, and your target. We’ll tell you the exact marks required — instantly.</p>
        <div class="result-empty__example">
          <div class="result-empty__example-label">Try this example</div>
          <dl class="result-empty__example-grid">
            <dt>Current</dt><dd>72 / 80</dd>
            <dt>Final exam</dt><dd>100 marks</dd>
            <dt>Target</dt><dd>90%</dd>
            <dt><strong>You need</strong></dt><dd><strong>90 / 100</strong></dd>
          </dl>
        </div>
      </div>
    `;
  }

  function renderResult(data, inputs) {
    if (!resultEl) return;
    const { obtained, possible, finalTotal, target } = inputs;
    const o = Number(obtained), p = Number(possible), f = Number(finalTotal), t = Number(target);
    const currentPct = (o / p) * 100;
    const maxPct = data.maxPercentage;
    const neededPct = data.requiredPercentage;

    let html = '';

    if (data.status === 'already') {
      const currentOverallWithZero = (o / (p + f)) * 100;
      html = `
        <div class="result-card result--already" role="status" aria-live="polite">
          <div class="result-badge result-badge--success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
            Already there
          </div>
          <div class="result-main">
            <div class="result-main__label">Your required final score</div>
            <div class="result-main__score">0 <small>/ ${f}</small></div>
            <div class="result-main__percent">You already have enough for <strong>${formatNumber(t,0)}%</strong> overall.</div>
            <p class="result-main__note">Even with 0 on the final, you finish at <strong>${formatNumber(currentOverallWithZero,1)}%</strong>. Anything you earn just adds a buffer.</p>
          </div>
          <dl class="result-details">
            <div class="result-details__row"><dt>Current</dt><dd>${o} / ${p} (${formatNumber(currentPct,1)}%)</dd></div>
            <div class="result-details__row"><dt>Target overall</dt><dd>${formatNumber(t,0)}%</dd></div>
            <div class="result-details__row"><dt>Final needed</dt><dd>0 / ${f} (0%)</dd></div>
            <div class="result-details__divider" aria-hidden="true"></div>
            <div class="result-details__row"><dt>Max possible overall</dt><dd>${formatNumber(maxPct,1)}%</dd></div>
          </dl>
          <div class="result-footnote">Nice work — you can walk into the final with no pressure. Still aim to do your best to keep your current average strong.</div>
          <div class="result-actions">
            <button type="button" class="btn btn--outline" data-action="reset">Start over</button>
            <button type="button" class="btn btn--primary" data-action="share">Copy result</button>
          </div>
        </div>
      `;
    } else if (data.status === 'impossible') {
      html = `
        <div class="result-card result--impossible" role="status" aria-live="polite">
          <div class="result-badge result-badge--error">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
            Not possible
          </div>
          <div class="result-main">
            <div class="result-main__label">An A is no longer mathematically possible</div>
            <div class="result-main__score">${f} <small>/ ${f}</small></div>
            <div class="result-main__percent">Even with <strong>${f}/${f} (100%)</strong> you reach <strong>${formatNumber(maxPct,1)}%</strong>, short of <strong>${formatNumber(t,0)}%</strong>.</div>
            <p class="result-main__note">Required was <strong>${formatNumber(data.raw,1)} marks</strong> — more than the final offers. Consider adjusting your target or speaking to your instructor about grading options.</p>
          </div>
          <dl class="result-details">
            <div class="result-details__row"><dt>Current</dt><dd>${o} / ${p} (${formatNumber(currentPct,1)}%)</dd></div>
            <div class="result-details__row"><dt>Target overall</dt><dd>${formatNumber(t,0)}%</dd></div>
            <div class="result-details__row"><dt>Final needed</dt><dd>${formatNumber(data.raw,1)} / ${f} (needs ${formatNumber((data.raw/f)*100,1)}%)</dd></div>
            <div class="result-details__divider" aria-hidden="true"></div>
            <div class="result-details__row"><dt>Maximum overall</dt><dd>${formatNumber(maxPct,1)}% with ${f}/${f}</dd></div>
          </dl>
          <div class="result-footnote">This assumes current + final are weighted equally by total marks. If your course weights them differently, check your syllabus and adjust.</div>
          <div class="result-actions">
            <button type="button" class="btn btn--outline" data-action="reset">Try another target</button>
            <button type="button" class="btn btn--primary" data-action="share">Copy result</button>
          </div>
        </div>
      `;
    } else {
      const roundedNote = data.needsRounding
        ? `We rounded up from ${formatNumber(data.raw,1)} — you need the smallest whole mark that hits ${formatNumber(t,0)}%.`
        : `Exactly ${formatNumber(data.raw,1)} marks — no rounding needed.`;
      html = `
        <div class="result-card result--achievable" role="status" aria-live="polite">
          <div class="result-badge result-badge--success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
            Here’s what you need
          </div>
          <div class="result-main">
            <div class="result-main__label">You need</div>
            <div class="result-main__score">${data.required} <small>/ ${f}</small></div>
            <div class="result-main__percent"><strong>${formatNumber(neededPct,1)}%</strong> on the final to finish with <strong>${formatNumber(t,0)}% overall</strong></div>
            <p class="result-main__note">${roundedNote}</p>
          </div>
          <dl class="result-details">
            <div class="result-details__row"><dt>Current score</dt><dd>${o} / ${p} (${formatNumber(currentPct,1)}%)</dd></div>
            <div class="result-details__row"><dt>Target overall</dt><dd>${formatNumber(t,0)}%</dd></div>
            <div class="result-details__row"><dt>Required final</dt><dd>${data.required} / ${f} (${formatNumber(neededPct,1)}%)</dd></div>
            <div class="result-details__divider" aria-hidden="true"></div>
            <div class="result-details__row"><dt>Overall if you hit it</dt><dd>${formatNumber(t,1)}% exactly</dd></div>
            <div class="result-details__row"><dt>Overall if you ace it</dt><dd>${formatNumber(maxPct,1)}% with ${f}/${f}</dd></div>
          </dl>
          <div class="result-actions">
            <button type="button" class="btn btn--outline" data-action="reset">Reset</button>
            <button type="button" class="btn btn--primary" data-action="share">Copy result</button>
          </div>
        </div>
      `;
    }

    resultEl.innerHTML = html;

    // Wire result actions
    resultEl.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      form.reset();
      syncTarget(90, 'both');
      clearAllErrors();
      renderEmpty();
      obtainedEl?.focus();
      // scroll to form on mobile
      if (window.innerWidth < 768) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    resultEl.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
      const text = resultEl.innerText.replace(/\s+/g, ' ').trim().slice(0, 400);
      // Build share text
      let shareText = '';
      if (data.status === 'already') shareText = `I already have enough for ${formatNumber(t,0)}% — need 0/${f} on the final! (Current: ${o}/${p})`;
      else if (data.status === 'impossible') shareText = `An A (${formatNumber(t,0)}%) is no longer possible — max is ${formatNumber(maxPct,1)}% even with ${f}/${f}. Current: ${o}/${p}`;
      else shareText = `I need ${data.required}/${f} (${formatNumber(neededPct,1)}%) on the final to finish with ${formatNumber(t,0)}% overall. Current: ${o}/${p}`;
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
          showToast('Copied to clipboard');
        } else throw new Error('no clipboard');
      } catch {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = shareText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Copied to clipboard');
      }
    });

    // Announce to screen readers via live region fallback
    const live = document.getElementById('calc-live');
    if (live) {
      if (data.status === 'already') live.textContent = `You already have enough. You need 0 out of ${f} on the final.`;
      else if (data.status === 'impossible') live.textContent = `An A is not possible. Maximum overall is ${formatNumber(maxPct,1)} percent.`;
      else live.textContent = `You need ${data.required} out of ${f}, which is ${formatNumber(neededPct,1)} percent, to finish with ${formatNumber(t,0)} percent.`;
    }

    // Smooth scroll result into view on mobile if not visible
    if (window.innerWidth < 1024) {
      const rect = resultEl.getBoundingClientRect();
      if (rect.top > window.innerHeight - 120 || rect.bottom > window.innerHeight) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
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
      document.getElementById(firstErr)?.focus();
      const general = document.getElementById('calc-general-error');
      if (general) {
        general.textContent = 'Please fix the highlighted fields.';
        general.hidden = false;
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
    renderEmpty();
  });

  // Example button -> fill example
  document.querySelector('[data-fill-example]')?.addEventListener('click', () => {
    obtainedEl.value = '72';
    possibleEl.value = '80';
    finalTotalEl.value = '100';
    syncTarget(90, 'both');
    clearAllErrors();
    // auto calculate
    form.requestSubmit();
  });

  // Init display
  syncTarget(targetEl?.value || 90, 'both');
  renderEmpty();

  // Live calculation on input? Only if form already shows result? Let's keep explicit submit for a11y, but also update on the fly if result visible
  // Optional: debounce live update
  let debounce;
  [obtainedEl, possibleEl, finalTotalEl, targetEl, targetRangeEl].forEach(el => {
    el?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        // Only auto-recalculate if a result is already shown and inputs are valid
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
    const name = String(data.get('name')||'').trim();
    const email = String(data.get('email')||'').trim();
    const message = String(data.get('message')||'').trim();
    let ok = true;
    const setErr = (id, msg) => {
      const el = document.getElementById(id+'-error');
      const input = document.getElementById(id);
      if (msg) {
        ok=false;
        if (el) { el.textContent=msg; el.classList.add('is-visible'); }
        if (input) input.setAttribute('aria-invalid','true');
      } else {
        if (el) { el.textContent=''; el.classList.remove('is-visible'); }
        if (input) input.removeAttribute('aria-invalid');
      }
    };
    setErr('c-name', !name ? 'Name is required.' : name.length<2 ? 'Enter at least 2 characters.' : '');
    setErr('c-email', !email ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '');
    setErr('c-message', !message ? 'Message is required.' : message.length<10 ? 'Message is too short — add a bit more detail.' : '');
    if (!ok) return;

    // Simulate success: show toast, reset, offer mailto fallback
    form.reset();
    showToast('Message ready — opening your email app…');
    const subject = encodeURIComponent(`GradeCalculator contact from ${name}`);
    const body = encodeURIComponent(message + `\n\n— ${name} (${email})`);
    // Slight delay so toast is seen
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
    t.setAttribute('role','status');
    t.setAttribute('aria-live','polite');
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
window.__calc = { calculateRequired, validateInputs };
