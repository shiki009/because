/**
 * Radar chart for Because — visualizes bookmark distribution across topics
 */

const CATEGORIES = [
  { key: 'learning', label: 'Learning', keywords: ['learn', 'study', 'understand', 'course', 'tutorial', 'education', 'knowledge'] },
  { key: 'ideas', label: 'Ideas', keywords: ['idea', 'think', 'concept', 'creative', 'brainstorm'] },
  { key: 'reference', label: 'Reference', keywords: ['reference', 'lookup', 'remember', 'docs', 'documentation', 'guide'] },
  { key: 'work', label: 'Work', keywords: ['work', 'project', 'job', 'professional', 'career', 'task'] },
  { key: 'inspiration', label: 'Inspiration', keywords: ['inspire', 'motivation', 'example', 'role model'] },
  { key: 'personal', label: 'Personal', keywords: ['personal', 'life', 'hobby', 'fun', 'health', 'travel'] }
];

function scoreItem(item, category) {
  const topics = item.topics?.length ? item.topics : ['Other'];
  return topics.includes(category.label) ? 1 : 0;
}

export function computeRadarData(items) {
  if (!items.length) return { labels: [], values: [], counts: [] };

  const values = CATEGORIES.map(cat =>
    items.reduce((sum, item) => sum + scoreItem(item, cat), 0)
  );

  const matched = items.filter(item =>
    CATEGORIES.some(cat => scoreItem(item, cat) > 0)
  );
  const otherCount = items.length - matched.length;
  values.push(otherCount);
  const labels = [...CATEGORIES.map(c => c.label), 'Other'];

  const max = Math.max(...values, 1);
  const normalized = values.map(v => (v / max) * 100);

  return {
    labels,
    values: normalized,
    counts: values
  };
}

export function renderRadarChart(container, data) {
  container.innerHTML = '';

  const size = 320;
  const center = size / 2;
  const radius = 90;
  const n = data.labels.length;
  if (!n) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', 'auto');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.margin = '0 auto';
  svg.style.display = 'block';

  // Grid circles
  for (let r = 1; r <= 4; r++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', center);
    circle.setAttribute('cy', center);
    circle.setAttribute('r', (radius * r) / 4);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#2a2a2a');
    circle.setAttribute('stroke-width', '0.5');
    svg.appendChild(circle);
  }

  // Axis lines and labels
  const points = [];
  data.labels.forEach((label, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', center);
    line.setAttribute('y1', center);
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', '#2a2a2a');
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', center + (radius + 36) * Math.cos(angle));
    text.setAttribute('y', center + (radius + 36) * Math.sin(angle));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', '#8a8a8a');
    text.setAttribute('font-size', '11');
    text.textContent = `${label} (${data.counts[i]})`;
    svg.appendChild(text);

    const value = (data.values[i] / 100) * radius;
    points.push({
      x: center + value * Math.cos(angle),
      y: center + value * Math.sin(angle)
    });
  });

  // Data polygon
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  polygon.setAttribute('d', pathD);
  polygon.setAttribute('fill', 'rgba(212, 168, 83, 0.2)');
  polygon.setAttribute('stroke', '#d4a853');
  polygon.setAttribute('stroke-width', '2');
  polygon.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polygon);

  container.appendChild(svg);
}
