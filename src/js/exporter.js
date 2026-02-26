

/**
 * exporter.js
 * Module responsible for exporting the generated transcript as a file.
 * Supports .txt, .pdf, .docx
 */

import { Document, Packer, Paragraph, TextRun } from "docx";

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
 * Used by txt and pdf exporters.
 *
 * Output:
 *   Speaker A:
 *      The text for this block...
 *
 *   Speaker B:
 *      The text for this block...
 *
 * @param {Array} editableTranscript
 * @returns {string}
 */
export function formatTranscriptText(editableTranscript) {
  return editableTranscript
    .map(utterance => {
      return `Speaker ${utterance.speaker}:\n   ${utterance.text}`;
    })
    .join('\n\n');
}



/**
 * Shared helper — handles the Blob → anchor → click → revoke flow.
 * Used by txt internally. PDF and DOCX handle their own save methods.
 *
 * @param {Blob} blob
 * @param {string} fileName
 */
function triggerBlobDownload(blob, fileName) {
  const src = URL.createObjectURL(blob);
  const linkTag = document.createElement('a');
  linkTag.href = src;
  linkTag.download = fileName;
  linkTag.click();
  setTimeout(() => URL.revokeObjectURL(src), 500);
}



/**
 * Exports the transcript as a .txt file
 *
 * @param {string} text - already formatted transcript string
 * @param {string} baseName - filename without extension
 */
function exportAsTXT(text, baseName) {
  const blob = new Blob([text], { type: 'text/plain' });
  triggerBlobDownload(blob, `${baseName}.txt`);
}



/**
 * Exports the transcript as a .pdf file using jsPDF
 *
 * @param {string} text - already formatted transcript string
 * @param {string} baseName - filename without extension
 */
function exportAsPDF(text, baseName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // splitTextToSize prevents text running off the page edge — 180 is usable width in mm
  const lines = doc.splitTextToSize(text, 180);
  doc.text(lines, 15, 20); // (content, x margin, y margin)
  doc.save(`${baseName}.pdf`); // jsPDF handles its own download — no Blob needed
}



/**
 * Exports the transcript as a .docx file using the docx library
 *
 * @param {Array} editableTranscript - raw transcript array (not the formatted string)
 * @param {string} baseName - filename without extension
 */
async function exportAsDOCX(editableTranscript, baseName) {
  // const { Document, Packer, Paragraph, TextRun } = docx;

  const paragraphs = editableTranscript.flatMap(utterance => [
    new Paragraph({
      children: [
        new TextRun({ text: `Speaker ${utterance.speaker}:`, bold: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `   ${utterance.text}` }),
      ],
    }),
    new Paragraph({ children: [new TextRun({ text: "" })] }),
  ]);

  const doc = new Document({ sections: [{ children: paragraphs }] });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${baseName}.docx`);
}



/**
 * Main export function — called from script.js
 * Decides which exporter to use based on the selected format (dataId)
 *
 * @param {Array} editableTranscript
 * @param {string} audioName
 * @param {string} dataId - "txt" | "pdf" | "docx"
 */
export async function downloadFile(editableTranscript, audioName, dataId) {
  const text = formatTranscriptText(editableTranscript);
  const baseName = stripExtension(audioName);

  if (dataId === 'txt') {
    exportAsTXT(text, baseName);

  } else if (dataId === 'pdf') {
    exportAsPDF(text, baseName);

  } else if (dataId === 'docx') {
    await exportAsDOCX(editableTranscript, baseName);

  } else {
    console.warn(`Unknown export format: ${dataId}`);
  }
}