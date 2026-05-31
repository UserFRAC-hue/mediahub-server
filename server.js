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
const GEMINI_KEY = process.env.GEMINI_KEY;

// ANALIZAR IMAGEN CON GEMINI
app.post('/analizar-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const imageData = fs.readFileSync(req.file.path);
    const base64 = imageData.toString('base64');
    const mime = req.file.mimetype;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mime, data: base64 } },
            { text: `Eres experto en marketing de colchones en Colombia. Analiza esta imagen y responde UNICAMENTE con este JSON sin markdown ni explicaciones:
{"titulo":"titulo llamativo maximo 10 palabras","descripcion":"descripcion con emojis y llamada a la accion maximo 5 lineas","hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5","#hashtag6","#hashtag7","#hashtag8","#hashtag9","#hashtag10"]}` }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('Gemini raw:', JSON.stringify(data));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini text:', text);

    // Limpiar y parsear
    const clean = text.replace(/```json/g,'').replace(/```/g,'').trim();
let json;
try {
  json = JSON.parse(clean);
} catch {
  json = {
    titulo: "Error generando título",
    descripcion: text,
    hashtags: []
  };
}
    fs.unlinkSync(req.file.path);
    res.json(json);
  } catch (e) {
    console.error('Error:', e.message);
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
