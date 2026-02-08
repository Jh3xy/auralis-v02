
// server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { AssemblyAI } from 'assemblyai';

// Load environment variables from .env file
dotenv.config();

// check if server can see .env file and API key
console.log('Loaded key:', !!process.env.ASSEMBLYAI_API_KEY); // should log true if seen



// Initialize Express app
const app = express();
const PORT = 3001;

// Enable CORS so frontend (port 5173) can call this server (port 3001)
app.use(cors());

// Configure multer to store uploaded files in memory (not on disk)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize AssemblyAI client with API key from .env
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY
});

// POST endpoint that accepts audio file, uploads to AssemblyAI, and returns transcript
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log(`Received file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Upload audio file to AssemblyAI (this sends the file buffer)
    console.log('Uploading to AssemblyAI...');
    const uploadUrl = await client.files.upload(req.file.buffer);
    console.log('Upload complete. URL:', uploadUrl);

    // Request transcription using the uploaded file URL
    console.log('Requesting transcription...');
    const transcript = await client.transcripts.transcribe({
      audio: uploadUrl
    });

    // Check if transcription completed successfully
    if (transcript.status === 'error') {
      return res.status(500).json({ error: transcript.error });
    }

    console.log('Transcription complete!');

    // Return the transcript text to the frontend
    res.json({
      text: transcript.text,
      id: transcript.id,
      status: transcript.status
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoint: POST http://localhost:${PORT}/api/upload`);
});