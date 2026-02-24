const STORAGE_KEYS = {
  playerId: 'arenaPlayerId',
  runId: 'arenaRunId'
};

const ERROR_MESSAGES = {
  RUN_NOT_FOUND: 'Run not found. Start a new run.',
  CHALLENGE_NOT_FOUND: 'Challenge not found.',
  CHALLENGE_EXPIRED: 'This challenge has expired.',
  CHALLENGE_NOT_OPEN: 'This challenge is no longer open.',
  NO_GLADIATOR: 'Recruit a gladiator first.',
  NOT_ENOUGH_TURNS: 'Not enough turns remaining.',
  NOT_ENOUGH_GOLD: 'Not enough gold.',
  CANDIDATE_NOT_FOUND: 'Candidate not found. Generate another one.',
  CANNOT_TRAIN_SERIOUS_WOUND: 'Cannot train while seriously wounded. Rest first.',
  RUN_NOT_ACTIVE: 'This run is no longer active.',
  FORBIDDEN: 'This run belongs to another player session.'
};

function getPlayerId() {
  return localStorage.getItem(STORAGE_KEYS.playerId);
}

function setPlayerId(playerId) {
  localStorage.setItem(STORAGE_KEYS.playerId, playerId);
}

function getRunId() {
  return localStorage.getItem(STORAGE_KEYS.runId);
}

function setRunId(runId) {
  localStorage.setItem(STORAGE_KEYS.runId, runId);
}

function clearRunId() {
  localStorage.removeItem(STORAGE_KEYS.runId);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.runId);
  localStorage.removeItem(STORAGE_KEYS.playerId);
}

function jsonHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', ...extra };
}

async function request(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = payload && payload.error ? payload.error : { code: 'REQUEST_FAILED', message: 'Request failed' };
    const message = ERROR_MESSAGES[err.code] || err.message || 'Request failed';
    const error = new Error(message);
    error.code = err.code || 'REQUEST_FAILED';
    throw error;
  }

  return payload;
}

async function getRun() {
  const runId = getRunId();
  const playerId = getPlayerId();
  if (!runId || !playerId) return null;
  try {
    const data = await request(`/api/run/${runId}?playerId=${encodeURIComponent(playerId)}`);
    return data.run;
  } catch (error) {
    if (error && (error.code === 'RUN_NOT_FOUND' || error.code === 'FORBIDDEN')) {
      clearSession();
      return null;
    }
    throw error;
  }
}

async function listOpenChallenges() {
  const data = await request('/api/challenges/open');
  return Array.isArray(data.challenges) ? data.challenges : [];
}

function showError(error, targetId = 'error') {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.textContent = error.message;
}

function clearError(targetId = 'error') {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.textContent = '';
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement('textarea');
  temp.value = text;
  temp.style.position = 'fixed';
  temp.style.left = '-1000px';
  document.body.appendChild(temp);
  temp.focus();
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
}

window.Api = {
  STORAGE_KEYS,
  getPlayerId,
  setPlayerId,
  getRunId,
  setRunId,
  clearRunId,
  clearSession,
  request,
  getRun,
  listOpenChallenges,
  jsonHeaders,
  showError,
  clearError,
  copyText
};
