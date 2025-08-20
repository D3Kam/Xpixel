/* assets/js/frame.js */
(() => {
  "use strict";

  // ===== Sector math by AREA =====
  const S_CENTER = 10.0;                           // 10% side (center = 1% area)
  const S_S3_OUT = Math.sqrt(0.34) * 100;          // ~58.3095% (center + S3)
  const S_S2_OUT = Math.sqrt(0.67) * 100;          // ~81.8535% (center + S3 + S2)
  const S_S1_OUT = 100.0;

  // Unlock levels:
  // 1 -> unlock S1 only (lock S2+S3+Center)
  // 2 -> unlock S1+S2     (lock S3+Center)
  // 3 -> unlock S1+S2+S3  (lock Center)
  // 4 -> unlock ALL       (no lock)
  let UNLOCK_LEVEL = 1;
  let LOCK_SIDE = S_S2_OUT;

  const BASE = 1000;             // design space 1000×1000
  let MOVE_STEP_DESIGN = 10;    // default step; adjustable
  const MIN_STEP = 1, MAX_STEP = 20;

  const frame = document.getElementById("frame");
  if (!frame) return;

  const isMobile = () => window.matchMedia("(max-width: 767.98px)").matches;

  /* ---------- helpers ---------- */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const toPct = (designPx) => clamp((designPx / BASE) * 100, 0.01, 100);
  const stepPct = () => (MOVE_STEP_DESIGN / BASE) * 100;

  function lockBounds(sidePct) {
    if (sidePct <= 0) return null; // fully unlocked
    const m = (100 - sidePct) / 2;
    return { left: m, top: m, right: 100 - m, bottom: 100 - m, margin: m };
    // margin = ring thickness
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
    const top  = parseFloat(mark.style.top)  || 0;
    const w    = parseFloat(mark.style.width) || 0;
    const h    = parseFloat(mark.style.height) || 0;
    return { left, top, w, h, right: left + w, bottom: top + h };
  }

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

  /* ---------- visuals: boundaries + lock ---------- */
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

  function updateLockOverlay() {
    let lock = frame.querySelector(".lock-overlay");
    if (!lock && LOCK_SIDE > 0) {
      lock = document.createElement("div");
      lock.className = "lock-overlay";
      frame.appendChild(lock);
    }
    if (lock) {
      if (LOCK_SIDE <= 0) {
        lock.remove();
      } else {
        lock.style.width = LOCK_SIDE + "%";
        lock.style.height = LOCK_SIDE + "%";
        let badge = lock.querySelector(".lock-badge");
        if (!badge) {
          badge = document.createElement("div");
          badge.className = "lock-badge";
          lock.appendChild(badge);
        }
        badge.textContent =
          UNLOCK_LEVEL === 1 ? "Locked: Stage 2 & 3"
        : UNLOCK_LEVEL === 2 ? "Locked: Stage 3"
        : "Locked: Center";
      }
    }
  }

  function buildOverlaysOnce() {
    if (!frame.querySelector(".boundary")) {
      addBoundary(S_S2_OUT, "Sector 2 – 33% (locked)");
      addBoundary(S_S3_OUT, "Sector 3 – 33% (locked)");
      addBoundary(S_CENTER, "Center – 1%");
    }
    updateLockOverlay();
  }
  buildOverlaysOnce();

  /* ---------- selection ---------- */
  const sel = { x: 0, y: 0, w: 0, h: 0 };
  let lastGood = { x: 0, y: 0, w: 0, h: 0 };

  function apply() { setSel(sel.x, sel.y, sel.w, sel.h); }

  function validateOrSnapOutside() {
    const lb = lockBounds(LOCK_SIDE);
    if (!lb) { lastGood = { ...sel }; return true; }

    const mark = ensureMark();
    const r = rectFromMark(mark);

    if (!intersects(r, lb)) {
      lastGood = { ...sel };
      return true;
    }

    const ring = lb.margin;
    if (sel.w > ring && sel.h > ring) {
      Object.assign(sel, lastGood);
      apply();
      mark.classList.add("is-invalid");
      setTimeout(() => mark.classList.remove("is-invalid"), 420);
      toast("Selection is too large to fit in Sector 1.");
      return false;
    }

    const candidates = [];
    if (sel.h <= ring) {
      candidates.push({ x: clamp(sel.x, 0, 100 - sel.w), y: clamp(sel.y, 0, lb.top - sel.h) }); // top
      candidates.push({ x: clamp(sel.x, 0, 100 - sel.w), y: clamp(Math.max(sel.y, lb.bottom), lb.bottom, 100 - sel.h) }); // bottom
    }
    if (sel.w <= ring) {
      candidates.push({ x: clamp(sel.x, 0, lb.left - sel.w), y: clamp(sel.y, 0, 100 - sel.h) }); // left
      candidates.push({ x: clamp(Math.max(sel.x, lb.right), lb.right, 100 - sel.w), y: clamp(sel.y, 0, 100 - sel.h) }); // right
    }

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

    Object.assign(sel, lastGood);
    apply();
    mark.classList.add("is-invalid");
    setTimeout(() => mark.classList.remove("is-invalid"), 420);
    toast("Only Sector 1 (outer ring) is available.");
    return false;
  }

  function nudge(dxPct, dyPct) {
    sel.x = clamp(sel.x + dxPct, 0, 100 - sel.w);
    sel.y = clamp(sel.y + dyPct, 0, 100 - sel.h);
    apply();
    validateOrSnapOutside();
  }

  /* ---------- public API ---------- */
  window.markArea = (wDesign, hDesign) => {
    const w = toPct(wDesign), h = toPct(hDesign);
    const lb = lockBounds(LOCK_SIDE);
    const pad = 1;
    let x = pad, y = pad;
    if (lb) {
      x = clamp((lb.left - w) / 2, pad, lb.left - w);
      y = clamp((lb.top  - h) / 2, pad, lb.top  - h);
    }
    sel.w = w; sel.h = h; sel.x = clamp(x, 0, 100 - w); sel.y = clamp(y, 0, 100 - h);
    apply();
    validateOrSnapOutside();
  };

  window.markCustom = () => {
    const w = parseInt(document.getElementById("customWidth")?.value, 10);
    const h = parseInt(document.getElementById("customHeight")?.value, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h)) { alert("Please enter valid dimensions."); return; }
    window.markArea(w, h);
  };

  window.repositionArea = (dir) => {
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
  };

  window.uploadImage = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
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

  // Unlock commands
  function setUnlockLevel(level){
    UNLOCK_LEVEL = clamp(level|0, 1, 4);
    LOCK_SIDE =
      UNLOCK_LEVEL === 1 ? S_S2_OUT :
      UNLOCK_LEVEL === 2 ? S_S3_OUT :
      UNLOCK_LEVEL === 3 ? S_CENTER  : 0;
    updateLockOverlay();
    validateOrSnapOutside();
  }
  window.setUnlockLevel = setUnlockLevel;     // 1..4
  window.setXpixelStage = (stage) => setUnlockLevel(stage);   // alias: 1..3
  window.unlockAll = () => setUnlockLevel(4);
  window.lockToSector1 = () => setUnlockLevel(1);
  window.getUnlockLevel = () => UNLOCK_LEVEL;

  /* ---------- desktop: anchored pad inside frame ---------- */
  function buildAnchoredPad(){
    if (frame.querySelector(".position-pad")) return;
    const pad = document.createElement("div");
    pad.className = "position-pad";
    pad.innerHTML = `
      <div class="pad-head" id="padDragHandle"><span class="pad-title">Move</span>
        <div class="pad-actions"><button class="btn-ico" id="padCollapse">–</button></div>
      </div>
      <div class="pad-body">
        <div class="pad-grid">
          <button data-dir="top-left">↖</button><button data-dir="top-middle">↑</button><button data-dir="top-right">↗</button>
          <button data-dir="middle-left">←</button><button data-dir="middle-middle">•</button><button data-dir="middle-right">→</button>
          <button data-dir="bottom-left">↙</button><button data-dir="bottom-middle">↓</button><button data-dir="bottom-right">↘</button>
        </div>
        <label class="pad-step"><span>Step</span>
          <input type="range" id="padStep" min="${MIN_STEP}" max="${MAX_STEP}" step="1" value="${MOVE_STEP_DESIGN}">
          <output id="padStepOut">${MOVE_STEP_DESIGN}</output>
        </label>
      </div>`;
    frame.appendChild(pad);

    pad.querySelector("#padCollapse").addEventListener("click", () => pad.classList.toggle("is-collapsed"));

    const stepInput = pad.querySelector("#padStep");
    const stepOut   = pad.querySelector("#padStepOut");
    stepInput.addEventListener("input", () => {
      MOVE_STEP_DESIGN = clamp(parseInt(stepInput.value,1)||10, MIN_STEP, MAX_STEP);
      stepOut.textContent = `${MOVE_STEP_DESIGN}`;
    });

    const dirButtons = pad.querySelectorAll(".pad-grid button");
    dirButtons.forEach(btn => {
      const dir = btn.getAttribute("data-dir");
      let rafId = null, down = false;
      const tick = () => { if (!down) return; window.repositionArea(dir); rafId = requestAnimationFrame(tick); };
      const start = (e) => { e.preventDefault(); down = true; window.repositionArea(dir); rafId = requestAnimationFrame(tick); };
      const stop  = () => { down = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; };
      btn.addEventListener("pointerdown", start);
      window.addEventListener("pointerup", stop);
      btn.addEventListener("pointerleave", stop);
      btn.addEventListener("pointercancel", stop);
    });

    // Drag inside frame
    const handle = pad.querySelector("#padDragHandle");
    let dragging = false, offX = 0, offY = 0;
    handle.addEventListener("pointerdown", (e)=>{
      dragging = true; const r = pad.getBoundingClientRect(), f = frame.getBoundingClientRect();
      offX = e.clientX - r.left; offY = e.clientY - r.top; e.preventDefault();
    });
    window.addEventListener("pointermove", (e)=>{
      if (!dragging) return;
      const f = frame.getBoundingClientRect();
      const x = clamp(e.clientX - f.left - offX, 6, f.width  - pad.offsetWidth  - 6);
      const y = clamp(e.clientY - f.top  - offY,  6, f.height - pad.offsetHeight - 6);
      pad.style.left = x + "px"; pad.style.top = y + "px"; pad.style.right = "auto"; pad.style.bottom = "auto"; pad.style.transform = "none";
    });
    window.addEventListener("pointerup", ()=> dragging=false);
    window.addEventListener("pointercancel", ()=> dragging=false);
  }

  /* ---------- mobile: FAB + bottom sheet ---------- */
  function buildMobileControls(){
    if (frame.querySelector(".pad-fab")) return;

    // FAB
    const fab = document.createElement("button");
    fab.className = "pad-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open movement controller");
    fab.textContent = "↕";
    frame.appendChild(fab);

    // Sheet
    const sheet = document.createElement("div");
    sheet.className = "position-sheet";
    sheet.innerHTML = `
      <div class="sheet-grip"></div>
      <div class="pad-grid">
        <button data-dir="top-left">↖</button><button data-dir="top-middle">↑</button><button data-dir="top-right">↗</button>
        <button data-dir="middle-left">←</button><button data-dir="middle-middle">•</button><button data-dir="middle-right">→</button>
        <button data-dir="bottom-left">↙</button><button data-dir="bottom-middle">↓</button><button data-dir="bottom-right">↘</button>
      </div>
      <label class="pad-step"><span>Step</span>
        <input type="range" id="sheetStep" min="${MIN_STEP}" max="${MAX_STEP}" step="5" value="${MOVE_STEP_DESIGN}">
        <output id="sheetStepOut">${MOVE_STEP_DESIGN} px</output>
      </label>
    `;
    document.body.appendChild(sheet);

    const openSheet = () => { sheet.classList.add("is-open"); };
    const closeSheet = () => { sheet.classList.remove("is-open"); };
    fab.addEventListener("click", openSheet);

    // Swipe down to close (simple)
    let startY = null;
    sheet.addEventListener("pointerdown", (e)=>{ startY = e.clientY; });
    sheet.addEventListener("pointerup", (e)=>{ if (startY !== null && e.clientY - startY > 30) closeSheet(); startY = null; });
    sheet.addEventListener("pointercancel", ()=> startY = null);

    // Step control
    const stepInput = sheet.querySelector("#sheetStep");
    const stepOut   = sheet.querySelector("#sheetStepOut");
    stepInput.addEventListener("input", () => {
      MOVE_STEP_DESIGN = clamp(parseInt(stepInput.value,10)||250, MIN_STEP, MAX_STEP);
      stepOut.textContent = `${MOVE_STEP_DESIGN} px`;
    });

    // Buttons with press-and-hold
    const dirButtons = sheet.querySelectorAll(".pad-grid button");
    dirButtons.forEach(btn => {
      const dir = btn.getAttribute("data-dir");
      let rafId = null, down = false;
      const tick = () => { if (!down) return; window.repositionArea(dir); rafId = requestAnimationFrame(tick); };
      const start = (e) => { e.preventDefault(); down = true; window.repositionArea(dir); rafId = requestAnimationFrame(tick); };
      const stop  = () => { down = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; };
      btn.addEventListener("pointerdown", start);
      window.addEventListener("pointerup", stop);
      btn.addEventListener("pointerleave", stop);
      btn.addEventListener("pointercancel", stop);
    });

    // Show/hide with frame visibility
    const io = new IntersectionObserver(([entry])=>{
      if (entry.isIntersecting) {
        fab.style.display = "grid";
      } else {
        fab.style.display = "none";
        closeSheet();
      }
    }, { threshold: 0.15 });
    io.observe(frame);

    // Expose for debugging if needed
    window._pad = { fab, sheet, openSheet, closeSheet };
  }

  /* ---------- keyboard (desktop convenience) ---------- */
  function bindKeyboard(){
    window.addEventListener("keydown", (e)=>{
      const k = e.key.toLowerCase();
      const fast = e.shiftKey ? 2 : 1;
      const fine = e.altKey ? 0.2 : 1;
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

  /* ---------- init ---------- */
  window.markArea(10, 10);          // first mark = 10×10 design px in Sector 1
  bindKeyboard();

  // Build controls for current viewport
  const initControls = () => {
    if (isMobile()) buildMobileControls();
    else buildAnchoredPad();
  };
  initControls();

  // Re-init on breakpoint change
  window.addEventListener("resize", () => {
    // If switching modes, rebuild once
    const hasFab = !!frame.querySelector(".pad-fab");
    const needFab = isMobile();
    if (needFab && !hasFab) buildMobileControls();
    if (!needFab && !frame.querySelector(".position-pad")) buildAnchoredPad();
  });
})();
// setXpixelStage(1) → unlock Sector 1 only (lock S2+S3+Center)

// setXpixelStage(2) → unlock Sectors 1–2 (lock S3+Center)

// setXpixelStage(3) → unlock Sectors 1–3 (lock Center)

// unlockAll() → unlock everything

// lockToSector1() → back to Stage 1

// setUnlockLevel(n) → generic 1..4 (same mapping)
