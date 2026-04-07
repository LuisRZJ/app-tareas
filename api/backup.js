// api/backup.js — Proxy serverless para sincronización con GitHub
// GET  → descarga el backup.json del repo privado
// POST → sube (crea o actualiza) el backup.json al repo privado

module.exports = async function handler(req, res) {
  // Cabeceras CORS para desarrollo local con `vercel dev`
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER        = process.env.GITHUB_OWNER || 'LuisRZJ';
  const REPO         = process.env.GITHUB_REPO  || 'base-de-datos-app-tareas';
  const FILE_PATH    = 'backup.json';

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN no configurado en variables de entorno' });
  }

  const BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const GH_HEADERS = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'daily-planner-app',
  };

  // ── GET: descargar backup ──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(BASE, { headers: GH_HEADERS });
      if (r.status === 404) return res.status(200).json({ exists: false });
      if (!r.ok) return res.status(502).json({ error: 'Error de GitHub', status: r.status });

      const data = await r.json();
      // El contenido llega en Base64 con saltos de línea; limpiarlos antes de decodificar
      const raw     = data.content.replace(/\n/g, '');
      const content = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      return res.status(200).json({ exists: true, content, sha: data.sha });
    } catch (err) {
      return res.status(500).json({ error: 'Error interno', detail: err.message });
    }
  }

  // ── POST: subir backup ─────────────────────────────────────────
  if (req.method === 'POST') {
    const { payload, sha } = req.body || {};
    if (!payload) return res.status(400).json({ error: 'Falta el campo "payload"' });

    const body = {
      message: `backup ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(payload)).toString('base64'),
    };
    // SHA obligatorio si el archivo ya existe en GitHub
    if (sha) body.sha = sha;

    try {
      const r = await fetch(BASE, {
        method: 'PUT',
        headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const detail = await r.text();
        return res.status(502).json({ error: 'Error al escribir en GitHub', detail });
      }
      const data = await r.json();
      return res.status(200).json({ sha: data.content.sha });
    } catch (err) {
      return res.status(500).json({ error: 'Error interno', detail: err.message });
    }
  }

  res.status(405).end();
};
