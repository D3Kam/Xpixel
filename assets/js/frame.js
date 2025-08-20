/* assets/js/frame.js */
(() => {
  "use strict";

  // ========= Sector math by AREA =========
  // Center = 1% area -> side = sqrt(.01)*100 = 10%
  // Rings: 33% area each -> cumulative side lengths:
  const S_CENTER = 10.0;                           // 10% side
  const S_S3_OUT = Math.sqrt(0.34) * 100;          // ~58.3095% (Center + S3)
  const S_S2_OUT = Math.sqrt(0.67) * 100;          // ~81.8535% (Center + S3 + S2)
  const S_S1_OUT = 100.0;                           // full outer square

  // Stage 1: lock S2 + S3 + Center (i.e., everything inside S_S2_OUT)
  let LOCK_SIDE = S_S2_OUT;

  // Base design space (your UI assumes 1000 × 1000 "px")
  const BASE = 1000;

  // Default nudge step (design px) — adjustable via pad slider
  let MOVE_STEP_DESIGN = 10;
  const minStep = 1, maxStep = 20;

  const frame = document.getElementById("frame");
  if (!frame) return;

  /* ======================================
     Helpers
  ====================================== */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const toPct = (designPx) => clamp((designPx / BASE) * 100, 0.01, 100);
  const stepPct = () => (MOVE_STEP_DESIGN / BASE) * 100;

  function lockBounds(sidePct) {
    const m = (100 - sidePct) / 2; // margin from edge to lock square
    return { left: m, top: m, right: 100 - m, bottom: 100 - m, margin: m };
  }

  function intersects(a, b) {
    return !(
      a.right <= b.left ||
      a.left >= b.right ||
      a.bottom <= b.top ||
      a.top >= b.bottom
    );
  }

  function ensureMark() {
    let mark = frame.querySelector(".mark");
    if (!mark) {
      mark = document.createElement("div");
      mark.className = "mark";
      frame.appendChild(mark);
    }
    return mark;
  }

  function setSel(left, top, w, h) {
    const mark = ensureMark();
    mark.style.left = left + "%";
    mark.style.top = top + "%";
    mark.style.width = w + "%";
    mark.style.height = h + "%";
    return mark;
  }

  function rectFromMark(mark) {
    const left = parseFloat(mark.style.left) || 0;
    const top = parseFloat(mark.style.top) || 0;
    const w = parseFloat(mark.style.width) || 0;
    const h = parseFloat(mark.style.height) || 0;
    return { left, top, w, h, right: left + w, bottom: top + h };
  }

  // Small toast for feedback
  function toast(msg) {
    let el = document.getElementById("frameToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "frameToast";
      el.style.cssText = `
        position:absolute; left:50%; top:10px; transform:translateX(-50%);
        background: rgba(0,0,0,.75); color:#fff; padding:8px 12px;
        border-radius:8px; font:600 13px/1 var(--heading-font);
        z-index: 5; pointer-events:none; box-shadow:0 4px 14px rgba(0,0,0,.25);`;
      frame.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.opacity = "0"), 1500);
  }

  /* ======================================
     Visual overlays: sector boundaries + lock
  ====================================== */
  function addBoundary(sidePct, label) {
    const b = document.createElement("div");
    b.className = "boundary";
    b.style.width = sidePct + "%";
    b.style.height = sidePct + "%";
    const tag = document.createElement("span");
    tag.className = "sector-tag";
    tag.textContent = label;
    b.appendChild(tag);
    frame.appendChild(b);
  }

  function buildOverlaysOnce() {
    if (frame.querySelector(".boundary")) return; // avoid duplicates
    addBoundary(S_S1_OUT, "Sector 1 – 33% (unlocked)");
    addBoundary(S_S2_OUT, "Sector 2 – 33% (locked)");
    addBoundary(S_S3_OUT, "Sector 3 – 33% (locked)");
    addBoundary(S_CENTER, "Center – 1%");

    const lock = document.createElement("div");
    lock.className = "lock-overlay";
    lock.style.width = LOCK_SIDE + "%";
    lock.style.height = LOCK_SIDE + "%";

    const badge = document.createElement("div");
    badge.className = "lock-badge";
    badge.textContent = "Locked: Stage 2 & 3";
    lock.appendChild(badge);

    frame.appendChild(lock);
  }
  buildOverlaysOnce();

  /* ======================================
     Selection state (percent)
  ====================================== */
  const sel = { x: 0, y: 0, w: 0, h: 0 };
  let lastGood = { x: 0, y: 0, w: 0, h: 0 };

  function apply() { setSel(sel.x, sel.y, sel.w, sel.h); }

  function validateOrSnapOutside() {
    const lb = lockBounds(LOCK_SIDE);
    const mark = ensureMark();
    const r = rectFromMark(mark);

    if (!intersects(r, lb)) {
      lastGood = { ...sel };
      return true;
    }

    // If selection is too big to fit anywhere in the ring, revert.
    const ring = lb.margin; // thickness of outer ring
    if (sel.w > ring && sel.h > ring) {
      Object.assign(sel, lastGood);
      apply();
      mark.classList.add("is-invalid");
      setTimeout(() => mark.classList.remove("is-invalid"), 420);
      toast("Selection is too large to fit in Sector 1.");
      return false;
    }

    // Try snapping to nearest valid band (top/bottom/left/right)
    const candidates = [];

    if (sel.h <= ring) {
      // TOP band
      candidates.push({
        x: clamp(sel.x, 0, 100 - sel.w),
        y: clamp(sel.y, 0, lb.top - sel.h),
      });
      // BOTTOM band
      candidates.push({
        x: clamp(sel.x, 0, 100 - sel.w),
        y: clamp(Math.max(sel.y, lb.bottom), lb.bottom, 100 - sel.h),
      });
    }

    if (sel.w <= ring) {
      // LEFT band
      candidates.push({
        x: clamp(sel.x, 0, lb.left - sel.w),
        y: clamp(sel.y, 0, 100 - sel.h),
      });
      // RIGHT band
      candidates.push({
        x: clamp(Math.max(sel.x, lb.right), lb.right, 100 - sel.w),
        y: clamp(sel.y, 0, 100 - sel.h),
      });
    }

    // Choose candidate with smallest shift
    const ox = sel.x, oy = sel.y;
    let best = null, bestD = Infinity;

    for (const c of candidates) {
      const test = { left: c.x, top: c.y, right: c.x + sel.w, bottom: c.y + sel.h };
      if (!intersects(test, lb)) {
        const d = Math.hypot(c.x - ox, c.y - oy);
        if (d < bestD) { bestD = d; best = c; }
      }
    }

    if (best) {
      sel.x = best.x; sel.y = best.y; apply();
      lastGood = { ...sel };
      toast("Position adjusted to Sector 1.");
      return true;
    }

    // Restore previous
    Object.assign(sel, lastGood);
    apply();
    mark.classList.add("is-invalid");
    setTimeout(() => mark.classList.remove("is-invalid"), 420);
    toast("Only Sector 1 (outer ring) is available in Stage 1.");
    return false;
  }

  // Nudge by % (used by pad + keyboard)
  function nudge(dxPct, dyPct) {
    sel.x = clamp(sel.x + dxPct, 0, 100 - sel.w);
    sel.y = clamp(sel.y + dyPct, 0, 100 - sel.h);
    apply();
    validateOrSnapOutside();
  }

  /* ======================================
     Public API (keeps your existing hooks)
  ====================================== */

  // 1) Create mark sized by design px (e.g., 10×10 -> 1%×1%)
  window.markArea = (wDesign, hDesign) => {
    const w = toPct(wDesign);
    const h = toPct(hDesign);

    // Start in Sector 1 (outer ring) top-left band with a small pad
    const lb = lockBounds(LOCK_SIDE);
    const pad = 1; // 1% padding
    const x = clamp((lb.left - w) / 2, pad, lb.left - w);
    const y = clamp((lb.top  - h) / 2, pad, lb.top  - h);

    sel.w = w; sel.h = h;
    sel.x = clamp(x, 0, 100 - w);
    sel.y = clamp(y, 0, 100 - h);
    apply();
    validateOrSnapOutside();
  };

  // 2) Custom values (still design px)
  window.markCustom = () => {
    const w = parseInt(document.getElementById("customWidth")?.value, 10);
    const h = parseInt(document.getElementById("customHeight")?.value, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      alert("Please enter valid dimensions.");
      return;
    }
    window.markArea(w, h);
  };

  // 3) Compatibility: if your existing arrows still call this, keep it as 250px per click
  window.repositionArea = (dir) => {
    const s = stepPct(); // current step (defaults to 250px -> 25%)
    switch (dir) {
      case "top-left":       nudge(-s, -s); break;
      case "top-middle":     nudge( 0, -s); break;
      case "top-right":      nudge( s, -s); break;
      case "middle-left":    nudge(-s,  0); break;
      case "middle-middle":  /* no-op */    break;
      case "middle-right":   nudge( s,  0); break;
      case "bottom-left":    nudge(-s,  s); break;
      case "bottom-middle":  nudge( 0,  s); break;
      case "bottom-right":   nudge( s,  s); break;
    }
  };

  // 4) Image upload fills the marked area
  window.uploadImage = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const mark = ensureMark();
      mark.innerHTML = "";
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      mark.appendChild(img);
    };
    reader.readAsDataURL(file);
  };

  // Optional: stage switching
  window.setXpixelStage = (stage /* 1|2|3 */) => {
    if (stage === 1) LOCK_SIDE = S_S2_OUT;       // lock S2+S3+Center
    else if (stage === 2) LOCK_SIDE = S_S3_OUT;  // lock S3+Center
    else LOCK_SIDE = S_CENTER;                   // lock Center only

    const lock = frame.querySelector(".lock-overlay");
    if (lock) {
      lock.style.width = LOCK_SIDE + "%";
      lock.style.height = LOCK_SIDE + "%";
      const badge = lock.querySelector(".lock-badge");
      if (badge) {
        badge.textContent =
          stage === 1 ? "Locked: Stage 2 & 3"
        : stage === 2 ? "Locked: Stage 3"
        : "Locked: Center";
      }
    }
    validateOrSnapOutside();
  };

  /* ======================================
     Floating Position Pad (drag + hold)
  ====================================== */

  function buildPad() {
    if (document.getElementById("positionPad")) return;

    const pad = document.createElement("div");
    pad.className = "position-pad";
    pad.id = "positionPad";
    pad.innerHTML = `
      <div class="pad-head" id="padDragHandle">
        <span class="pad-title">Move</span>
        <div class="pad-actions">
          <button class="btn-ico" id="padCollapse" aria-label="Minimize">–</button>
        </div>
      </div>
      <div class="pad-body">
        <div class="pad-grid" aria-label="Move selection">
          <button data-dir="top-left"      aria-label="Up Left">↖</button>
          <button data-dir="top-middle"    aria-label="Up">↑</button>
          <button data-dir="top-right"     aria-label="Up Right">↗</button>
          <button data-dir="middle-left"   aria-label="Left">←</button>
          <button data-dir="middle-middle" aria-label="No move">•</button>
          <button data-dir="middle-right"  aria-label="Right">→</button>
          <button data-dir="bottom-left"   aria-label="Down Left">↙</button>
          <button data-dir="bottom-middle" aria-label="Down">↓</button>
          <button data-dir="bottom-right"  aria-label="Down Right">↘</button>
        </div>
        <label class="pad-step">
          <span>Step</span>
          <input type="range" id="padStep" min="${minStep}" max="${maxStep}" step="5" value="${MOVE_STEP_DESIGN}">
          <output id="padStepOut">${MOVE_STEP_DESIGN}</output>
        </label>
      </div>
    `;
    document.body.appendChild(pad);

    // Collapse toggle
    pad.querySelector("#padCollapse").addEventListener("click", () => {
      pad.classList.toggle("is-collapsed");
    });

    // Step control
    const stepInput = pad.querySelector("#padStep");
    const stepOut   = pad.querySelector("#padStepOut");
    stepInput.addEventListener("input", () => {
      MOVE_STEP_DESIGN = clamp(parseInt(stepInput.value, 1) || 10, minStep, maxStep);
      stepOut.textContent = `${MOVE_STEP_DESIGN}`;
    });

    // Press-and-hold behavior for directional buttons
    const dirButtons = pad.querySelectorAll(".pad-grid button");
    dirButtons.forEach(btn => {
      const dir = btn.getAttribute("data-dir");
      let rafId = null, down = false, lastTime = 0;

      const stepMove = () => {
        if (!down) return;
        const s = stepPct();
        switch (dir) {
          case "top-left":       nudge(-s, -s); break;
          case "top-middle":     nudge( 0, -s); break;
          case "top-right":      nudge( s, -s); break;
          case "middle-left":    nudge(-s,  0); break;
          case "middle-middle":  /* no-op */    break;
          case "middle-right":   nudge( s,  0); break;
          case "bottom-left":    nudge(-s,  s); break;
          case "bottom-middle":  nudge( 0,  s); break;
          case "bottom-right":   nudge( s,  s); break;
        }
        rafId = requestAnimationFrame(stepMove);
      };

      const start = (e) => {
        e.preventDefault();
        down = true;
        // initial move immediately
        const s = stepPct();
        switch (dir) {
          case "top-left":       nudge(-s, -s); break;
          case "top-middle":     nudge( 0, -s); break;
          case "top-right":      nudge( s, -s); break;
          case "middle-left":    nudge(-s,  0); break;
          case "middle-middle":  break;
          case "middle-right":   nudge( s,  0); break;
          case "bottom-left":    nudge(-s,  s); break;
          case "bottom-middle":  nudge( 0,  s); break;
          case "bottom-right":   nudge( s,  s); break;
        }
        rafId = requestAnimationFrame(stepMove);
      };
      const stop = () => {
        down = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      };

      btn.addEventListener("pointerdown", start);
      window.addEventListener("pointerup", stop);
      btn.addEventListener("pointerleave", stop);
      btn.addEventListener("pointercancel", stop);
    });

    // Drag the pad via the header
    const handle = pad.querySelector("#padDragHandle");
    let dragging = false, offX = 0, offY = 0;

    const onDown = (e) => {
      dragging = true;
      pad.style.transition = "none";
      const rect = pad.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const x = clamp(e.clientX - offX, 6, window.innerWidth  - pad.offsetWidth  - 6);
      const y = clamp(e.clientY - offY, 6, window.innerHeight - pad.offsetHeight - 6);
      pad.style.left = x + "px";
      pad.style.top  = y + "px";
      pad.style.right = "auto";
      pad.style.bottom = "auto";
      pad.style.transform = "none";
    };
    const onUp = () => { dragging = false; };

    handle.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Keyboard nudges (works when page focused)
  function bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      const fast = e.shiftKey ? 2 : 1;          // Shift = faster
      const fine = e.altKey   ? 0.2 : 1;        // Alt   = finer
      const s = stepPct() * fast * fine;

      if (["arrowup","w","arrowdown","s","arrowleft","a","arrowright","d"].includes(k)) {
        e.preventDefault();
        if (k === "arrowup" || k === "w")        nudge( 0, -s);
        if (k === "arrowdown" || k === "s")      nudge( 0,  s);
        if (k === "arrowleft" || k === "a")      nudge(-s,  0);
        if (k === "arrowright" || k === "d")     nudge( s,  0);
      }
    }, { passive: false });
  }

  /* ======================================
     Init
  ====================================== */
  // First mark MUST be 10×10 design px in Sector 1
  window.markArea(10, 10);

  // Build the floating pad + keyboard controls
  buildPad();
  bindKeyboard();
})();
