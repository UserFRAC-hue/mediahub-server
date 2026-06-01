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
const OR_KEY = process.env.GEMINI_KEY;
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_MODEL = 'google/gemini-2.0-flash-exp:free';

async function llamarIA(messages) {
  const r = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OR_KEY}`
    },
    body: JSON.stringify({ model: OR_MODEL, messages })
  });
  const data = await r.json();
  console.log('OpenRouter response:', JSON.stringify(data).substring(0, 300));
  return data.choices?.[0]?.message?.content || '';
}

// ANALIZAR IMAGEN CON IA
app.post('/analizar-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const imageData = fs.readFileSync(req.file.path);
    const base64 = imageData.toString('base64');
    const mime = req.file.mimetype;

    const text = await llamarIA([{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        { type: 'text', text: `Eres experto en marketing de colchones en Colombia. Analiza esta imagen y responde UNICAMENTE con este JSON sin markdown: {"titulo":"titulo llamativo maximo 10 palabras","descripcion":"descripcion con emojis y llamada a la accion maximo 5 lineas","hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5","#hashtag6","#hashtag7","#hashtag8","#hashtag9","#hashtag10"]}` }
      ]
    }]);

    console.log('IA text:', text);
    const clean = text.replace(/```json/g,'').replace(/```/g,'').trim();
    const json = JSON.parse(clean);
    fs.unlinkSync(req.file.path);
    res.json(json);
  } catch (e) {
    console.error('Error analizar-imagen:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GENERAR COPY
app.post('/generar-copy', async (req, res) => {
  try {
    const { empresa, red, tipo, detalle } = req.body;
    const text = await llamarIA([{
      role: 'user',
      content: `Eres experto en marketing digital para marcas de colchones en Colombia. Genera un copy para ${red} para la marca "${empresa}". Tipo: ${tipo}. ${detalle ? 'Detalles: ' + detalle : ''} Español colombiano, con emojis, llamada a la accion, maximo 5 lineas. Solo el copy.`
    }]);
    res.json({ copy: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GENERAR IDEAS
app.post('/generar-ideas', async (req, res) => {
  try {
    const { empresa } = req.body;
    const text = await llamarIA([{
      role: 'user',
      content: `5 ideas de contenido para redes sociales de "${empresa}" (colchones) para esta semana. Formato: emoji + tipo (post/historia/reel) + idea breve. Una por linea. Solo las ideas.`
    }]);
    res.json({ ideas: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PÁGINAS META
app.get('/paginas', async (req, res) => {
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${META_TOKEN}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUBLICAR EN FACEBOOK
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MÉTRICAS FACEBOOK
app.get('/metricas/facebook/:page_id', async (req, res) => {
  try {
    const { page_id } = req.params;
    const { page_token } = req.query;
    const r = await fetch(`https://graph.facebook.com/v19.0/${page_id}/insights?metric=page_impressions,page_reach,page_engaged_users,page_fans&period=day&access_token=${page_token}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// MÉTRICAS INSTAGRAM
app.get('/metricas/instagram/:ig_id', async (req, res) => {
  try {
    const { ig_id } = req.params;
    const { page_token } = req.query;
    const r = await fetch(`https://graph.facebook.com/v19.0/${ig_id}?fields=followers_count,media_count,profile_views&access_token=${page_token}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MediaHub server en puerto ${PORT}`));
