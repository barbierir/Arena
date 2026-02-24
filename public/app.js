function navMarkup() {
  return `
    <a href="/index.html">Start</a>
    <a href="/recruit.html">Recruit</a>
    <a href="/game.html">Game</a>
    <a href="/challenge.html">Challenge</a>
    <a href="/summary.html">Global Ranking</a>
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
  overlay.innerHTML = '<div class="fx-panel"></div>';
  document.body.appendChild(overlay);
  return overlay;
}

function showActionOverlay({ title, gifPath, durationMs }) {
  return new Promise((resolve) => {
    const overlay = ensureOverlay();
    const panel = overlay.querySelector('.fx-panel');
    panel.innerHTML = `
      <h2 class="fx-title">${title || 'Working...'}</h2>
      <img class="fx-main-gif" src="${gifPath}" alt="Action" />
      <div class="fx-progress-wrap"><div id="fxProgressBar" class="fx-progress-bar"></div></div>
    `;
    overlay.classList.remove('hidden');
    const bar = panel.querySelector('#fxProgressBar');
    bar.style.transition = 'none';
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      bar.style.transition = `width ${durationMs}ms linear`;
      bar.style.width = '100%';
    });
    setTimeout(() => {
      overlay.classList.add('hidden');
      resolve();
    }, durationMs);
  });
}


const LATEST_ACTION_LIMIT = 5;

function getLatestActionsStateKey(runId) {
  const resolvedRunId = runId || (window.Api && typeof Api.getRunId === 'function' ? Api.getRunId() : null) || 'default';
  return `arenaGameState:${resolvedRunId}`;
}

function appendLatestAction(entry, { runId } = {}) {
  if (!entry || typeof localStorage === 'undefined') return;
  const key = getLatestActionsStateKey(runId);
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch (_) {
    parsed = {};
  }
  const trainingLog = Array.isArray(parsed.trainingLog) ? parsed.trainingLog : [];
  trainingLog.unshift(entry);
  parsed.trainingLog = trainingLog.slice(0, LATEST_ACTION_LIMIT);
  localStorage.setItem(key, JSON.stringify(parsed));
}

function buildFightLatestAction(fightResult, { runId } = {}) {
  const explicitOutcome = typeof fightResult?.outcome === 'string' ? fightResult.outcome.toLowerCase() : null;
  const winnerOutcome = (runId && fightResult && typeof fightResult.winnerRunId === 'string')
    ? (fightResult.winnerRunId === runId ? 'win' : 'loss')
    : null;
  const outcome = resolveOutcome(fightResult) || explicitOutcome || winnerOutcome;
  const status = outcome === 'win' ? 'VICTORY' : 'DEFEAT';
  const details = [];
  const gold = Number(fightResult?.gold || 0);
  const fame = Number(fightResult?.fame || 0);
  if (gold > 0) details.push(`+${gold} gold`);
  if (fame > 0) details.push(`+${fame} fame`);
  const injury = String(fightResult?.injury || '').trim().toLowerCase();
  const hasInjury = injury && injury !== 'none' && injury !== 'no' && injury !== 'false';
  const rewardSuffix = details.length ? ` (${details.join(', ')})` : '';
  const injurySuffix = hasInjury ? ' • Injury' : '';
  return { action: 'Fight', result: `${status}${rewardSuffix}${injurySuffix}` };
}

let activeFightPlayback = null;

function resolveOutcome(fightResult) {
  if (!fightResult) return null;
  if (typeof fightResult.result === 'string') return fightResult.result.toLowerCase();
  if (typeof fightResult.outcome === 'string') return fightResult.outcome.toLowerCase();
  if (typeof fightResult.winner === 'string') {
    if (fightResult.winner === 'A' || fightResult.winner === 'left' || fightResult.winner === 'player') return 'win';
    if (fightResult.winner === 'B' || fightResult.winner === 'right' || fightResult.winner === 'opponent') return 'loss';
  }
  return null;
}

function showFightPlayback({ leftGif, rightGif, durationMs = 25000, onSkip, leftName = 'You', rightName = 'Rival', rewards = {}, fightResult = null }) {
  return new Promise((resolve) => {
    if (activeFightPlayback && typeof activeFightPlayback.cleanup === 'function') activeFightPlayback.cleanup();
    const overlay = ensureOverlay();
    const panel = overlay.querySelector('.fx-panel');
    const reduceMotion = window.UI && UI.getSettings().reduceMotion;
    let done = false;
    let timer;
    let hype = 10;
    let lastHit = 0;
    const intervals = [];

    panel.innerHTML = `
      <div class="fight-hud"><div class="fight-timer" id="fxTimer">${Math.ceil(durationMs / 1000)}</div><div class="fight-title">${leftName} vs ${rightName}</div><button id="fxSkipBtn" class="btn btn--tertiary fx-skip">Skip</button></div>
      <div id="fxFightStage" class="fx-fight-stage arcade-stage">
        <img class="fx-fighter left" src="${leftGif}" alt="Left fighter" />
        <img class="fx-fighter right" src="${rightGif}" alt="Right fighter" />
        <div class="hp-dock hp-left"><span>${leftName}</span><div class="mini-hp"><i id="hpLeft"></i></div></div>
        <div class="hp-dock hp-right"><span>${rightName}</span><div class="mini-hp"><i id="hpRight"></i></div></div>
        <div class="crowd-meter crowd-meter--overlay"><span>HYPE</span><div><i id="crowdMeterFill"></i></div></div>
        <div id="announcer" class="announcer" aria-live="polite"></div>
      </div>
      <div id="fxResult" class="hidden"></div>
    `;

    overlay.classList.remove('hidden');
    const skipBtn = panel.querySelector('#fxSkipBtn');
    const resultEl = panel.querySelector('#fxResult');
    const hpLeft = panel.querySelector('#hpLeft');
    const hpRight = panel.querySelector('#hpRight');
    const meter = panel.querySelector('#crowdMeterFill');
    const timerEl = panel.querySelector('#fxTimer');
    const authoritativeOutcome = resolveOutcome(fightResult);
    let leftHp = 100;
    let rightHp = 100;
    const startedAt = Date.now();
    let hitStreak = { side: null, count: 0, lastAt: 0 };
    const lowHpAnnounced = { left: false, right: false };
    let crowdTier = 0;
    let endedByKO = false;

    if (window.UI) {
      UI.resetAnnouncer();
      UI.announce('ARENA READY!', 'normal', 900);
      UI.announce('FIGHT!', 'high', 880);
    }

    function closeAnd(fn) {
      clearTimeout(timer);
      intervals.forEach(clearInterval);
      overlay.classList.add('hidden');
      activeFightPlayback = null;
      if (fn) fn();
      const gameActionBtn = document.querySelector('#fightAiBtn, [data-action-btn]:not([disabled])');
      if (gameActionBtn && typeof gameActionBtn.focus === 'function') gameActionBtn.focus();
      resolve({
        authoritativeOutcome,
        overlayOutcome: resultEl.dataset.outcome || null,
        leftHp,
        rightHp
      });
    }

    function cleanup() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      intervals.forEach(clearInterval);
      activeFightPlayback = null;
      overlay.classList.add('hidden');
      resolve({
        authoritativeOutcome,
        overlayOutcome: null,
        leftHp,
        rightHp
      });
    }

    activeFightPlayback = { cleanup };

    function end(skipped) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      intervals.forEach(clearInterval);
      if (skipped && typeof onSkip === 'function') onSkip();
      const didWin = authoritativeOutcome ? authoritativeOutcome === 'win' : rightHp <= leftHp;
      if (window.UI) {
        if (endedByKO) UI.announce('KNOCKOUT!', 'high', 1050);
        else UI.announce('TIME!', 'high', 920);
        UI.announce(didWin ? 'VICTORY!' : 'DEFEAT!', 'high', 980);
      }
      if (window.AudioManager && didWin) AudioManager.play('coin');
      const goldReward = Number(rewards.gold || 0);
      const fameReward = Number(rewards.fame || 0);
      resultEl.classList.remove('hidden');
      resultEl.dataset.outcome = didWin ? 'win' : 'loss';
      resultEl.innerHTML = `
        <div class="results-panel overlay-results">
          <h3>${didWin ? 'VICTORY' : 'DEFEAT'}</h3>
          <p class="reward-line">Gold: <strong id="rewardGold">0</strong> • Fame: <strong id="rewardFame">0</strong></p>
          <button id="fxClose" class="btn btn--tertiary">Close</button>
        </div>
      `;
      if (window.UI) {
        UI.animateCount(resultEl.querySelector('#rewardGold'), 0, goldReward, 550, reduceMotion);
        UI.animateCount(resultEl.querySelector('#rewardFame'), 0, fameReward, 550, reduceMotion);
      }
      resultEl.querySelector('#fxClose').onclick = () => closeAnd();
    }

    skipBtn.onclick = () => end(true);

    intervals.push(setInterval(() => {
      if (done) return;
      const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - startedAt)) / 1000));
      timerEl.textContent = remaining;
    }, 250));

    const updateCadence = reduceMotion ? 900 : 620;
    const steps = Math.max(1, Math.floor(durationMs / updateCadence));
    const finalHp = authoritativeOutcome === 'win'
      ? { left: 20 + Math.floor(Math.random() * 56), right: Math.floor(Math.random() * 31) }
      : authoritativeOutcome === 'loss'
        ? { left: Math.floor(Math.random() * 31), right: 20 + Math.floor(Math.random() * 56) }
        : { left: Math.floor(Math.random() * 101), right: Math.floor(Math.random() * 101) };
    const pace = {
      left: (100 - finalHp.left) / steps,
      right: (100 - finalHp.right) / steps
    };
    let step = 0;

    intervals.push(setInterval(() => {
      if (done) return;
      step += 1;
      const prevLeft = leftHp;
      const prevRight = rightHp;
      leftHp = Math.max(finalHp.left, Math.round(100 - (pace.left * step)));
      rightHp = Math.max(finalHp.right, Math.round(100 - (pace.right * step)));
      if (step >= steps) {
        leftHp = finalHp.left;
        rightHp = finalHp.right;
      }
      hpLeft.style.width = `${leftHp}%`;
      hpRight.style.width = `${rightHp}%`;
      const leftDrop = Math.max(0, prevLeft - leftHp);
      const rightDrop = Math.max(0, prevRight - rightHp);
      const side = rightDrop >= leftDrop ? 'right' : 'left';
      const dmg = Math.max(leftDrop, rightDrop);
      const crit = dmg >= 12;
      if (window.UI && dmg > 0) UI.spawnDamageNumber(side, dmg, crit);
      if (!reduceMotion && window.UI) UI.screenShake(140, crit ? 7 : 4);
      const now = Date.now();
      if (window.AudioManager && now - lastHit > 180) {
        AudioManager.play('hit');
        lastHit = now;
      }

      if (now - hitStreak.lastAt <= 1200 && hitStreak.side === side && dmg > 0) {
        hitStreak.count += 1;
      } else {
        hitStreak = { side, count: 1, lastAt: now };
      }
      hitStreak.lastAt = now;

      if (window.UI) {
        if (crit) {
          UI.announce(Math.random() > 0.5 ? 'CRITICAL HIT!' : 'DEVASTATING!', 'accent', 820);
          if (window.AudioManager) AudioManager.play('coin');
        }
        if (hitStreak.count >= 2 && hitStreak.count <= 5) {
          UI.announce(`COMBO x${hitStreak.count}`, 'normal', 720);
        }
      }

      hype = Math.min(100, hype + (crit ? 18 : 10));
      meter.style.width = `${hype}%`;
      if (window.UI) {
        if (hype >= 92 && crowdTier < 2) {
          crowdTier = 2;
          UI.announce('BLOODLUST!', 'high', 980);
        } else if (hype >= 72 && crowdTier < 1) {
          crowdTier = 1;
          UI.announce('THE CROWD ROARS!', 'accent', 860);
        }
      }

      if (leftHp <= 25 && !lowHpAnnounced.left && window.UI) {
        lowHpAnnounced.left = true;
        UI.announce('ON THE ROPES!', 'accent', 760);
      }
      if (rightHp <= 25 && !lowHpAnnounced.right && window.UI) {
        lowHpAnnounced.right = true;
        UI.announce('ON THE ROPES!', 'accent', 760);
      }

      if ((leftHp === 0 || rightHp === 0) && step >= steps) {
        endedByKO = true;
        end(false);
      }
    }, updateCadence));

    intervals.push(setInterval(() => {
      hype = Math.max(4, hype - 5);
      meter.style.width = `${hype}%`;
    }, 420));

    timer = setTimeout(() => end(false), durationMs);
  });
}

function disableActions(disabled) {
  document.querySelectorAll('[data-action-btn]').forEach((btn) => { btn.disabled = disabled; });
}

window.App = {
  renderNav,
  runEnded,
  formatStats,
  pickRandomRecruitGif,
  showActionOverlay,
  showFightPlayback,
  disableActions,
  appendLatestAction,
  buildFightLatestAction
};


window.__debugUX = async function __debugUX() {
  const summary = { ok: true, checks: [], runId: null };
  try {
    const run = await (window.Api && Api.getRun ? Api.getRun() : Promise.resolve(null));
    if (!run) {
      summary.ok = false;
      summary.checks.push('No active run in this session.');
      return summary;
    }
    summary.runId = run.id;
    const checks = [
      { key: 'turns', ok: Number.isFinite(run.turns) && run.turns >= 0, value: run.turns },
      { key: 'gold', ok: Number.isFinite(run.gold), value: run.gold },
      { key: 'wins', ok: Number.isFinite(run.wins), value: run.wins },
      { key: 'losses', ok: Number.isFinite(run.losses), value: run.losses },
      { key: 'hasGladiator', ok: Array.isArray(run.roster) && run.roster.length > 0, value: run.roster ? run.roster.length : 0 }
    ];
    checks.forEach((c) => {
      if (!c.ok) summary.ok = false;
      summary.checks.push(`${c.key}: ${c.ok ? 'ok' : 'invalid'} (${c.value})`);
    });
    return summary;
  } catch (error) {
    return { ok: false, checks: [`Error: ${error.message}`], runId: summary.runId };
  }
};
