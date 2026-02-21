/**
 * Because — Browser-side AI classification
 * Calls provider REST APIs directly with the user's own key.
 * Supports: Groq, OpenAI, Google Gemini
 */

const ALLOWED_TOPICS = ['Learning', 'Ideas', 'Reference', 'Work', 'Inspiration', 'Personal', 'Other'];

const PROMPT = (content, because) =>
  `Classify this bookmark into 1-3 topics from the list below. Respond with ONLY a JSON array, nothing else.
Topics: Learning, Ideas, Reference, Work, Inspiration, Personal, Other.

Content: [${content}]
Because: [${because}]

Example response: ["Learning", "Reference"]`;

function parseTopics(text) {
  try {
    const match = text.match(/\[[\s\S]*?\]/);
    const arr = match ? JSON.parse(match[0]) : ['Other'];
    const lower = ALLOWED_TOPICS.map(t => t.toLowerCase());
    const valid = (Array.isArray(arr) ? arr : [arr])
      .map(t => {
        const s = String(t).trim().toLowerCase();
        const i = lower.indexOf(s);
        return i >= 0 ? ALLOWED_TOPICS[i] : null;
      })
      .filter(Boolean);
    return valid.length ? valid : ['Other'];
  } catch {
    return ['Other'];
  }
}

function sanitize(str, maxLen) {
  return String(str || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, maxLen);
}

async function classifyGroq(content, because, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: PROMPT(content, because) }],
      temperature: 0.1,
      max_tokens: 64
    })
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return parseTopics(data.choices?.[0]?.message?.content || '');
}

async function classifyOpenAI(content, because, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: PROMPT(content, because) }],
      temperature: 0.1,
      max_tokens: 64
    })
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return parseTopics(data.choices?.[0]?.message?.content || '');
}

async function classifyGemini(content, because, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(content, because) }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 64 }
    })
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return parseTopics(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

export async function classifyWithUserKey(content, because, provider, apiKey) {
  const c = sanitize(content, 2000);
  const b = sanitize(because, 1000);
  switch (provider) {
    case 'openai':  return classifyOpenAI(c, b, apiKey);
    case 'gemini':  return classifyGemini(c, b, apiKey);
    case 'groq':
    default:        return classifyGroq(c, b, apiKey);
  }
}

export function getUserAIConfig() {
  const provider = localStorage.getItem('because-ai-provider') || 'groq';
  const apiKey   = localStorage.getItem('because-ai-key') || '';
  return { provider, apiKey };
}

export function saveUserAIConfig(provider, apiKey) {
  localStorage.setItem('because-ai-provider', provider);
  localStorage.setItem('because-ai-key', apiKey);
}

export function clearUserAIConfig() {
  localStorage.removeItem('because-ai-provider');
  localStorage.removeItem('because-ai-key');
}
