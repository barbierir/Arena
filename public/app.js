function navMarkup() {
  return `
    <a href="/index.html">Start</a>
    <a href="/recruit.html">Recruit</a>
    <a href="/game.html">Game</a>
    <a href="/challenge.html">Challenge</a>
    <a href="/summary.html">Summary</a>
  `;
}

function renderNav() {
  const nav = document.querySelector('nav');
  if (nav) nav.innerHTML = navMarkup();
  if (window.UI) UI.ensureHud();
}

function runEnded(run) {
  return !run || run.turns <= 0 || run.status === 'finished';
}

function formatStats(stats) {
  return `STR ${stats.STR} / AGI ${stats.AGI} / END ${stats.END} / Talent ${stats.Talent}`;
}

function pickRandomRecruitGif() {
  const gifs = ['/assets/recruit-1.gif', '/assets/recruit-2.gif', '/assets/recruit-3.gif'];
  return gifs[Math.floor(Math.random() * gifs.length)];
}

function ensureOverlay() {
  let overlay = document.getElementById('fxOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'fxOverlay';
  overlay.className = 'fx-overlay hidden';
  overlay.innerHTML = `
    <div class="fx-panel">
      <h2 id="fxTitle" class="fx-title"></h2>
      <div id="fxSubtitle" class="muted"></div>
      <div id="fxVs" class="fx-vs hidden"><span id="fxLeftName"></span><strong>VS</strong><span id="fxRightName"></span></div>
      <div id="fxFightStage" class="fx-fight-stage hidden">
        <img id="fxLeftGif" class="fx-fighter left" alt="Left fighter" />
        <img id="fxCrowd" class="fx-crowd" src="/assets/crowd-loop.gif" alt="Crowd" />
        <img id="fxRightGif" class="fx-fighter right" alt="Right fighter" />
        <div class="crowd-meter"><span>Crowd</span><div><i id="crowdMeterFill"></i></div></div>
      </div>
      <img id="fxMainGif" class="fx-main-gif hidden" alt="Animation" />
      <div id="fxProgressWrap" class="fx-progress-wrap hidden">
        <div id="fxProgressBar" class="fx-progress-bar"></div>
      </div>
      <button id="fxSkipBtn" class="hidden btn-secondary">Skip</button>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function animateProgress(durationMs) {
  const bar = document.getElementById('fxProgressBar');
  if (!bar) return;
  bar.style.transition = 'none';
  bar.style.width = '0%';
  requestAnimationFrame(() => {
    bar.style.transition = `width ${durationMs}ms linear`;
    bar.style.width = '100%';
  });
}

function showActionOverlay({ title, gifPath, durationMs }) {
  return new Promise((resolve) => {
    const overlay = ensureOverlay();
    const titleNode = document.getElementById('fxTitle');
    const subtitle = document.getElementById('fxSubtitle');
    const mainGif = document.getElementById('fxMainGif');
    const fightStage = document.getElementById('fxFightStage');
    const progressWrap = document.getElementById('fxProgressWrap');
    const skipBtn = document.getElementById('fxSkipBtn');
    const vs = document.getElementById('fxVs');
    const reduceMotion = window.UI && UI.getSettings().reduceMotion;

    titleNode.textContent = title || 'Working...';
    subtitle.textContent = `${title || 'Action'}...`;
    mainGif.src = gifPath;
    mainGif.classList.remove('hidden');
    fightStage.classList.add('hidden');
    vs.classList.add('hidden');
    progressWrap.classList.remove('hidden');

    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      overlay.classList.add('hidden');
      skipBtn.onclick = null;
      skipBtn.classList.add('hidden');
      resolve();
    };

    if (reduceMotion) {
      skipBtn.classList.remove('hidden');
      skipBtn.textContent = 'Skip';
      skipBtn.onclick = finish;
    } else {
      skipBtn.classList.add('hidden');
    }

    overlay.classList.remove('hidden');
    animateProgress(durationMs);
    timer = setTimeout(finish, durationMs);
  });
}

function showFightPlayback({ leftGif, rightGif, durationMs = 30000, onSkip, leftName = 'You', rightName = 'Rival' }) {
  return new Promise((resolve) => {
    const overlay = ensureOverlay();
    const titleNode = document.getElementById('fxTitle');
    const subtitle = document.getElementById('fxSubtitle');
    const mainGif = document.getElementById('fxMainGif');
    const fightStage = document.getElementById('fxFightStage');
    const progressWrap = document.getElementById('fxProgressWrap');
    const skipBtn = document.getElementById('fxSkipBtn');
    const leftNode = document.getElementById('fxLeftGif');
    const rightNode = document.getElementById('fxRightGif');
    const vs = document.getElementById('fxVs');
    const crowdMeterFill = document.getElementById('crowdMeterFill');
    const reduceMotion = window.UI && UI.getSettings().reduceMotion;

    let done = false;
    let timer = null;
    const intervals = [];
    let crowd = 10;

    function cleanup(skipped) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      intervals.forEach((id) => clearInterval(id));
      skipBtn.onclick = null;
      overlay.classList.add('hidden');
      if (skipped && typeof onSkip === 'function') onSkip();
      resolve();
    }

    titleNode.textContent = 'Fight Intro';
    subtitle.textContent = 'Crowd roars...';
    leftNode.src = leftGif;
    rightNode.src = rightGif;
    document.getElementById('fxLeftName').textContent = leftName;
    document.getElementById('fxRightName').textContent = rightName;
    mainGif.classList.add('hidden');
    fightStage.classList.remove('hidden');
    progressWrap.classList.remove('hidden');
    vs.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    skipBtn.textContent = 'Skip Fight';
    skipBtn.onclick = () => cleanup(true);

    overlay.classList.remove('hidden');
    animateProgress(durationMs);

    setTimeout(() => {
      if (done) return;
      titleNode.textContent = 'FIGHT!';
      subtitle.textContent = 'Blades clash in the arena';
      UI && UI.screenShake(280, 6);
    }, reduceMotion ? 100 : 3000);

    const tickMs = reduceMotion ? 1600 : 1200;
    intervals.push(setInterval(() => {
      if (done) return;
      const isCrit = Math.random() > 0.82;
      const heavy = Math.random() > 0.65;
      const amount = heavy ? Math.floor(Math.random() * 7) + 8 : Math.floor(Math.random() * 5) + 3;
      const side = Math.random() > 0.5 ? 'left' : 'right';
      UI && UI.spawnDamageNumber(side, amount, isCrit);
      if (window.AudioManager) AudioManager.play('hit');
      if (isCrit || heavy) UI && UI.screenShake(200, isCrit ? 8 : 4);
      crowd = Math.max(6, Math.min(100, crowd + (heavy ? 14 : 8)));
      crowdMeterFill.style.width = `${crowd}%`;
    }, tickMs));

    intervals.push(setInterval(() => {
      crowd = Math.max(4, crowd - 6);
      crowdMeterFill.style.width = `${crowd}%`;
    }, 900));

    timer = setTimeout(() => cleanup(false), durationMs);
  });
}

function disableActions(disabled) {
  const buttons = document.querySelectorAll('[data-action-btn]');
  buttons.forEach((btn) => {
    btn.disabled = disabled;
  });
}

window.App = {
  renderNav,
  runEnded,
  formatStats,
  pickRandomRecruitGif,
  showActionOverlay,
  showFightPlayback,
  disableActions
};
