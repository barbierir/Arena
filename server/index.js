const express = require('express');
const cors = require('cors');
const path = require('path');
const { runs, challenges } = require('./store');
const { createRun, validateRunAccess } = require('./models');
const {
  generateCandidate,
  skipCandidate,
  buyCandidate,
  train,
  rest,
  fightAI,
  postChallenge,
  acceptChallenge,
  markChallengeExpiredIfNeeded
} = require('./engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: [/^http:\/\/localhost(?::\d+)?$/] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function getRunOrThrow(runId, playerId) {
  const run = runs.get(runId);
  return validateRunAccess(run, playerId);
}

function errPayload(code, message, status = 400) {
  return { status, body: { error: { code, message } } };
}

function mapError(error) {
  const message = error && error.message ? error.message : 'Unknown error';

  if (message === 'Run not found') return errPayload('RUN_NOT_FOUND', message, 404);
  if (message === 'Challenge not found') return errPayload('CHALLENGE_NOT_FOUND', message, 404);
  if (message === 'Poster run not found') return errPayload('RUN_NOT_FOUND', message, 404);
  if (message === 'Forbidden') return errPayload('FORBIDDEN', message, 403);
  if (message === 'Not enough turns') return errPayload('NOT_ENOUGH_TURNS', message, 400);
  if (message === 'Not enough gold') return errPayload('NOT_ENOUGH_GOLD', message, 400);
  if (message === 'Candidate not found') return errPayload('CANDIDATE_NOT_FOUND', message, 404);
  if (message === 'Invalid stat key') return errPayload('INVALID_STAT', message, 400);
  if (message === 'No gladiator recruited') return errPayload('NO_GLADIATOR', message, 400);
  if (message === 'Serious wound cannot train') return errPayload('CANNOT_TRAIN_SERIOUS_WOUND', message, 400);
  if (message === 'Run is not active') return errPayload('RUN_NOT_ACTIVE', message, 400);
  if (message === 'Challenge expired') return errPayload('CHALLENGE_EXPIRED', message, 400);
  if (message === 'Challenge already resolved') return errPayload('CHALLENGE_NOT_OPEN', message, 400);

  return errPayload('INTERNAL_ERROR', message, 500);
}

function sendError(res, error) {
  const mapped = mapError(error);
  res.status(mapped.status).json(mapped.body);
}

app.post('/api/run/new', (req, res) => {
  try {
    const playerId = req.body && req.body.playerId ? req.body.playerId : `p_${Math.random().toString(36).slice(2, 10)}`;
    const run = createRun(playerId);
    runs.set(run.id, run);
    res.status(201).json({ playerId, runId: run.id, run });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/run/:runId', (req, res) => {
  try {
    const playerId = req.query.playerId;
    const run = getRunOrThrow(req.params.runId, playerId);
    res.json({ run });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/recruit/generate', (req, res) => {
  try {
    const playerId = req.body.playerId;
    getRunOrThrow(req.params.runId, playerId);
    const candidate = generateCandidate(playerId);
    res.json({ candidate });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/recruit/skip', (req, res) => {
  try {
    const playerId = req.body.playerId;
    const run = getRunOrThrow(req.params.runId, playerId);
    skipCandidate(run);
    const candidate = generateCandidate(playerId);
    res.json({ run, candidate });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/recruit/buy', (req, res) => {
  try {
    const { playerId, candidateId } = req.body;
    const run = getRunOrThrow(req.params.runId, playerId);
    const result = buyCandidate(run, playerId, candidateId);
    res.json({ run: result.run });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/action/train', (req, res) => {
  try {
    const { playerId, stat } = req.body;
    const keyMap = { str: 'STR', agi: 'AGI', end: 'END' };
    const statKey = keyMap[stat];

    const run = getRunOrThrow(req.params.runId, playerId);
    const result = train(run, statKey);
    res.json({ run: result.run, injury: result.injury });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/action/rest', (req, res) => {
  try {
    const { playerId } = req.body;
    const run = getRunOrThrow(req.params.runId, playerId);
    const updated = rest(run);
    res.json({ run: updated });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/action/fightAI', (req, res) => {
  try {
    const { playerId, difficulty } = req.body;
    const run = getRunOrThrow(req.params.runId, playerId);
    const result = fightAI(run, difficulty || 'normal');
    res.json({ run: result.run, fight: result });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/challenge/post', (req, res) => {
  try {
    const { playerId } = req.body;
    const run = getRunOrThrow(req.params.runId, playerId);
    const challenge = postChallenge(run);
    const shareUrl = `/challenge.html?challengeId=${challenge.id}`;
    res.json({ challengeId: challenge.id, shareUrl, run });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/challenge/:challengeId', (req, res) => {
  try {
    const challenge = challenges.get(req.params.challengeId);
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    markChallengeExpiredIfNeeded(challenge);

    res.json({
      challenge: {
        id: challenge.id,
        status: challenge.status,
        createdAt: challenge.createdAt,
        expiresAt: challenge.expiresAt,
        creatorSnapshot: challenge.snapshot,
        result: challenge.result
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/challenge/:challengeId/accept', (req, res) => {
  try {
    const { runId, playerId } = req.body;
    const accepterRun = getRunOrThrow(runId, playerId);
    const result = acceptChallenge(accepterRun, req.params.challengeId);

    res.json({
      challenge: result.challenge,
      result: result.result,
      creatorRun: result.creatorRun,
      accepterRun: result.accepterRun
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
