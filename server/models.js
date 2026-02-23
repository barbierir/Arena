const crypto = require('crypto');
const { START_GOLD, START_TURNS } = require('./rules');

const WOUND = Object.freeze({
  HEALTHY: 'healthy',
  LIGHT: 'light',
  SERIOUS: 'serious'
});

const RUN_STATUS = Object.freeze({
  ACTIVE: 'active',
  FINISHED: 'finished'
});

function randomId() {
  return crypto.randomUUID();
}

function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function randomName() {
  const names = ['Ash', 'Bram', 'Cora', 'Dax', 'Eli', 'Faye'];
  return names[randInt(0, names.length - 1)];
}

function createRun(playerId) {
  return {
    id: randomId(),
    playerId,
    status: RUN_STATUS.ACTIVE,
    turns: START_TURNS,
    gold: START_GOLD,
    fame: 0,
    wins: 0,
    losses: 0,
    seriousWoundsTaken: 0,
    wound: WOUND.HEALTHY,
    stats: {
      STR: 1,
      AGI: 1,
      END: 1,
      Talent: 0
    },
    roster: []
  };
}

function validateRunAccess(run, playerId) {
  if (!run) {
    throw new Error('Run not found');
  }
  if (run.playerId !== playerId) {
    throw new Error('Forbidden');
  }
  return run;
}

module.exports = {
  WOUND,
  RUN_STATUS,
  randomId,
  randInt,
  randomName,
  createRun,
  validateRunAccess
};
