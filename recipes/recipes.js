/* ============================================================
   jncybr.com — Recipes
   Progressive enhancement only: every page reads fine without it.
   - Listing pages: instant search
   - Recipe pages: servings scaler, ingredient and step check-off
     (remembered for this tab), print, keep-screen-on
   ============================================================ */
(() => {
    'use strict';

    const $ = (sel, el = document) => el.querySelector(sel);
    const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

    /* ---------- Search ---------- */

    const searchBox = $('[data-search-box]');
    if (searchBox) {
        const input = $('input', searchBox);
        const cards = $$('[data-search]');
        const empty = $('[data-empty]');
        searchBox.hidden = false;

        const run = () => {
            const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            let shown = 0;
            for (const c of cards) {
                const hit = terms.every(t => c.dataset.search.includes(t));
                c.hidden = !hit;
                if (hit) shown++;
            }
            if (empty) {
                empty.hidden = shown > 0;
                $('[data-q]', empty).textContent = input.value.trim();
            }
        };

        input.addEventListener('input', run);
        document.addEventListener('keydown', e => {
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
            if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                input.focus();
            } else if (e.key === 'Escape' && document.activeElement === input) {
                input.value = '';
                run();
                input.blur();
            }
        });
    }

    /* ---------- Recipe page ---------- */

    const recipe = $('[data-recipe]');
    if (!recipe) return;

    const storeKey = `recipe:${recipe.dataset.recipe}`;
    let state = {};
    try { state = JSON.parse(sessionStorage.getItem(storeKey)) || {}; } catch { /* private mode */ }
    const save = () => {
        try { sessionStorage.setItem(storeKey, JSON.stringify(state)); } catch { /* ignore */ }
    };

    // Ingredients: check off as you go
    const checks = $$('.ing__check', recipe);
    for (const i of state.ing || []) if (checks[i]) checks[i].checked = true;
    for (const c of checks) {
        c.addEventListener('change', () => {
            state.ing = checks.flatMap((x, i) => (x.checked ? [i] : []));
            save();
        });
    }

    // Steps: tap anywhere on a step to mark it done
    const steps = $$('.step', recipe);
    const setDone = (step, done) => {
        step.classList.toggle('is-done', done);
        $('.step__num', step).setAttribute('aria-pressed', String(done));
    };
    for (const i of state.steps || []) if (steps[i]) setDone(steps[i], true);
    for (const step of steps) {
        step.addEventListener('click', e => {
            if (e.target.closest('a')) return;
            if (!e.target.closest('button') && String(window.getSelection())) return; // let people select text
            setDone(step, !step.classList.contains('is-done'));
            state.steps = steps.flatMap((s, i) => (s.classList.contains('is-done') ? [i] : []));
            save();
        });
    }

    // Servings scaler
    const control = $('[data-servings-control]', recipe);
    if (control) {
        const base = Number(control.dataset.base);
        // Big yields (18 cookies) step in half-batches so amounts stay sane.
        const stepBy = base > 12 ? Math.max(1, Math.round(base / 2)) : 1;
        const unit = control.dataset.unit;
        const unitOne = control.dataset.unitOne;
        const out = $('[data-servings]', control);
        const unitEl = $('[data-servings-unit]', control);
        const [minus, plus] = $$('.servings__btn', control);
        const note = $('[data-scale-note]', recipe);
        const qtys = $$('.qty', recipe);
        for (const q of qtys) q.dataset.orig = q.textContent;

        let count = Number(state.servings) || base;

        const render = () => {
            const factor = count / base;
            for (const q of qtys) {
                if (factor === 1) { q.textContent = q.dataset.orig; continue; }
                const fmt = q.dataset.unit ? formatMeasure : formatAmount;
                const a = fmt(Number(q.dataset.qty) * factor, q.dataset.unit);
                q.textContent = q.dataset.qtyMax ? `${a}–${fmt(Number(q.dataset.qtyMax) * factor, q.dataset.unit)}` : a;
            }
            out.textContent = count;
            unitEl.textContent = count === 1 ? unitOne : unit;
            minus.disabled = count - stepBy < 1;
            note.hidden = factor === 1;
            $('[data-factor]', note).textContent = `×${+factor.toFixed(2)} from ${base}`;
            recipe.classList.toggle('is-scaled', factor !== 1);
        };

        const set = n => {
            count = Math.max(1, n);
            state.servings = count === base ? undefined : count;
            save();
            render();
        };

        minus.addEventListener('click', () => set(count - stepBy));
        plus.addEventListener('click', () => set(count + stepBy));
        $('[data-scale-reset]', note).addEventListener('click', () => set(base));

        control.hidden = false;
        render();
    }

    // Print
    $('[data-action="print"]', recipe)?.addEventListener('click', () => window.print());

    // Keep the screen awake while cooking
    const wakeBtn = $('[data-action="wake"]', recipe);
    if (wakeBtn && 'wakeLock' in navigator) {
        let lock = null;
        let wanted = false;
        const update = () => wakeBtn.setAttribute('aria-pressed', String(wanted && !!lock));
        const acquire = async () => {
            try {
                lock = await navigator.wakeLock.request('screen');
                lock.addEventListener('release', () => { lock = null; update(); });
            } catch {
                wanted = false;
            }
            update();
        };
        wakeBtn.addEventListener('click', async () => {
            wanted = !wanted;
            if (wanted) await acquire();
            else { await lock?.release(); lock = null; update(); }
        });
        document.addEventListener('visibilitychange', () => {
            if (wanted && !lock && document.visibilityState === 'visible') acquire();
        });
        wakeBtn.hidden = false;
    }

    /* ---------- Number formatting (keep in sync with scripts/build-recipes.mjs) ---------- */

    function formatAmount(n) {
        const NICE = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];
        if (n >= 20) return String(Math.round(n));
        let whole = Math.floor(n);
        const frac = n - whole;
        let best = NICE[0];
        let bestDiff = Infinity;
        for (const f of NICE) {
            const d = Math.abs(frac - f[0]);
            if (d < bestDiff) { best = f; bestDiff = d; }
        }
        // Snap to a kitchen fraction when it's within 10% (or a hair) of the real amount.
        if (bestDiff > Math.max(0.03, n * 0.1)) return String(+n.toFixed(n < 1 ? 2 : 1));
        if (best[0] === 1) { whole += 1; best = NICE[0]; }
        if (!whole && !best[1]) return String(+n.toFixed(2));
        return (whole ? String(whole) : '') + best[1];
    }

    function formatMeasure(n, unit) {
        if (/^(oz|lb|lbs)$/.test(unit)) return formatAmount(n);
        if (/^(kg|l|L)$/.test(unit)) return String(+n.toFixed(n < 10 ? 2 : 1));
        if (n < 10) return String(+n.toFixed(1));
        if (n < 100) return String(Math.round(n));
        return String(Math.round(n / 5) * 5);
    }
})();
