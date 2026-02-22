

// Transcription Module - transcribe.js


import { showToast } from "./utils.js";

/**
 * Upload and transcribe function
 * 
 * @param {string} type - Either 'file' or 'url'
 * @param {File|string} data - File object or URL string
 * @returns {Promise<string>} - Transcribed text
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
export async function uploadAndTranscribe(type, data) {
  try {
    let body;
    let headers = {};
    
    if (type === 'file') {
      // File upload - use FormData
      const formData = new FormData();
      formData.append('audio', data);
      body = formData;
      
      console.log(`Uploading file: ${data.name} , ${file.type} (${data.type})...`);
      
    } else if (type === 'url') {
      // URL upload - send JSON
      body = JSON.stringify({ audioUrl: data });
      headers['Content-Type'] = 'application/json';
      
      console.log(`Sending URL: ${data}...`);
      
    } else {
      throw new Error('Invalid upload type. Must be "file" or "url"');
    }
    
    // // Send to server
    // const response = await fetch(`${API_BASE}/api/upload`, {
    //   method: 'POST',
    //   headers: headers,
    //   body: body
    // });
    
    // // Check for errors
    // if (!response.ok) {
    //   const error = await response.json();
    //   throw new Error(error.error || 'Upload failed');
    // }

    // IMPORTANT: return the full JSON (contains words / utterances)
    // const result = await response.json();

    /**
     * Quick client-side patch to test encoding bug immediately
     * Temporarily change transcribe.js to force UTF-8 decoding from raw bytes and log headers.
     * Will Replace the response.json() block with this snippet so you can see raw headers and decode the bytes yourself:
     * 
     */

    // --- replace the response.json() part in uploadAndTranscribe() ---
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: headers,
      body: body
    });

    // debug: inspect headers first
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);

    // read raw buffer and decode as UTF-8 explicitly
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);

    // try to parse JSON (catch parse errors to inspect raw payload)
    let result;
    try {
      result = JSON.parse(text);

      // quick garbage-detection helper (client-side)
      function looksLikeGibberish(text) {
        if (!text || text.length < 3) return true;
        // ratio of non-Latin characters
        const nonLatin = text.replace(/[A-Za-z0-9\s.,'"\-?!:;()]/g, '');
        const ratio = nonLatin.length / Math.max(1, text.length);
        // If > 20% of chars are non-Latin, treat as suspect
        return ratio > 0.20;
      }

      // after parsing result:
      console.log('API language_code:', result.language_code, 'text sample:', result.text?.slice(0,120));
      if (result.language_code && result.language_code !== 'en') {
        console.warn('API detected non-en language:', result.language_code);
        // optional: trigger a retry forcing language (see server snippet below)
      }

      // simple client-side guard
      if (looksLikeGibberish(result.text) || (result.words && result.words.length === 0)) {
        // show UI error, do not render the transcript
        showToast('Transcription looks like non-speech or unsupported language — try re-recording or retrying with forced English.', 'warning');
        // Optionally: call endpoint to re-request transcription forcing language: 'en'
        return; // stop rendering the gibberish
      }
    } catch (err) {
      console.error('Failed to parse JSON from server. Raw text payload:', text);
      throw err;
    }

    console.log('Full transcript result received (decoded):', result);
    console.log('Language Code:', result.language_code);
    console.log('Text', result.text);
    console.log('Full transcript result received (decoded):', result);
    return result;

    
  
    // const result = await response.json();
    // console.log('Utterrances', result.utterances);
    // return result; // <-- was result.text before
    
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}