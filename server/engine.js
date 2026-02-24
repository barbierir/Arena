const { runs, candidates, challenges } = require('./store');
const {
  WOUND,
  RUN_STATUS,
  randomId,
  randInt,
  randomName,
  validateRunAccess
} = require('./models');
const {
  TRAIN,
  REST,
  AI,
  PVP,
  CHALLENGE_TTL_HOURS,
  INJURY_DISTS,
  priceFormula,
  ratingFormula,
  finalScoreFormula
} = require('./rules');

function ensureActive(run) {
  if (run.status !== RUN_STATUS.ACTIVE) {
    throw new Error('Run is not active');
  }
}

function ensureHasGladiator(run) {
  if (!run.roster || run.roster.length === 0) {
    throw new Error('No gladiator recruited');
  }
}

function spendTurns(run, count) {
  if (run.turns < count) {
    throw new Error('Not enough turns');
  }
  run.turns -= count;
  if (run.turns === 0) {
    run.status = RUN_STATUS.FINISHED;
  }
}

function spendGold(run, amount) {
  if (run.gold < amount) {
    throw new Error('Not enough gold');
  }
  run.gold -= amount;
}

function rollDistribution(dist) {
  const r = randInt(1, 100);
  const healthyCap = dist.healthy;
  const lightCap = healthyCap + dist.light;
  if (r <= healthyCap) return WOUND.HEALTHY;
  if (r <= lightCap) return WOUND.LIGHT;
  return WOUND.SERIOUS;
}

function applyInjury(run, dist) {
  const next = rollDistribution(dist);
  run.wound = next;
  if (next === WOUND.SERIOUS) {
    run.seriousWoundsTaken += 1;
  }
  return next;
}

function computePrice(candidateOrStats) {
  return priceFormula(candidateOrStats.stats || candidateOrStats);
}

function computeRating(candidateOrStats) {
  return ratingFormula(candidateOrStats.stats || candidateOrStats);
}

function snapshotRun(run) {
  return {
    runId: run.id,
    playerId: run.playerId,
    rating: computeRating(run),
    stats: { ...run.stats }
  };
}

function resolveFight(a, b) {
  const ratingA = computeRating(a);
  const ratingB = computeRating(b);
  const scoreA = ratingA + randInt(-5, 5);
  const scoreB = ratingB + randInt(-5, 5);

  if (scoreA > scoreB) return { winner: 'A', ratingA, ratingB, scoreA, scoreB };
  if (scoreB > scoreA) return { winner: 'B', ratingA, ratingB, scoreA, scoreB };
  if (ratingA >= ratingB) return { winner: 'A', ratingA, ratingB, scoreA, scoreB };
  return { winner: 'B', ratingA, ratingB, scoreA, scoreB };
}

function generateCandidate(playerId) {
  const perPlayer = candidates.get(playerId) || new Map();
  const candidate = {
    id: randomId(),
    playerId,
    name: randomName(),
    stats: {
      STR: randInt(1, 6),
      AGI: randInt(1, 6),
      END: randInt(1, 6),
      Talent: randInt(0, 3)
    }
  };
  candidate.price = computePrice(candidate);
  candidate.rating = computeRating(candidate);

  perPlayer.set(candidate.id, candidate);
  candidates.set(playerId, perPlayer);
  return candidate;
}

function skipCandidate(run) {
  ensureActive(run);
  spendTurns(run, 1);
  return run;
}

function buyCandidate(run, playerId, candidateId) {
  ensureActive(run);
  validateRunAccess(run, playerId);

  const perPlayer = candidates.get(playerId);
  if (!perPlayer) throw new Error('Candidate not found');

  const candidate = perPlayer.get(candidateId);
  if (!candidate) throw new Error('Candidate not found');

  spendGold(run, candidate.price);
  run.roster.push(candidate.id);
  run.stats.STR += candidate.stats.STR;
  run.stats.AGI += candidate.stats.AGI;
  run.stats.END += candidate.stats.END;
  run.stats.Talent += candidate.stats.Talent;

  perPlayer.delete(candidateId);
  return { run, candidate };
}

function recruitStarterCandidate(run, playerId, candidateId) {
  ensureActive(run);
  validateRunAccess(run, playerId);

  const perPlayer = candidates.get(playerId);
  if (!perPlayer) throw new Error('Candidate not found');

  const candidate = perPlayer.get(candidateId);
  if (!candidate) throw new Error('Candidate not found');

  run.roster.push(candidate.id);
  run.stats.STR += candidate.stats.STR;
  run.stats.AGI += candidate.stats.AGI;
  run.stats.END += candidate.stats.END;
  run.stats.Talent += candidate.stats.Talent;

  perPlayer.delete(candidateId);
  return { run, candidate };
}

function train(run) {
  ensureActive(run);
  ensureHasGladiator(run);
  if (run.wound === WOUND.SERIOUS) {
    throw new Error('Serious wound cannot train');
  }

  spendTurns(run, TRAIN.TURN_COST);
  spendGold(run, TRAIN.GOLD_COST);

  const stats = ['STR', 'AGI', 'END'];
  const statKey = stats[randInt(0, stats.length - 1)];
  run.stats[statKey] = Math.min(TRAIN.STAT_CAP, run.stats[statKey] + 1);
  if (run.wound === WOUND.HEALTHY) {
    return { run, injury: applyInjury(run, INJURY_DISTS.TRAIN_HEALTHY), statImproved: statKey };
  }
  return { run, injury: applyInjury(run, INJURY_DISTS.TRAIN_LIGHT), statImproved: statKey };
}

function rest(run) {
  ensureActive(run);
  ensureHasGladiator(run);

  if (run.wound === WOUND.SERIOUS) {
    spendTurns(run, REST.SERIOUS_TURN_COST);
    run.wound = WOUND.LIGHT;
    return run;
  }

  if (run.wound === WOUND.LIGHT) {
    spendTurns(run, REST.LIGHT_TURN_COST);
    run.wound = WOUND.HEALTHY;
    return run;
  }

  spendTurns(run, REST.LIGHT_TURN_COST);
  return run;
}

function fightAI(run, difficulty = AI.DIFFICULTY.NORMAL) {
  ensureActive(run);
  ensureHasGladiator(run);
  if (![AI.DIFFICULTY.NORMAL, AI.DIFFICULTY.HARD].includes(difficulty)) {
    throw new Error('Invalid difficulty');
  }

  spendTurns(run, AI.TURN_COST);

  const aiStats = difficulty === AI.DIFFICULTY.HARD
    ? { STR: 9, AGI: 9, END: 9, Talent: 2 }
    : { STR: 7, AGI: 7, END: 7, Talent: 1 };

  const result = resolveFight(run, aiStats);
  const won = result.winner === 'A';
  let injury;

  if (won) {
    run.wins += 1;
    run.gold += AI.REWARDS[difficulty].gold;
    run.fame += AI.REWARDS[difficulty].fame;
    injury = applyInjury(run, INJURY_DISTS.AI_WIN);
  } else {
    run.losses += 1;
    injury = applyInjury(run, INJURY_DISTS.AI_LOSS);
  }

  return {
    result: won ? 'win' : 'loss',
    injury,
    ...result,
    run
  };
}

function postChallenge(run) {
  ensureActive(run);
  ensureHasGladiator(run);
  spendTurns(run, PVP.POST_TURN_COST);

  const challenge = {
    id: randomId(),
    runId: run.id,
    playerId: run.playerId,
    snapshot: snapshotRun(run),
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (CHALLENGE_TTL_HOURS * 60 * 60 * 1000)).toISOString(),
    resolvedAt: null,
    result: null,
    accepterRunId: null
  };

  challenges.set(challenge.id, challenge);
  return challenge;
}

function markChallengeExpiredIfNeeded(challenge) {
  if (challenge && challenge.status === 'OPEN' && Date.now() > new Date(challenge.expiresAt).getTime()) {
    challenge.status = 'EXPIRED';
  }
  return challenge;
}

function acceptChallenge(run, challengeId) {
  ensureActive(run);
  ensureHasGladiator(run);
  spendTurns(run, PVP.ACCEPT_TURN_COST);

  const challenge = challenges.get(challengeId);
  if (!challenge) {
    throw new Error('Challenge not found');
  }

  markChallengeExpiredIfNeeded(challenge);
  if (challenge.status !== 'OPEN') {
    throw new Error(challenge.status === 'EXPIRED' ? 'Challenge expired' : 'Challenge already resolved');
  }

  const posterRun = runs.get(challenge.runId);
  if (!posterRun) {
    throw new Error('Poster run not found');
  }

  ensureActive(posterRun);

  const challengerSnapshot = challenge.snapshot;
  const accepterSnapshot = snapshotRun(run);
  const outcome = resolveFight(challengerSnapshot, accepterSnapshot);
  const challengerWon = outcome.winner === 'A';

  let creatorInjury;
  let accepterInjury;

  if (challengerWon) {
    posterRun.wins += 1;
    posterRun.gold += PVP.WIN_REWARD.gold;
    posterRun.fame += PVP.WIN_REWARD.fame;

    run.losses += 1;

    creatorInjury = applyInjury(posterRun, INJURY_DISTS.PVP_WIN);
    accepterInjury = applyInjury(run, INJURY_DISTS.PVP_LOSS);
  } else {
    run.wins += 1;
    run.gold += PVP.WIN_REWARD.gold;
    run.fame += PVP.WIN_REWARD.fame;

    posterRun.losses += 1;

    accepterInjury = applyInjury(run, INJURY_DISTS.PVP_WIN);
    creatorInjury = applyInjury(posterRun, INJURY_DISTS.PVP_LOSS);
  }

  challenge.status = 'RESOLVED';
  challenge.resolvedAt = new Date().toISOString();
  challenge.accepterRunId = run.id;
  challenge.result = {
    winnerRunId: challengerWon ? posterRun.id : run.id,
    loserRunId: challengerWon ? run.id : posterRun.id,
    creatorInjury,
    accepterInjury,
    ...outcome
  };

  return {
    challenge,
    result: challenge.result,
    creatorRun: posterRun,
    accepterRun: run
  };
}

module.exports = {
  computePrice,
  computeRating,
  generateCandidate,
  skipCandidate,
  buyCandidate,
  recruitStarterCandidate,
  train,
  rest,
  fightAI,
  postChallenge,
  acceptChallenge,
  applyInjury,
  markChallengeExpiredIfNeeded,
  finalScoreFormula
};
