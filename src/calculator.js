/**
 * Core calculation logic for "How Many Marks Do I Need to Get an A?"
 *
 * Model:
 * overall% = (obtained + finalObtained) / (possible + finalTotal) * 100
 * Solve for finalObtained:
 * required = ceil(target/100 * (possible + finalTotal) - obtained)
 */

export function calculateRequired({ obtained, possible, finalTotal, target }) {
  const raw = (target / 100) * (possible + finalTotal) - obtained;
  const required = Math.ceil(raw - 1e-9); // tiny epsilon to avoid 89.00000001 -> 90
  // If raw is integer within floating tolerance, ceil should stay
  // The epsilon above prevents unnecessary ceil bump when raw is e.g. 90.0000000001
  // But we still want true fractional 89.2 -> 90. So subtract epsilon before ceil.
  const maxPossible = obtained + finalTotal;
  const maxTotal = possible + finalTotal;
  const maxPercentage = (maxPossible / maxTotal) * 100;
  const minPercentage = (obtained / maxTotal) * 100;
  const requiredPercentage = finalTotal > 0 ? (required / finalTotal) * 100 : 0;

  let status;
  if (required <= 0) status = 'already';
  else if (required > finalTotal) status = 'impossible';
  else status = 'achievable';

  return {
    raw, // float before ceil
    required: Math.max(0, required), // clamped 0..finalTotal for display, but keep status logic above
    requiredClamped: Math.min(Math.max(0, required), finalTotal),
    requiredPercentage: Math.max(0, requiredPercentage),
    maxPercentage,
    minPercentage,
    maxPossible,
    maxTotal,
    status,
    needsRounding: raw !== Math.ceil(raw - 1e-9) && status === 'achievable',
  };
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
