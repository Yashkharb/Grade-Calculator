/**
 * Core calculation logic for "How Many Marks Do I Need to Get an A?"
 *
 * Model:
 * overall% = (obtained + finalObtained) / (possible + finalTotal) * 100
 * Solve for finalObtained:
 * required = ceil(target/100 * (possible + finalTotal) - obtained)
 *
 * Pure, deterministic, DOM-free. All UI logic lives in main.js.
 */

const EPS = 1e-9;

export function calculateRequired({ obtained, possible, finalTotal, target }) {
  const raw = (target / 100) * (possible + finalTotal) - obtained;
  const required = Math.ceil(raw - EPS);
  const maxPossible = obtained + finalTotal;
  const maxTotal = possible + finalTotal;
  const maxPercentage = maxTotal > 0 ? (maxPossible / maxTotal) * 100 : 0;
  const minPercentage = maxTotal > 0 ? (obtained / maxTotal) * 100 : 0;
  const requiredPercentage = finalTotal > 0 ? (required / finalTotal) * 100 : 0;

  let status;
  if (required <= 0) status = 'already';
  else if (required > finalTotal) status = 'impossible';
  else status = 'achievable';

  const clamped = Math.min(Math.max(0, required), finalTotal);
  const exactInt = Math.abs(raw - Math.round(raw)) < EPS;

  return {
    raw,
    required: Math.max(0, required),
    requiredClamped: clamped,
    requiredPercentage: Math.max(0, requiredPercentage),
    maxPercentage,
    minPercentage,
    maxPossible,
    maxTotal,
    status,
    needsRounding: !exactInt && status === 'achievable',
    exactRaw: Math.abs(raw - Math.round(raw)) < EPS ? Math.round(raw) : raw,
  };
}

/** Overall % if you score `score` on the final */
export function overallForScore({ obtained, possible, finalTotal }, score) {
  const total = possible + finalTotal;
  if (total === 0) return 0;
  return ((obtained + score) / total) * 100;
}

/** Current standing % (so far) */
export function currentPercentage({ obtained, possible }) {
  if (possible === 0) return 0;
  return (obtained / possible) * 100;
}

/** Buffer / margin if you ace the final */
export function bufferForAchievable({ finalTotal }, required) {
  return Math.max(0, finalTotal - required);
}

/** Gap when impossible */
export function impossibleGap({ maxPercentage, target }) {
  return Math.max(0, target - maxPercentage);
}

/** Generate scenario rows for What-if slider (for display only) */
export function whatIfScenarios(inputs, steps = [60, 70, 80, 90, 100]) {
  return steps.map((pct) => {
    const score = Math.round((pct / 100) * inputs.finalTotal);
    return {
      score,
      pctOfFinal: pct,
      overall: overallForScore(inputs, score),
    };
  });
}

/** Target explorer: for each target, what final is needed */
export function exploreTargets(inputs, targets = [60, 70, 80, 85, 90, 95, 100]) {
  return targets.map((t) => {
    const r = calculateRequired({ ...inputs, target: t });
    return {
      target: t,
      required: r.required,
      raw: r.raw,
      status: r.status,
      maxPercentage: r.maxPercentage,
    };
  });
}

/** Insight string: how required compares to current avg */
export function insight({ obtained, possible, finalTotal, target }, result) {
  if (result.status === 'impossible') return `Maximum overall is ${formatNumber(result.maxPercentage, 1)}% even with a perfect final.`;
  if (result.status === 'already') return `You already average ${formatNumber(currentPercentage({ obtained, possible }), 1)}% — no marks needed on the final.`;
  const cur = currentPercentage({ obtained, possible });
  const need = result.requiredPercentage;
  const diff = need - cur;
  if (Math.abs(diff) < 0.05) return `You need ${formatNumber(need, 1)}% on the final — exactly your current average.`;
  if (diff > 0) return `You need ${formatNumber(need, 1)}% on the final, ${formatNumber(Math.abs(diff), 1)} points above your current ${formatNumber(cur, 1)}% average.`;
  return `You need ${formatNumber(need, 1)}% on the final, ${formatNumber(Math.abs(diff), 1)} points below your current ${formatNumber(cur, 1)}% average.`;
}

export function validateInputs({ obtained, possible, finalTotal, target }) {
  const errors = {};

  const isEmpty = (v) => v === '' || v === null || v === undefined;
  const toNum = (v) => Number(v);

  // Helper to check numeric
  const check = (key, val, label) => {
    if (isEmpty(val)) {
      errors[key] = `${label} is required.`;
      return;
    }
    const n = toNum(val);
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      errors[key] = `Enter a valid number for ${label.toLowerCase()}.`;
      return;
    }
    if (n < 0) {
      errors[key] = `${label} cannot be negative.`;
      return;
    }
    if (n > 100000) {
      errors[key] = `${label} is too large. Keep it under 100,000.`;
      return;
    }
  };

  check('obtained', obtained, 'Marks you\u2019ve earned');
  check('possible', possible, 'Current marks possible');
  check('finalTotal', finalTotal, 'Final exam total');
  check('target', target, 'Target percentage');

  // Further logical checks if no emptiness/NaN errors
  const o = toNum(obtained);
  const p = toNum(possible);
  const f = toNum(finalTotal);
  const t = toNum(target);

  if (!errors.possible && !Number.isNaN(p) && p === 0) {
    errors.possible = 'Current marks possible cannot be 0.';
  }
  if (!errors.finalTotal && !Number.isNaN(f) && f === 0) {
    errors.finalTotal = 'Final exam total cannot be 0.';
  }
  if (!errors.target && !errors.obtained && !Number.isNaN(t)) {
    if (t > 100) errors.target = 'Target cannot be above 100%.';
    if (t < 0) errors.target = 'Target cannot be below 0%.';
    if (t === 0) errors.target = 'Target must be at least 1%.';
  }
  if (!errors.obtained && !errors.possible && !Number.isNaN(o) && !Number.isNaN(p)) {
    if (o > p) {
      errors.obtained = 'Marks earned can\u2019t be more than marks possible.';
    }
  }
  // Non-integer checks: allow decimals but warn? Spec says handle decimal inputs. No error, just handle via ceil.
  // But if inputs are like 72.5 / 80 we support.

  const valid = Object.keys(errors).length === 0;
  return { valid, errors };
}

export function formatNumber(n, decimals = 1) {
  return Number(n).toFixed(decimals).replace(/\.0+$/, '');
}
