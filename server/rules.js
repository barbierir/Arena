const START_TURNS = 50;
const START_GOLD = 100;

const TRAIN = Object.freeze({
  TURN_COST: 1,
  GOLD_COST: 8,
  STAT_CAP: 12
});

const REST = Object.freeze({
  LIGHT_TURN_COST: 1,
  SERIOUS_TURN_COST: 3
});

const AI = Object.freeze({
  TURN_COST: 1,
  DIFFICULTY: {
    NORMAL: 'normal',
    HARD: 'hard'
  },
  REWARDS: {
    normal: { gold: 12, fame: 1 },
    hard: { gold: 20, fame: 2 }
  }
});

const PVP = Object.freeze({
  POST_TURN_COST: 1,
  ACCEPT_TURN_COST: 1,
  WIN_REWARD: {
    gold: 20,
    fame: 2
  }
});

const CHALLENGE_TTL_HOURS = 48;

const INJURY_DISTS = Object.freeze({
  TRAIN_HEALTHY: { healthy: 80, light: 18, serious: 2 },
  TRAIN_LIGHT: { healthy: 70, light: 25, serious: 5 },
  AI_WIN: { healthy: 85, light: 15, serious: 0 },
  AI_LOSS: { healthy: 55, light: 35, serious: 10 },
  PVP_WIN: { healthy: 80, light: 20, serious: 0 },
  PVP_LOSS: { healthy: 45, light: 45, serious: 10 }
});

function priceFormula(stats) {
  return 10 + (3 * (stats.STR + stats.AGI + stats.END)) + (6 * stats.Talent);
}

function ratingFormula(stats) {
  return (1.2 * stats.STR) + (1.1 * stats.AGI) + (1.3 * stats.END) + (2 * stats.Talent);
}

function finalScoreFormula(run) {
  return (
    (run.wins * 10) +
    (run.fame * 5) +
    ((run.stats.STR + run.stats.AGI + run.stats.END) * 2) +
    Math.floor(run.gold / 2) -
    (run.seriousWoundsTaken * 5)
  );
}

module.exports = {
  START_TURNS,
  START_GOLD,
  TRAIN,
  REST,
  AI,
  PVP,
  CHALLENGE_TTL_HOURS,
  INJURY_DISTS,
  priceFormula,
  ratingFormula,
  finalScoreFormula
};
