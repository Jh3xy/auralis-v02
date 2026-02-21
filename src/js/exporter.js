
/**
 * .js/exporter.js
 * Module responsible for exporting the generated code as a file.
 * Various file type can be supported such as .txt, .pdf etc.
 */


/**
 * Transforms the editableTranscript array into one clean formatted string.
 * This is kept as a separate function so it can be reused by the PDF exporter
 * and any other export format without duplicating the logic.
 * 
 * Output format:
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
      // It stays in sync with .words because handleSave rebuilds it on every save
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
  linktag.download = `${audioName}.txt`;
  // init download
  linktag.click();

  // Revoke the blob URL after a short delay to free memory
  // We wait 500ms to make sure the browser has started the download before we clean up
  setTimeout(() => URL.revokeObjectURL(src), 500);
}



