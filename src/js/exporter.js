
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
export function downloadFile(editableTranscript, audioName, dataId) {

  // Build the formatted text (used by txt and as PDF fallback)
  const text = formatTranscriptText(editableTranscript);
  const baseName = stripExtension(audioName);

  let blob;
  let fileName;

  if (dataId === "txt") {
    blob = new Blob([text], { type: "text/plain" });
    fileName = `${baseName}.txt`;

  } else if (dataId === "pdf") {
    // ⚠️ Real styled PDF needs a library like jsPDF
    // For now this creates a plain .pdf that opens as text in some viewers
    // TODO: swap this out with jsPDF when you're ready
    blob = new Blob([text], { type: "application/pdf" });
    fileName = `${baseName}.pdf`;

  } else {
    console.warn(`Unknown export format: ${dataId}`);
    return; // bail out early if format is unrecognised
  }

  // Everything below is the same regardless of format 👇
  const src = URL.createObjectURL(blob);
  const linkTag = document.createElement('a');
  linkTag.href = src;
  linkTag.download = fileName;
  linkTag.click();

  setTimeout(() => URL.revokeObjectURL(src), 500);
}



