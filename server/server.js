// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { AssemblyAI } from 'assemblyai';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('Loaded key:', !!process.env.ASSEMBLYAI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// Ensure /tmp/uploads exists
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer with diskStorage (safer on 512MB free tier)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Initialize AssemblyAI client
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY
});

// In-memory store for refresh-safe polling jobs.
const jobs = new Map();

function cleanupTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('File cleanup error:', err);
      else console.log(`Deleted temp file: ${path.basename(filePath)}`);
    });
  }
}

// POST endpoint that accepts BOTH file uploads AND URLs
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  let filePath = null; // Track file path for cleanup

  try {
    const requestedLanguage = req.body?.language ?? null;
    console.debug('received-language', requestedLanguage);

    // Check if file was uploaded
    if (req.file) {
      filePath = req.file.path; // Save for cleanup
      console.log(`Received file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Validate file size server-side
      if (req.file.size > 500 * 1024 * 1024) {
        cleanupTempFile(filePath);
        return res.status(400).json({ error: 'File too large. Maximum 500MB.' });
      }
    } else if (req.body.audioUrl) {
      const audioSource = req.body.audioUrl;
      console.log(`Received URL: ${audioSource}`);

      // Basic URL validation
      if (!audioSource.startsWith('http://') && !audioSource.startsWith('https://')) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    } else {
      return res.status(400).json({ error: 'No audio file or URL provided' });
    }

    const requestedJobId = typeof req.body?.jobId === 'string' ? req.body.jobId.trim() : '';
    const fallbackJobId = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const jobId = requestedJobId || fallbackJobId;

    const job = {
      id: jobId,
      status: 'processing',
      createdAt: Date.now(),
      transcript: null,
      error: null
    };

    jobs.set(jobId, job);
    res.json({ jobId, status: 'processing' });

    void (async () => {
      try {
        let audioSource;

        if (req.file) {
          // Upload file to AssemblyAI using file stream (more memory efficient)
          console.log('Uploading file to AssemblyAI...');
          audioSource = await client.files.upload(fs.createReadStream(filePath));
          console.log('Upload complete. URL:', audioSource);
        } else {
          // URL was validated above.
          audioSource = req.body.audioUrl;
        }

        // Request transcription (same for both file and URL)
        console.log('Requesting transcription...');
        const transcriptionOptions = {
          audio: audioSource,
          speaker_labels: true,     // enable speaker diarization
          format_text: true,        // punctuation + capitalization / cleaned text

          // other useful options you can toggle:
          // auto_chapters: true,      // creates chapter objects with start/end + summary
          // auto_highlights: true,    // generates highlight snippets
          // punctuate: true,          // explicit punctuation option (if available)
          // entity_detection: true,   // named entity info
          // disfluencies: false       // remove filler words if true/false depending on API version
        };

        if (requestedLanguage === 'auto') {
          transcriptionOptions.language_detection = true;
        } else {
          // Preserve existing default behavior for missing/unknown values.
          transcriptionOptions.language_code = 'en';
        }

        if (requestedLanguage === 'en') {
          transcriptionOptions.language_code = 'en';
          delete transcriptionOptions.language_detection;
        }

        const transcript = await client.transcripts.transcribe(transcriptionOptions);

        if (transcript.status === 'error') {
          throw new Error(transcript.error || 'Transcription failed');
        }

        console.log('Transcription complete!');
        job.status = 'completed';
        job.transcript = transcript;
      } catch (error) {
        console.error('Background transcription error:', error.message);
        job.status = 'failed';
        job.error = error.message;
      } finally {
        // Clean up temp file after AssemblyAI upload/transcription completes.
        cleanupTempFile(filePath);
      }
    })();
  } catch (error) {
    console.error('Server error:', error.message);
    cleanupTempFile(filePath);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status === 'processing') {
    return res.json({ status: 'processing' });
  }

  if (job.status === 'completed') {
    return res.json({ status: 'completed', transcript: job.transcript });
  }

  if (job.status === 'failed') {
    return res.json({ status: 'failed', error: job.error });
  }

  return res.status(500).json({ error: 'Invalid job state' });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
