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
      <div id="fxFightStage" class="fx-fight-stage hidden">
        <img id="fxLeftGif" class="fx-fighter left" alt="Left fighter" />
        <img id="fxCrowd" class="fx-crowd" src="/assets/crowd-loop.gif" alt="Crowd" />
        <img id="fxRightGif" class="fx-fighter right" alt="Right fighter" />
      </div>
      <img id="fxMainGif" class="fx-main-gif hidden" alt="Animation" />
      <div id="fxProgressWrap" class="fx-progress-wrap hidden">
        <div id="fxProgressBar" class="fx-progress-bar"></div>
      </div>
      <button id="fxSkipBtn" class="hidden">Skip</button>
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
    const mainGif = document.getElementById('fxMainGif');
    const fightStage = document.getElementById('fxFightStage');
    const progressWrap = document.getElementById('fxProgressWrap');
    const skipBtn = document.getElementById('fxSkipBtn');

    titleNode.textContent = title || 'Working...';
    mainGif.src = gifPath;
    mainGif.classList.remove('hidden');
    fightStage.classList.add('hidden');
    progressWrap.classList.remove('hidden');
    skipBtn.classList.add('hidden');

    overlay.classList.remove('hidden');
    animateProgress(durationMs);

    setTimeout(() => {
      overlay.classList.add('hidden');
      resolve();
    }, durationMs);
  });
}

function showFightPlayback({ leftGif, rightGif, durationMs = 30000, onSkip }) {
  return new Promise((resolve) => {
    const overlay = ensureOverlay();
    const titleNode = document.getElementById('fxTitle');
    const mainGif = document.getElementById('fxMainGif');
    const fightStage = document.getElementById('fxFightStage');
    const progressWrap = document.getElementById('fxProgressWrap');
    const skipBtn = document.getElementById('fxSkipBtn');
    const leftNode = document.getElementById('fxLeftGif');
    const rightNode = document.getElementById('fxRightGif');

    let done = false;
    let timer = null;

    function finish(skipped) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      skipBtn.onclick = null;
      overlay.classList.add('hidden');
      if (skipped && typeof onSkip === 'function') onSkip();
      resolve();
    }

    titleNode.textContent = 'Arena Combat Playback';
    leftNode.src = leftGif;
    rightNode.src = rightGif;
    mainGif.classList.add('hidden');
    fightStage.classList.remove('hidden');
    progressWrap.classList.remove('hidden');
    skipBtn.classList.remove('hidden');
    skipBtn.onclick = () => finish(true);

    overlay.classList.remove('hidden');
    animateProgress(durationMs);

    timer = setTimeout(() => finish(false), durationMs);
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
