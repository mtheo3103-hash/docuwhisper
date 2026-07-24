const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint 1: PDF analysieren
app.post('/api/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bitte lade eine PDF-Datei hoch.' });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text.substring(0, 12000); // Max 12k Zeichen für schnellen Check

    const prompt = `
    Du bist ein Experte für AGBs und Verträge. Analysiere diesen Text kurz und prägnant.
    Heb besonders hervor:
    1. ⚠️ Mögliche Haken oder ungewöhnliche Klauseln
    2. 📅 Kündigungsfristen & Laufzeiten
    3. 💰 Versteckte Kosten oder automatische Verlängerungen

    Text:
    ${pdfText}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({
      summary: response.choices[0].message.content,
      extractedText: pdfText
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler bei der Analyse der PDF.' });
  }
});

// Endpoint 2: Fragen zum Dokument stellen
app.post('/api/chat', async (req, res) => {
  try {
    const { question, pdfText } = req.body;

    if (!question || !pdfText) {
      return res.status(400).json({ error: 'Frage oder Dokumententext fehlt.' });
    }

    const prompt = `
    Beantworte die folgende Frage präzise und ausschließlich basierend auf dem Dokumententext.

    Dokument:
    ${pdfText.substring(0, 12000)}

    Frage: ${question}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Antworten auf die Frage.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
