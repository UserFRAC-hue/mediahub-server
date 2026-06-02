const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

const META_TOKEN = process.env.META_TOKEN;
const GROQ_KEY = process.env.GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_VISION = 'llama-3.2-11b-vision-preview';

async function llamarIA(messages, vision=false) {
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: vision ? GROQ_VISION : GROQ_MODEL,
      messages,
      max_tokens: 500
    })
  });
  const data = await r.json();
  console.log('Groq:', JSON.stringify(data).substring(0, 200));
  return data.choices?.[0]?.message?.content || '';
}

app.get('/test', (req, res) => {
  res.json({ GROQ_KEY_existe: !!GROQ_KEY, primeros6: GROQ_KEY?.substring(0,6) });
});

app.post('/chat', async (req, res) => {
  try {
    const { mensaje } = req.body;
    const text = await llamarIA([
      { role: 'system', content: 'Eres un asistente útil. Responde en español.' },
      { role: 'user', content: mensaje }
    ]);
    res.json({ respuesta: text });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/analizar-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const imageData = fs.readFileSync(req.file.path);
    const base64 = imageData.toString('base64');
    const mime = req.file.mimetype;
    const text = await llamarIA([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        { type: 'text', text: `Analiza esta imagen y responde SOLO con este JSON: {"titulo":"titulo llamativo maximo 10 palabras","descripcion":"descripcion con emojis maximo 5 lineas","hashtags":["#col1","#col2","#col3","#col4","#col5","#col6","#col7","#col8","#col9","#col10"]}` }
      ]
    }], true);
    fs.unlinkSync(req.file.path);
    const clean = text.replace(/```json/g,'').replace(/```/g,'').trim();
    res.json(JSON.parse(clean));
  } catch(e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/generar-copy', async (req, res) => {
  try {
    const { empresa, red, tipo, detalle } = req.body;
    const text = await llamarIA([{
      role: 'user',
      content: `Copy para ${red} de la marca "${empresa}". Tipo: ${tipo}. ${detalle||''} Español colombiano, emojis, llamada a la acción, máximo 5 líneas. Solo el copy.`
    }]);
    res.json({ copy: text });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/generar-ideas', async (req, res) => {
  try {
    const { empresa } = req.body;
    const text = await llamarIA([{
      role: 'user',
      content: `5 ideas de contenido para redes de "${empresa}" esta semana. emoji + tipo + idea breve. Una por línea.`
    }]);
    res.json({ ideas: text });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/paginas', async (req, res) => {
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${META_TOKEN}`);
    res.json(await r.json());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/publicar/facebook', upload.single('imagen'), async (req, res) => {
  try {
    const { page_id, page_token, mensaje } = req.body;
    let result;
    if (req.file) {
      const form = new FormData();
      form.append('source', fs.createReadStream(req.file.path));
      form.append('message', mensaje);
      form.append('access_token', page_token);
      const r = await fetch(`https://graph.facebook.com/v19.0/${page_id}/photos`, { method: 'POST', body: form });
      result = await r.json();
      fs.unlinkSync(req.file.path);
    } else {
      const r = await fetch(`https://graph.facebook.com/v19.0/${page_id}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensaje, access_token: page_token })
      });
      result = await r.json();
    }
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/metricas/facebook/:page_id', async (req, res) => {
  try {
    const { page_id } = req.params;
    const { page_token } = req.query;
    const r = await fetch(`https://graph.facebook.com/v19.0/${page_id}/insights?metric=page_impressions,page_reach,page_engaged_users,page_fans&period=day&access_token=${page_token}`);
    res.json(await r.json());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/metricas/instagram/:ig_id', async (req, res) => {
  try {
    const { ig_id } = req.params;
    const { page_token } = req.query;
    const r = await fetch(`https://graph.facebook.com/v19.0/${ig_id}?fields=followers_count,media_count,profile_views&access_token=${page_token}`);
    res.json(await r.json());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MediaHub server en puerto ${PORT}`));
