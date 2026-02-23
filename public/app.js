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

window.App = {
  renderNav,
  runEnded,
  formatStats
};
