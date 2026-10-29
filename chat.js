// Vercel Serverless Function: /api/chat
// Ключ хранится в переменной окружения GROQ_API_KEY (Vercel → Settings → Environment Variables)

const GROQ = 'https://api.groq.com/openai/v1';

let modelsCache = { at: 0, data: null };

module.exports = async function handler(req, res) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY не задан на сервере' } });
  }

  try {
    // GET /api/chat -> список моделей (для pickModel на фронте)
    if (req.method === 'GET') {
      if (!modelsCache.data || Date.now() - modelsCache.at > 60 * 60 * 1000) {
        const r = await fetch(GROQ + '/models', {
          headers: { Authorization: 'Bearer ' + key },
        });
        const j = await r.json();
        if (!r.ok) return res.status(r.status).json(j);
        modelsCache = { at: Date.now(), data: j };
      }
      return res.status(200).json(modelsCache.data);
    }

    // POST /api/chat -> chat completions
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !Array.isArray(body.messages) || !body.model) {
        return res.status(400).json({ error: { message: 'Bad request' } });
      }
      body.stream = false;
      body.max_tokens = Math.min(Number(body.max_tokens) || 1500, 6000);

      const r = await fetch(GROQ + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
        },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(r.status).send(text);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  } catch (e) {
    return res.status(502).json({ error: { message: 'Upstream error: ' + (e && e.message) } });
  }
};

module.exports.config = { maxDuration: 60 };
