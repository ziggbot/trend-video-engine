import './fetch-trends.js';
setTimeout(async () => {
  await import('./score-topics.js');
  await import('./generate-brief.js');
  await import('./generate-script.js');
}, 100);
