import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const ALLOWED_TOPICS = ['Learning', 'Ideas', 'Reference', 'Work', 'Inspiration', 'Personal', 'Other'];

const ALLOWED_ORIGINS = [
  'https://because-five.vercel.app',
  'http://localhost:8765',
  'http://localhost:3000',
  'http://127.0.0.1:8765',
  'http://127.0.0.1:3000',
];

function sanitize(str, maxLen) {
  return String(str || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, maxLen);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI segmentation is not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const content = sanitize(body.content, 2000);
    const because = sanitize(body.because, 1000);

    if (!content && !because) {
      return res.status(400).json({ error: 'content or because required' });
    }

    const groq = createGroq({ apiKey });
    const { text: response } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `Classify this bookmark into 1-3 topics from the list below. Respond with ONLY a JSON array, nothing else.
Topics: Learning, Ideas, Reference, Work, Inspiration, Personal, Other.

Content: [${content}]
Because: [${because}]

Example response: ["Learning", "Reference"]`
    });

    const match = response.match(/\[[\s\S]*?\]/);
    const arr = match ? JSON.parse(match[0]) : ['Other'];
    const lower = ALLOWED_TOPICS.map(t => t.toLowerCase());
    const valid = (Array.isArray(arr) ? arr : [arr])
      .map(t => {
        const s = String(t).trim().toLowerCase();
        const i = lower.indexOf(s);
        return i >= 0 ? ALLOWED_TOPICS[i] : null;
      })
      .filter(Boolean);
    return res.status(200).json({ topics: valid.length ? valid : ['Other'] });
  } catch (err) {
    console.error('Segment error:', err);
    return res.status(200).json({ topics: ['Other'] });
  }
}
