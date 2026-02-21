
/**
 * .js/exporter.js
 * Module responsible for exporting the generated code as a file.
 * Various file type can be supported such as .txt, .pdf etc.
 */



/**
 * Strips the file extension from a filename.
 * Works with any extension length — .mp3, .flac, .mp4, etc.
 * 
 * "interview.mp3"  → "interview"
 * "tlc-audio.mp4"  → "tlc-audio"
 * "podcast.flac"   → "podcast"
 * 
 * @param {string} filename
 * @returns {string}
 */
export function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(0, lastDot) : filename;
}



/**
 * Transforms the editableTranscript array into one clean formatted string.
 * Can be used by pdf or text, pdf exporter, etc 
 * 
 * Output:
 *   Speaker A:
 *      The text for this block...
 * 
 *   Speaker B:
 *      The text for this block...
 * 
 * @param {Array} editableTranscript - The array of utterance objects from script.js
 * @returns {string} - The full formatted transcript as one string
 */
export function formatTranscriptText(editableTranscript) {
  return editableTranscript
    .map(utterance => {
      // .text is the full sentence string on each utterance object
      return `Speaker ${utterance.speaker}:\n   ${utterance.text}`;
    })
    .join('\n\n'); // two newlines between each block = blank line separator
}

/**
 * Downloads the transcript as a .txt file.
 * 
 * @param {Array} editableTranscript - The array of utterance objects from script.js
 * @param {string} audioName - Used as the filename for the downloaded file
 */
export function downloadTXT(editableTranscript, audioName) {

  // Build the formatted string from the transcript data
  const text = formatTranscriptText(editableTranscript);

  // Create the Blob
  const blob = new Blob([text], {type: "text/plain"});
  // create the temporary link
  const src = URL.createObjectURL(blob);
  // ceate the link to be cliked to download
  const linktag = document.createElement('a');
  linktag.href = src
  linktag.download = `${stripExtension(audioName)}.txt`; // strips default file extension (.mp3) and adds .txt
  // init download
  linktag.click();

  // Revoke the blob URL after a short delay to free memory
  // We wait 500ms to make sure the browser has started the download before we clean up
  setTimeout(() => URL.revokeObjectURL(src), 500);
}



