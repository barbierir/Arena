(function () {
  const REDUCE_MOTION_KEY = 'arenaReduceMotion';

  const state = {
    run: null,
    settings: {
      reduceMotion: localStorage.getItem(REDUCE_MOTION_KEY) === 'true'
    }
  };

  function inferHp(run) {
    if (!run) return { current: 0, max: 100 };
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

  function ensureHud() {
    let hud = document.getElementById('arenaHud');
    if (hud) return hud;
    hud = document.createElement('header');
    hud.id = 'arenaHud';
    hud.className = 'arena-hud';
    hud.innerHTML = `
      <div class="hud-main">
        <div><strong>Gold</strong> <span id="hudGold">-</span></div>
        <div><strong>Gladiator</strong> <span id="hudName">${getGladiatorName()}</span></div>
        <div><strong>Record</strong> <span id="hudRecord">-</span></div>
      </div>
      <div class="hud-stats">
        <div class="hud-hp-wrap">
          <span>HP</span>
          <div class="hud-hp"><div id="hudHpBar"></div></div>
          <span id="hudHpText">-</span>
        </div>
        <div class="stat-chip" data-tooltip="Power of hits and training gains.">⚔ <span id="hudStr">-</span></div>
        <div class="stat-chip" data-tooltip="Chance to strike first and avoid heavy blows.">🛡 <span id="hudAgi">-</span></div>
        <div class="stat-chip" data-tooltip="Durability and recovery potential.">❤ <span id="hudEnd">-</span></div>
        <div class="stat-chip" data-tooltip="Special edge used in rating calculations.">✦ <span id="hudTalent">-</span></div>
      </div>
      <div class="hud-controls">
        <label><input id="audioToggle" type="checkbox" /> Audio</label>
        <label><input id="motionToggle" type="checkbox" /> Reduce Motion</label>
      </div>
    `;
    document.body.prepend(hud);

    hud.querySelector('#audioToggle').checked = window.AudioManager ? window.AudioManager.enabled : true;
    hud.querySelector('#motionToggle').checked = state.settings.reduceMotion;
    hud.querySelector('#audioToggle').addEventListener('change', (e) => {
      window.AudioManager && window.AudioManager.setEnabled(e.target.checked);
      showToast(`Audio ${e.target.checked ? 'On' : 'Off'}`, 'info');
    });
    hud.querySelector('#motionToggle').addEventListener('change', (e) => {
      state.settings.reduceMotion = e.target.checked;
      localStorage.setItem(REDUCE_MOTION_KEY, String(e.target.checked));
      document.body.classList.toggle('reduce-motion', e.target.checked);
      showToast(`Reduce Motion ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'info');
    });

    bindTooltips(hud);
    document.body.classList.toggle('reduce-motion', state.settings.reduceMotion);
    return hud;
  }

  function bindTooltips(root) {
    root.querySelectorAll('[data-tooltip]').forEach((node) => {
      node.tabIndex = 0;
      node.addEventListener('click', () => showToast(node.dataset.tooltip, 'info'));
      node.title = node.dataset.tooltip;
    });
  }

  function ensureToastRoot() {
    let node = document.getElementById('toastRoot');
    if (node) return node;
    node = document.createElement('div');
    node.id = 'toastRoot';
    node.className = 'toast-root';
    document.body.appendChild(node);
    return node;
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

  function showToast(message, type = 'info') {
    const root = ensureToastRoot();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 180);
    }, 2200);
  }

  function screenShake(duration = 220, intensity = 5) {
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
    node.textContent = `-${amount}`;
    stage.appendChild(node);
    setTimeout(() => node.remove(), state.settings.reduceMotion ? 220 : 900);
  }

  function setRun(run) {
    state.run = run;
    ensureHud();
    document.dispatchEvent(new CustomEvent('game:stateChanged', { detail: { run } }));
  }

  function updateHud() {
    const run = state.run;
    if (!run) return;
    const hp = inferHp(run);
    const hpPct = Math.round((hp.current / hp.max) * 100);
    document.getElementById('hudGold').textContent = run.gold ?? '-';
    document.getElementById('hudName').textContent = getGladiatorName();
    document.getElementById('hudRecord').textContent = `${run.wins ?? 0}W/${run.losses ?? 0}L`;
    document.getElementById('hudStr').textContent = run.stats?.STR ?? '-';
    document.getElementById('hudAgi').textContent = run.stats?.AGI ?? '-';
    document.getElementById('hudEnd').textContent = run.stats?.END ?? '-';
    document.getElementById('hudTalent').textContent = run.stats?.Talent ?? '-';
    document.getElementById('hudHpText').textContent = `${hp.current}/${hp.max}`;
    document.getElementById('hudHpBar').style.width = `${hpPct}%`;
  }

  document.addEventListener('game:stateChanged', updateHud);

  window.UI = {
    traitFromStats,
    animateCount,
    showToast,
    screenShake,
    spawnDamageNumber,
    setRun,
    getSettings: () => ({ ...state.settings }),
    ensureHud
  };
})();
