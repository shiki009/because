import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const ALLOWED_TOPICS = ['Learning', 'Ideas', 'Reference', 'Work', 'Inspiration', 'Personal', 'Other'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured. Add it in Vercel → Settings → Environment Variables.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { content = '', because = '' } = body;
    const text = `${content} ${because}`.trim();
    if (!text) {
      return res.status(400).json({ error: 'content or because required' });
    }

    const groq = createGroq({ apiKey });
    const { text: response } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `Classify this bookmark into 1-3 topics. Respond with ONLY a JSON array of topic names, nothing else.
Topics (pick 1-3): Learning, Ideas, Reference, Work, Inspiration, Personal, Other.

Content: "${content}"
Because: "${because}"

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
