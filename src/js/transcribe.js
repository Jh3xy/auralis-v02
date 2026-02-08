

// Transcription Module - transcribe.js



/**
 * Upload and transcribe function
 * 
 * Uploads audio file to server and gets transcription
 * @param {File} file - Audio file from input element
 * @returns {Promise<string>} - Transcribed text
 */

export async function uploadAndTranscribe(file) {
  try {
    // Create formData to send uploaded audio in HTTp request
    const formData = new FormData()
    formData.append('audio', file)
    console.log(`Uploading ${file.name} - type ${file.type}...`)

    // Send file to server endpoint
    const response = await fetch('http://localhost:3001/api/upload', {
      method: 'POST',
      body: formData
    });

    // if server responds with error
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    // Parse JSON response from server
    const data = await response.json();

    console.log('Data received;', data.text)
    // return transcript text
    return data.text

  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}


