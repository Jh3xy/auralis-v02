

// Transcription Module - transcribe.js

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
      
      console.log(`Uploading file: ${data.name} (${data.type})...`);
      
    } else if (type === 'url') {
      // URL upload - send JSON
      body = JSON.stringify({ audioUrl: data });
      headers['Content-Type'] = 'application/json';
      
      console.log(`Sending URL: ${data}...`);
      
    } else {
      throw new Error('Invalid upload type. Must be "file" or "url"');
    }
    
    // Send to server
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: headers,
      body: body
    });
    
    // Check for errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    // Parse response
    const result = await response.json();
    console.log('Data received:', result.text);
    
    return result.text;
    
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}