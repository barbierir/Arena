const express = require('express');
const cors = require('cors');
const path = require('path');
const { runs, challenges } = require('./store');
const { createRun, validateRunAccess } = require('./models');
const {
  generateCandidate,
  skipCandidate,
  buyCandidate,
  recruitStarterCandidate,
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
    res.json({ run: result.run, candidate: result.candidate });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/recruit/starter', (req, res) => {
  try {
    const { playerId, candidateId } = req.body;
    const run = getRunOrThrow(req.params.runId, playerId);
    if (run.roster && run.roster.length > 0) return res.status(400).json({ error: { code: 'REQUEST_FAILED', message: 'Starter already recruited' } });
    const result = recruitStarterCandidate(run, playerId, candidateId);
    res.json({ run: result.run, candidate: result.candidate });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/run/:runId/action/train', (req, res) => {
  try {
    const { playerId } = req.body;
    const run = getRunOrThrow(req.params.runId, playerId);
    const result = train(run);
    res.json({ run: result.run, injury: result.injury, statImproved: result.statImproved });
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
    const shareUrl = `/share/challenge/${challenge.id}`;
    res.json({ challengeId: challenge.id, shareUrl, run });
  } catch (error) {
    sendError(res, error);
  }
});


app.get('/api/challenges/open', (req, res) => {
  try {
    const openChallenges = [];
    for (const challenge of challenges.values()) {
      markChallengeExpiredIfNeeded(challenge);
      if (challenge.status !== 'OPEN') continue;
      openChallenges.push({
        id: challenge.id,
        createdAt: challenge.createdAt,
        challengerNameOrId: challenge.runId ? `Run ${String(challenge.runId).slice(0, 8)}` : challenge.id.slice(0, 8)
      });
    }

    openChallenges.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ challenges: openChallenges });
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



app.get('/share/challenge/:challengeId', (req, res) => {
  const challengeId = req.params.challengeId;
  const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('host');
  const origin = `${protocol}://${host}`;
  const shareUrl = `${origin}/share/challenge/${encodeURIComponent(challengeId)}`;
  const imageUrl = `${origin}/assets/gladiator.gif`;
  const acceptUrl = `/challenge.html?id=${encodeURIComponent(challengeId)}`;

  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gladiator Challenge!</title>
    <meta property="og:title" content="Gladiator Challenge!" />
    <meta property="og:description" content="Enter the arena and fight my gladiator." />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${shareUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${imageUrl}" />
    <link rel="stylesheet" href="/styles.css" />
    <style>
      body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:1rem; background:#0f1017; color:#fff; font-family:system-ui,sans-serif; }
      .share-card { max-width:560px; width:100%; border:2px solid #ffd278; border-radius:14px; background:#151826; padding:1.25rem; text-align:center; }
      .share-card img { width:min(100%, 420px); border-radius:10px; margin-bottom:1rem; }
      .share-card a { display:inline-block; margin-top:.5rem; text-decoration:none; color:#10131b; background:#ffd278; font-weight:800; padding:.8rem 1.2rem; border-radius:999px; }
    </style>
  </head>
  <body>
    <div class="share-card">
      <h1>Gladiator Challenge!</h1>
      <p>Enter the arena and fight my gladiator.</p>
      <img src="/assets/gladiator.gif" alt="Gladiator" />
      <div><a href="${acceptUrl}">ACCEPT CHALLENGE</a></div>
    </div>
  </body>
</html>`);
});

app.get('/challenge/:challengeId', (req, res) => {
  res.redirect(`/challenge.html?id=${encodeURIComponent(req.params.challengeId)}`);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
