const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Prüfen ob der API Key geladen wurde
if (!process.env.GEMINI_API_KEY) {
  console.error("⚠️ WARNUNG: GEMINI_API_KEY ist nicht in den Environment Variables gesetzt!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// FIXED: Verwendet den Alias 'gemini-1.5-flash-latest', der vom v1beta-Endpunkt unterstützt wird
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// Endpoint 1: PDF analysieren
app.post('/api/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Bitte lade eine PDF-Datei hoch.' });
    }

    console.log("📄 PDF empfangen, starte Text-Extraktion...");
    let pdfText = "";

    try {
      const pdfData = await pdfParse(req.file.buffer);
      pdfText = pdfData.text ? pdfData.text.substring(0, 50000) : "";
    } catch (parseError) {
      console.error("❌ PDF Parsing Fehler:", parseError.message);
      return res.status(400).json({ 
        error: 'Die hochgeladene Datei ist keine gültige PDF. Bitte erstelle die PDF neu (z. B. via Word/Google Docs als PDF exportieren).' 
      });
    }

    if (!pdfText.trim()) {
      return res.status(400).json({ error: 'Kein lesbarer Text in der PDF gefunden (eventuell ein gescanntes Bild?).' });
    }

    console.log(`✅ Text extrahiert (${pdfText.length} Zeichen). Sende an Gemini...`);

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

    console.log("✨ Gemini Antwort erfolgreich generiert.");

    res.json({
      summary: responseText,
      extractedText: pdfText
    });
  } catch (error) {
    console.error('❌ Fehler in /api/analyze:', error);
    res.status(500).json({ error: 'Fehler bei der Analyse der PDF: ' + (error.message || 'Unbekannter Fehler') });
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
    console.error('❌ Fehler in /api/chat:', error);
    res.status(500).json({ error: 'Fehler beim Antworten auf die Frage.' });
  }
});

// Haupt-Route: Liefert immer die index.html aus
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
