// Transcription Module - transcribe.js

/**
 * Upload and transcribe function
 *
 * @param {string} type - Either 'file' or 'url'
 * @param {File|string} data - File object or URL string
 * @param {number|null} fileDuration - Optional client-side duration in seconds
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function buildMetrics(transcript, fileDuration = null) {
  const words = Array.isArray(transcript?.words) ? transcript.words : [];
  const confidences = words
    .map((word) => word?.confidence)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const serverDuration = typeof transcript?.audio_duration === 'number' ? transcript.audio_duration : null;
  const duration = typeof fileDuration === 'number' && Number.isFinite(fileDuration) && fileDuration > 0
    ? fileDuration
    : serverDuration;

  return {
    wordCount: words.length,
    avgConfidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : null,
    duration
  };
}

function looksLikeGibberish(text) {
  if (!text || text.length < 3) return true;
  const nonLatin = text.replace(/[A-Za-z0-9\s.,'"\-?!:;()]/g, '');
  const ratio = nonLatin.length / Math.max(1, text.length);
  return ratio > 0.20;
}

export function validateTranscriptQuality(transcript, fileDuration = null) {
  const metrics = buildMetrics(transcript, fileDuration);
  const transcriptText = typeof transcript?.text === 'string' ? transcript.text.trim() : '';
  const wordsPerSecond = metrics.duration && metrics.duration > 0 ? metrics.wordCount / metrics.duration : 0;

  // Thresholds tuned to reject likely music/noise hallucinations while accepting normal speech clips.
  const minWordCount = 5; // Fewer than 5 words is often too little signal for reliable transcript quality.
  const minAvgConfidence = 0.85; // Low average confidence usually means weak/unclear speech recognition.
  const minWordsPerSecond = 0.5; // Very low speech density typically indicates silence/music/background audio.

  console.log(
    '[transcribe-metrics]',
    'language_code:', transcript?.language_code,
    'wordCount:', metrics.wordCount,
    'avgConfidence:', metrics.avgConfidence,
    'duration:', metrics.duration,
    'wordsPerSecond:', wordsPerSecond
  );

  if (!transcriptText || metrics.wordCount < minWordCount) {
    return {
      valid: false,
      reason: 'insufficient_speech',
      metrics
    };
  }

  if (metrics.avgConfidence !== null && metrics.avgConfidence < minAvgConfidence) {
    return {
      valid: false,
      reason: 'low_confidence',
      metrics
    };
  }

  if (metrics.duration !== null && wordsPerSecond < minWordsPerSecond) {
    return {
      valid: false,
      reason: 'low_speech_density',
      metrics
    };
  }

  if (looksLikeGibberish(transcriptText)) {
    return {
      valid: false,
      reason: 'low_quality_transcript',
      metrics
    };
  }

  return {
    valid: true,
    reason: null,
    metrics
  };
}

export async function uploadAndTranscribe(type, data, fileDuration = null, language = null, jobId = null) {
  const emptyMetrics = {
    wordCount: 0,
    avgConfidence: null,
    duration: null
  };

  try {
    let body;
    const headers = {};

    if (type === 'file') {
      const formData = new FormData();
      formData.append('audio', data);
      if (language !== null && language !== undefined) {
        formData.append('language', language);
      }
      if (jobId) {
        formData.append('jobId', jobId);
      }
      body = formData;
      console.log(`Uploading file: ${data.name} , ${data.type} (${data.type})...`);
    } else if (type === 'url') {
      body = JSON.stringify({ audioUrl: data, language, jobId });
      headers['Content-Type'] = 'application/json';
      console.log(`Sending URL: ${data}...`);
    } else {
      return {
        ok: false,
        transcript: null,
        reason: 'invalid_upload_type',
        metrics: emptyMetrics
      };
    }

    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers,
      body
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);

    // Only throw for real transport/server failures so caller can keep separate hard-failure handling.
    if (!response.ok) {
      let errorPayload = null;
      try {
        errorPayload = JSON.parse(text);
      } catch {
        // keep fallback error below
      }
      throw new Error(errorPayload?.error || `Upload failed with status ${response.status}`);
    }

    let transcript;
    try {
      transcript = JSON.parse(text);
    } catch {
      console.error('Failed to parse JSON from server. Raw text payload:', text);
      throw new Error('Invalid JSON response from server');
    }

    const isJobEnvelope = !!(
      transcript &&
      typeof transcript === 'object' &&
      transcript.jobId &&
      transcript.status === 'processing' &&
      transcript.text == null &&
      transcript.utterances == null &&
      transcript.words == null
    );
    if (isJobEnvelope) {
      return {
        ok: true,
        transcript,
        reason: null,
        metrics: emptyMetrics
      };
    }

    const validation = validateTranscriptQuality(transcript, fileDuration);
    if (!validation.valid) {
      return {
        ok: false,
        transcript,
        reason: validation.reason,
        metrics: validation.metrics
      };
    }

    return {
      ok: true,
      transcript,
      reason: null,
      metrics: validation.metrics
    };
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}
