const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static('public'));

// Gemini Client mit dem offiziellen SDK initialisieren
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Endpoint 1: PDF analysieren
app.post('/api/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bitte lade eine PDF-Datei hoch.' });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text.substring(0, 50000);

    const prompt = `
    Du bist ein Experte für AGBs und Verträge. Analysiere diesen Text kurz und prägnant auf Deutsch.
    Heb besonders hervor:
    1. ⚠️ Mögliche Haken oder ungewöhnliche Klauseln
    2. 📅 Kündigungsfristen & Laufzeiten
    3. 💰 Versteckte Kosten oder automatische Verlängerungen

    Text:
    ${pdfText}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({
      summary: responseText,
      extractedText: pdfText
    });
  } catch (error) {
    console.error('Gemini API Fehler:', error);
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
    Beantworte die folgende Frage präzise und auf Deutsch, ausschließlich basierend auf dem Dokumententext.

    Dokument:
    ${pdfText.substring(0, 50000)}

    Frage: ${question}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ answer: responseText });
  } catch (error) {
    console.error('Gemini Chat Fehler:', error);
    res.status(500).json({ error: 'Fehler beim Antworten auf die Frage.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
