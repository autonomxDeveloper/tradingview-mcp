function safeText(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}

function renderAiSection(title, value) {
  const card = document.createElement('div');
  card.className = 'ai-card';
  const heading = document.createElement('b');
  heading.textContent = title;
  card.appendChild(heading);
  const body = document.createElement('ul');
  const items = Array.isArray(value) ? value : [value || 'None provided.'];
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = typeof item === 'string' ? item : JSON.stringify(item);
    body.appendChild(li);
  });
  card.appendChild(body);
  return card;
}

function renderStructuredAnalysis(payload) {
  if (!payload || !payload.parsed) return false;
  const target = $('analysis');
  target.textContent = '';
  target.classList.add('ai-card-grid');
  [['Summary', payload.summary], ['Trend', payload.trend], ['Key levels', payload.key_levels], ['Risks', payload.risks], ['Invalidation', payload.invalidation], ['Backtest ideas', payload.backtest_ideas], ['Confidence', payload.confidence]].forEach(([title, value]) => target.appendChild(renderAiSection(title, value)));
  return true;
}

async function analyze() {
  const target = $('analysis');
  target.classList.remove('ai-card-grid');
  target.textContent = 'Analyzing...';
  const response = await post('/api/ai/analyze', { symbol: $('symbol').value, asset_type: $('asset').value, exchange: $('exchange').value, timeframe: $('tf').value, question: $('question').value });
  if (!renderStructuredAnalysis(response.structured_analysis)) print(response.analysis?.content || response, 'analysis');
}
