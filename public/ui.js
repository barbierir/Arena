(function () {
  const REDUCE_MOTION_KEY = 'arenaReduceMotion';
  const state = {
    run: null,
    settings: {
      reduceMotion: localStorage.getItem(REDUCE_MOTION_KEY) === 'true'
    },
    prev: {}
  };

  function inferHp(run) {
    if (!run || !run.stats) return { current: 0, max: 100 };
    const max = 60 + (run.stats.END * 10);
    const penalty = run.wound === 'serious' ? 25 : run.wound === 'light' ? 10 : 0;
    return { current: Math.max(1, max - penalty), max };
  }

  function getGladiatorName() {
    return localStorage.getItem('arenaGladiatorName') || 'Unrecruited';
  }

  function traitFromStats(stats) {
    if (!stats) return 'Unknown';
    if (stats.STR >= stats.AGI && stats.STR >= stats.END) return 'Brawler';
    if (stats.AGI >= stats.END) return 'Duelist';
    return 'Ironwall';
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  function ensureHud() {
    const hud = document.getElementById('hud');
    if (!hud) return null;
    if (hud.dataset.ready === 'true') return hud;
    hud.classList.add('hud');
    hud.innerHTML = `
      <div class="hud-col hud-left">
        <div class="hud-chip"><span>Gold</span><strong id="hudGold">0</strong></div>
        <div class="hud-chip"><span>Record</span><strong id="hudRecord">0W/0L</strong></div>
        <div class="hud-chip"><span>Turns</span><strong id="hudTurns">0</strong></div>
      </div>
      <div class="hud-col hud-center">
        <div class="hud-name" id="hudName">${getGladiatorName()}</div>
        <div class="hud-hp-wrap"><div class="hud-hp"><div id="hudHpBar"></div></div><span id="hudHpText">0/0</span></div>
      </div>
      <div class="hud-col hud-right">
        <label><input id="audioToggle" type="checkbox" /> Audio</label>
        <label><input id="motionToggle" type="checkbox" /> Reduce Motion</label>
      </div>
    `;
    hud.dataset.ready = 'true';

    hud.querySelector('#audioToggle').checked = window.AudioManager ? window.AudioManager.enabled : true;
    hud.querySelector('#motionToggle').checked = state.settings.reduceMotion;
    hud.querySelector('#audioToggle').addEventListener('change', (e) => {
      if (window.AudioManager) window.AudioManager.setEnabled(e.target.checked);
    });
    hud.querySelector('#motionToggle').addEventListener('change', (e) => {
      state.settings.reduceMotion = e.target.checked;
      localStorage.setItem(REDUCE_MOTION_KEY, String(e.target.checked));
      document.body.classList.toggle('reduce-motion', e.target.checked);
    });
    document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
    return hud;
  }

  function ensureActionBar() {
    const actionBar = document.getElementById('actionBar');
    if (!actionBar || actionBar.dataset.ready === 'true') return actionBar;
    actionBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action-target],[data-action-href]');
      if (!btn || btn.disabled) return;
      const href = btn.dataset.actionHref;
      if (href) {
        window.location.href = href;
        return;
      }
      const target = btn.dataset.actionTarget;
      const targetBtn = target ? document.querySelector(target) : null;
      if (targetBtn) targetBtn.click();
    });
    actionBar.dataset.ready = 'true';
    return actionBar;
  }

  function setActionBar(actions = []) {
    const bar = ensureActionBar();
    if (!bar) return;
    bar.innerHTML = actions.map((action) => `
      <button class="${action.className || 'btn-secondary'}" ${action.target ? `data-action-target="${action.target}"` : ''} ${action.href ? `data-action-href="${action.href}"` : ''} ${action.id ? `id="${action.id}"` : ''} ${action.disabled ? 'disabled' : ''}>${action.label}</button>
    `).join('');
  }

  function animateCount(el, from, to, duration = 700, reduceMotion = state.settings.reduceMotion) {
    if (!el) return;
    if (reduceMotion) {
      el.textContent = Math.round(to);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = Math.round(from + ((to - from) * t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function updateHud() {
    ensureHud();
    const run = state.run;
    if (!run) return;
    const hp = inferHp(run);
    const hpPct = Math.max(0, Math.min(100, Math.round((hp.current / hp.max) * 100)));
    const goldEl = document.getElementById('hudGold');
    const recordEl = document.getElementById('hudRecord');
    const hpBar = document.getElementById('hudHpBar');

    if (goldEl) {
      animateCount(goldEl, state.prev.gold ?? run.gold ?? 0, run.gold ?? 0, 450);
      if (state.prev.gold != null && state.prev.gold !== run.gold) pulse(goldEl.closest('.hud-chip'));
    }
    if (recordEl) {
      recordEl.textContent = `${run.wins ?? 0}W/${run.losses ?? 0}L`;
      if ((state.prev.wins !== undefined && state.prev.wins !== run.wins) || (state.prev.losses !== undefined && state.prev.losses !== run.losses)) pulse(recordEl.closest('.hud-chip'));
    }
    if (document.getElementById('hudTurns')) document.getElementById('hudTurns').textContent = run.turns ?? 0;
    if (document.getElementById('hudName')) document.getElementById('hudName').textContent = getGladiatorName();
    if (document.getElementById('hudHpText')) document.getElementById('hudHpText').textContent = `${hp.current}/${hp.max}`;
    if (hpBar) {
      hpBar.style.width = `${hpPct}%`;
      if (state.prev.hpCurrent !== undefined && state.prev.hpCurrent !== hp.current) {
        hpBar.classList.remove('flash');
        void hpBar.offsetWidth;
        hpBar.classList.add('flash');
      }
    }

    state.prev = { gold: run.gold, wins: run.wins, losses: run.losses, hpCurrent: hp.current };
  }

  function showToast(message, type = 'info') {
    let root = document.getElementById('toastRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toastRoot';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 180); }, 1800);
  }

  function screenShake(duration = 180, intensity = 4) {
    if (state.settings.reduceMotion) return;
    const panel = document.querySelector('.fx-panel');
    if (!panel) return;
    panel.style.setProperty('--shake-intensity', `${intensity}px`);
    panel.classList.add('shake');
    setTimeout(() => panel.classList.remove('shake'), duration);
  }

  function spawnDamageNumber(side, amount, isCrit) {
    const stage = document.getElementById('fxFightStage');
    if (!stage) return;
    const node = document.createElement('div');
    node.className = `dmg-number ${side} ${isCrit ? 'crit' : ''}`;
    if (state.settings.reduceMotion) node.style.animation = 'none';
    node.textContent = `-${amount}`;
    stage.appendChild(node);
    setTimeout(() => node.remove(), state.settings.reduceMotion ? 260 : 900);
  }

  function setRun(run) {
    state.run = run;
    document.dispatchEvent(new CustomEvent('game:stateChanged', { detail: { run } }));
    updateHud();
  }

  document.addEventListener('game:stateChanged', updateHud);

  window.UI = {
    traitFromStats,
    animateCount,
    showToast,
    screenShake,
    spawnDamageNumber,
    setRun,
    ensureHud,
    setActionBar,
    getSettings: () => ({ ...state.settings })
  };
})();
