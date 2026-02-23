

// !IMPORTANT: Notes:
// - Include keyboard support for saving and posibbly editing (transcript editor is already setup for this with textarea, just need to add event listener for keydown and check if it's ctrl/cmd + s, then trigger save logic)


// Import Stylesheets
import './styles/variables.css'
import './styles/resets.css'
import './styles.css'
import './styles/utils.css'
import './styles/onboarding.css'
import './styles/transcripts.css'
import './styles/queries.css'


const TRANSCRIPT_KEY = 'auralis-transcript'
const APP_VERSION = 'v1.5-1.00';
const MIN_UPLOAD_DURATION = 2.5;
const plan = document.querySelector('.plan');
plan.innerText = `Beta - ${APP_VERSION}`
console.log('Vite is Running Script!');
console.log(`Auralis ${APP_VERSION}`)

// Import JS files here
  
import { toggleClass, createInitials, formatTime, formatDate, saveToLocalStorage, getRelativeTime} from './js/utils.js'
import { uploadAndTranscribe } from "./js/transcribe.js";
import { saveAudioBlob, getAudioBlob, clearAudioBlob } from './js/audioDB.js';
import { downloadTXT } from './js/exporter.js';
import { eventHub } from "./js/eventhub.js";


let utterances;
window.utterances = utterances;
window.createInitials = createInitials
window.getAudioBlob = getAudioBlob; // expose IndexedDB audio reader for ad-hoc console debugging
window.saveAudioBlob = saveAudioBlob;

let session = null
let originalTranscript = null // store original transcript result - Full API response Object
let editableTranscript = null // store editable transcript result - Array of utternaces from API result object
let hasClicked = false;
let sizeInMB;

const transcriptAudio = document.getElementById('audio-engine');

function toEditableUtterances(utterances = []) {
  return utterances.map((utterance) => ({
    speaker: utterance.speaker,
    start: utterance.start,
    end: utterance.end,
    text: utterance.text,
    words: (utterance.words || []).map((word) => ({
      text: word.text,
      start: word.start,
      end: word.end
    }))
  }));
}

function inflateUtterancesForRender(utterances = [], originalIndex = null) {
  return utterances.map((utterance, idx) => {
    const text = (utterance.text || '').trim();
    const fallbackKey = `fb:${String(utterance.speaker ?? '')}|${text.slice(0, 40).toLowerCase()}`;
    const idKey = utterance.id != null ? `id:${utterance.id}` : null;
    const canonical = originalIndex
      ? ((idKey && originalIndex.get(idKey)) || originalIndex.get(fallbackKey) || null)
      : null;

    const baseWords = Array.isArray(utterance.words) && utterance.words.length
      ? utterance.words.map((word) => ({
          text: word.text,
          start: word.start ?? null,
          end: word.end ?? null
        }))
      : (text
          ? text.split(/\s+/).map((wordText) => ({ text: wordText, start: null, end: null }))
          : []);

    let foundTiming = false;
    let reason = 'no_original_match';
    let mergedStart = utterance.start ?? null;
    let mergedEnd = utterance.end ?? null;

    if (canonical && Array.isArray(canonical.words) && canonical.words.length) {
      reason = 'matched_original';
      if (mergedStart == null && canonical.start != null) mergedStart = canonical.start;
      if (mergedEnd == null && canonical.end != null) mergedEnd = canonical.end;

      // Best-effort timing merge by word text; preserves compact snapshot schema while restoring karaoke timings.
      const buckets = new Map();
      canonical.words.forEach((word) => {
        const key = String(word.text || '').toLowerCase();
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(word);
      });

      baseWords.forEach((word) => {
        const key = String(word.text || '').toLowerCase();
        const queue = buckets.get(key);
        if (queue && queue.length) {
          const timedWord = queue.shift();
          if (word.start == null && timedWord.start != null) word.start = timedWord.start;
          if (word.end == null && timedWord.end != null) word.end = timedWord.end;
        }
        if (word.start != null || word.end != null) foundTiming = true;
      });

      if (!foundTiming && (mergedStart != null || mergedEnd != null)) {
        foundTiming = true;
        reason = 'utterance_level_timing_only';
      } else if (!foundTiming) {
        reason = 'matched_without_word_timing';
      }
    }

    if (!foundTiming) {
      reason = reason === 'no_original_match' ? reason : 'timing_not_recoverable';
    }

    // console.debug('[inflate-timing]', {
    //   index: idx,
    //   id: utterance.id ?? canonical?.id ?? null,
    //   foundTiming,
    //   reason
    // });

    return {
      ...utterance,
      start: mergedStart,
      end: mergedEnd,
      words: baseWords,
      no_timing: !foundTiming
    };
  });
}

function buildSessionSnapshot(baseSession, utterances = []) {
  // Keep localStorage payload compact to avoid quota failures on large transcripts.
  return {
    audio_duration: baseSession.audio_duration,
    confidence: baseSession.confidence,
    language_code: baseSession.language_code,
    id: baseSession.id,
    text: baseSession.text,
    date: baseSession.date,
    speakercount: baseSession.speakercount,
    title: baseSession.title,
    audio_size: baseSession.audio_size,
    utterances: utterances.map((u) => ({
      speaker: u.speaker,
      start: u.start,
      end: u.end,
      text: u.text
    }))
  };
}

// Restore transcripts, etc on load
document.addEventListener('DOMContentLoaded', async () => {

  const storageKey = 'auralis-onboarding';
  const onboarding = JSON.parse(localStorage.getItem(storageKey));
  
  if (onboarding && onboarding.username) {
    createInitials(onboarding.username);
    console.log('Username restored from localStorage');
  }


  // on DOMContentLoaded check storage for current section
  const currentSection = localStorage.getItem('current-section')
  if (currentSection) {
    // console.log(`${currentSection} section found`)
    
    // loop through sections remove show class and add to matching section
    const sections = document.querySelectorAll('.section');
    sections.forEach((section)=> {
      if (section.id === currentSection) {
        // Remove show class from all sections
        sections.forEach((sec) => sec.classList.remove('show'));
        // Add show class to the matching section
        section.classList.add('show');
        // console.log(`Switched to section: ${currentSection} after reload`);
      }
    })
    
    // Also update active class in navbar
    const navlinks = document.querySelectorAll('.nav-link')
    
    // First, remove active from all nav links
    navlinks.forEach((navLink) => {
      navLink.classList.remove('active') 
    })
    
    // Then add active to the matching one
    navlinks.forEach((navLink) => {
      if (navLink.dataset.id === currentSection) {
        navLink.classList.add('active') 
        // console.log(`Activated nav link: ${currentSection}`)
      }
    })
  } else {
    console.warn('Could not find current section')
  }


  
  const savedOriginalRaw = localStorage.getItem('originalTranscript');
  const savedData = localStorage.getItem(TRANSCRIPT_KEY);
  if (!savedData && !savedOriginalRaw) return;

  const projectSection = document.getElementById('projects');
  const savedOriginal = savedOriginalRaw ? JSON.parse(savedOriginalRaw) : null;
  const savedSession = savedData ? JSON.parse(savedData) : null;
  const originalIndex = new Map();

  // Build canonical index first so compact snapshot can be inflated deterministically on any reload.
  if (savedOriginal && Array.isArray(savedOriginal.utterances)) {
    savedOriginal.utterances.forEach((utterance) => {
      if (utterance?.id != null) {
        originalIndex.set(`id:${utterance.id}`, utterance);
      }
      const key = `fb:${String(utterance?.speaker ?? '')}|${String(utterance?.text || '').slice(0, 40).toLowerCase()}`;
      if (!originalIndex.has(key)) originalIndex.set(key, utterance);
    });
  }

  if (!savedSession && savedOriginal && Array.isArray(savedOriginal.utterances)) {
    const clientMeta = savedOriginal._client || {};
    originalTranscript = savedOriginal;
    editableTranscript = toEditableUtterances(savedOriginal.utterances);
    session = {
      audio_duration: savedOriginal.audio_duration,
      confidence: savedOriginal.confidence,
      language_code: savedOriginal.language_code,
      id: savedOriginal.id,
      text: savedOriginal.text,
      date: clientMeta.date || Date.now(),
      speakercount: clientMeta.speakercount || '--',
      title: clientMeta.title || savedSession?.title || 'Untitled',
      audio_size: clientMeta.audio_size || savedSession?.audio_size || '--',
      utterances: editableTranscript
    };
  } else {
    session = savedSession;
    originalTranscript = savedOriginal || null;
    editableTranscript = inflateUtterancesForRender(savedSession?.utterances || [], originalIndex);
    if (session) session.utterances = editableTranscript;
  }

  // Restore UI metadata
  document.querySelector('.lang').innerText = session.language_code || '--';
  document.querySelector('.transcript-title').innerText = session.title || 'Untitled';
  document.querySelector('.audio-name').innerText = session.title || 'Untitled';
  document.querySelector('.lang').innerText = session.language_code || '--';
  document.querySelector('.audio-size').innerText = session.audio_size || '--';
  // These two are missing:
  document.querySelector('.current-date').innerText = session.date ? formatDate(session.date, true) : '--';
  document.querySelector('.speakers').innerText = session.speakercount || '--';
  document.querySelector('.audio-duration').innerText = session.audio_duration ? formatTime(session.audio_duration * 1000) : '--';
  

  renderTranscript(editableTranscript);
  updateState(projectSection, 'loaded');
  showToast('Previous session restored', 'info');


  // Try to restore the audio too
  const savedBlob = await getAudioBlob();
  if (savedBlob) {
    const src = URL.createObjectURL(savedBlob);
    currentAudioUrl = src;
    transcriptAudio.crossOrigin = 'anonymous';
    transcriptAudio.preload = 'metadata';
    transcriptAudio.src = src;
    transcriptAudio.load();

    // Enable the audio player UI since we have audio
    document.querySelector('.audio-player').classList.remove('is-disabled');
    console.log('Audio restored from IndexedDB');
  } else {
    // No audio saved (URL upload or first visit) - keep player disabled
    document.querySelector('.audio-player').classList.add('is-disabled');
  }
});


// Function to set UI states
function updateState(element, state) {
  const states = ['loading', 'loaded'];
  element.classList.remove(...states)
  element.classList.add(state)
}

// Wait promise for enforcng mimimum dispay time
// This creates a "pause" that doesn't freeze the browser and ensures UI states are intentional
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Show toast Utility
export function showToast(msg, type = 'info', duration = 4500, cta = null) {
  // Create or get toast container
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.classList.add('toast-container');
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.classList.add('toast', type);
  
  // Create toast message
  const message = document.createElement('span');
  message.classList.add('toast-message');
  const icon = document.createElement('div');
  icon.classList.add('icon');
  message.textContent = msg;
  const i = document.createElement('i');
  i.dataset.lucide = type === 'error' ? 'circle-x' : type === 'success' ? 'circle-check' : type === 'warning' ? 'triangle-alert' : 'info';
  icon.appendChild(i);
  message.prepend(icon);
  
  
  
  // Append message to toast
  toast.appendChild(message);

  if (cta && typeof cta.label === 'string' && typeof cta.callback === 'function') {
    const ctaButton = document.createElement('button');
    ctaButton.type = 'button';
    ctaButton.classList.add('btn', 'toast-cta');
    ctaButton.innerText = cta.label;
    ctaButton.addEventListener('click', () => {
      try {
        cta.callback();
      } catch (error) {
        console.error('Toast CTA callback failed:', error);
      }

      toast.classList.add('removing');
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    });
    toast.appendChild(ctaButton);
  }
  
  // Append toast to container
  container.appendChild(toast);
  lucide.createIcons(); // Render icon in new toasts
  console.log(container)
  window.container = container; // Expose for debugging 

  const dismissDelay = cta ? Math.max(duration, 12000) : duration;

  // Auto-dismiss after .removing animation duration in./styles/utils.js 
  setTimeout(() => {
    toast.classList.add('removing');
    // Remove from DOM after animation completes
    setTimeout(() => {
      toast.remove();
      // Remove container if no more toasts
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300); // Match animation duration
  }, dismissDelay);
  
  console.log(`Toast: ${msg} (${type})`);
}

/**
 * Function to Render Transcript from editableTranscript()
 * It :
 *  Reads state,
 * Produces DOM
 * @param {Array} transcriptData - The editableTranscript array containing the transcript (utternace) data to render
*/
const transcriptEditor = document.querySelector('.transcript-body');
let editingIndex = null; //for tracking current editing block

function renderTranscript(array) {
  // Todo: check if editor holds any transcripts - save audio & transcripts as draft in recordings section
  transcriptEditor.innerHTML = '';

  // Confirm if param is an array
  if (!Array.isArray(array)) {
    console.log(`${array} is not an array`);
    return;
  }
  array.forEach(
    (utterance, index)=> {
      let contentHTML = ''; //Initialize what content should be (textarea or span) based on editingIndex === index
      const startTime = formatTime(utterance.start)
      const endTime = formatTime(utterance.end)
      
      // Check if editing index is equal to index to change contentHTML
      if (editingIndex === index) {
        const textvalue = utterance.words.map(
          (word)=> {
            return `${word.text}`;
          }
        ).join(' ');
        contentHTML = `<textarea class="edit-textarea">${textvalue}</textarea>`
        console.log(contentHTML)
      } else {
        contentHTML = utterance.words.map(
          (word)=> {
            return `<span data-start="${word.start}" data-end="${word.end}">${word.text}</span>`
          }
        ).join(' ');
      }

      // Then Create dynamic speaker block now to use contentHTML
      const speakerBox = `
        <div class="speaker-box flex items-start gap-8 ${editingIndex === index ? 'is-editing': ''}" data-index="${index}">
          <div class="speaker-tag flex gap-1 shrink-0 flex-col">
            <span class="speaker">Speaker ${utterance.speaker}</span>
            <span class="speaker-metadata sub-text"> ${startTime} - ${endTime}</span>
              <div class="edit-controls flex gap-2">
                <button class="edit-btn btn"><i data-lucide="square-pen"></i></button>
                <div class="controls-secondary flex gap-1">
                <button class="save-btn btn"><i data-lucide="save"></i></button>
                <button class="cancel-btn btn"><i data-lucide="ban"></i></button>
                </div>
              </div>
            </div>
          <p class="speaker-text">${contentHTML}</p>
        </div>
      `
      // Insert each block before end
      transcriptEditor.insertAdjacentHTML('beforeend', speakerBox);
    }
  )
  console.log('Finished Rendering Transcript')
  lucide.createIcons(); //Re-init .edit-controls icons
};

/**
 * Function to update transcript state based on index and mode (editing or normal)
 * - This is more efficient than calling renderTranscript() everytime
 * @param {*} index 
 * @param {*} mode 
 */
function updateTranscriptState(index, mode) {
  // find element with data-index ="${index}"
  const speakerBox = document.querySelectorAll('.speaker-box')
  const currentSpeakerBlock = document.querySelector(`[data-index="${index}"]`)
  const currentSpeakerText = currentSpeakerBlock.querySelector('.speaker-text')
  speakerBox.forEach(box => {
    box.classList.remove('is-editing');
  });

  if (mode !== 'editing' && mode !== 'normal') {
    console.warn(`Invalid mode: ${mode}`);
    return;
  }

  if (mode === 'editing') {
    currentSpeakerBlock.classList.add('is-editing');
    console.log(currentSpeakerBlock)
    console.log(currentSpeakerText)
    
    // Mark the transcript body so ALL edit buttons get hidden globally
    transcriptEditor.classList.add('has-editing');
    // update text in editableTranscript directly
    console.log(editableTranscript[index].words)
    const textContent = editableTranscript[index].words.map(
      (word)=> {
        return word.text
      }
    ).join(' ');
    console.log(editableTranscript[index])
    console.log(textContent)
    // insert textarea into currentSpeakerBlock
    const textarea = `<textarea class="edit-textarea">${textContent}</textarea>`;
    currentSpeakerText.innerHTML = textarea;
  } else if (mode === 'normal') {
    // Rebuild the specific block from editableTranscript data to reflect any changes
    currentSpeakerBlock.classList.remove('is-editing');
    transcriptEditor.classList.remove('has-editing');
    const contentHTML = editableTranscript[index].words.map((wordData) => {
      const start = wordData.start;
      const end = wordData.end;
      return `<span data-start="${start}" data-end="${end}">${wordData.text}</span>`
    }).join(' ')
    currentSpeakerText.innerHTML = contentHTML;
  }
}


/**
 * Add eventlistners for edit, save and cancel button
 * Use event delegation on parent to avoid multiple event listners added
 */

transcriptEditor.addEventListener("click", (e)=> {
  
  // grab the btns that were clicked using closest
  const editbtn = e.target.closest('.edit-btn');
  const savebtn = e.target.closest('.save-btn');
  const cancelbtn = e.target.closest('.cancel-btn');
  console.log(e.target)
  
  
  // check which among the btnsare not null
  if (editbtn) {
    if (hasClicked) {
     // pause audio for editing
      if (!transcriptAudio.paused) {
        transcriptAudio.pause();
        playBtn.innerHTML = `<i data-lucide="play"></i>`;
        lucide.createIcons();
      }
    }
    const speakerbox = editbtn.closest('.speaker-box');
    //Force data type of data-index in speakerbox to be number if speakerbox exists
    let index = speakerbox ? Number(speakerbox.dataset.index) : null; 
    handleEdit(index);
    console.log(editbtn);

    // Add keydown for save here so it only applies when editing
    document.addEventListener('keydown', handleKeyDown);
  } else if (savebtn) {
    
    if (hasClicked) {
      // play if paused for better UX after saving edits
      if (transcriptAudio.paused) {
        transcriptAudio.play();
        playBtn.innerHTML = `<i data-lucide="pause"></i>`;
        lucide.createIcons();
      }
      
    }
    
    const speakerbox = savebtn.closest('.speaker-box');
    let index = speakerbox ? Number(speakerbox.dataset.index) : null; 
    handleSave(index);
    updateTranscriptStorage(index)
    console.log(savebtn)
  } else if (cancelbtn) {
    
    if (hasClicked) {
      // play if paused for better UX after saving edits
      if (transcriptAudio.paused) {
        transcriptAudio.play();
        playBtn.innerHTML = `<i data-lucide="pause"></i>`;
        lucide.createIcons();
      }
    }

    const speakerbox = cancelbtn.closest('.speaker-box');
    let index = speakerbox ? Number(speakerbox.dataset.index) : null; 
    cancelEdit(index)
  } else {
    return;
  }
})


function handleKeyDown(e) {
  // Only handle keydown if we're in editing mode
  if (!transcriptEditor.classList.contains('has-editing')) return;

  // Check for Ctrl/Cmd + S (save)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault(); // Prevent default save behavior (e.g., browser save dialog)
    const index = editingIndex;
    handleSave(index);
    updateTranscriptStorage(index);
  }
}



let lastSavedAt = null; // store auto-save timestamp globally

/**
 * FUNCTION TO UPDATE TRANSCRIPT UTTERANCE ARRAY BASED ON INDEX
 * It parses editable the session object and narrows down to the utterance in question based on index, 
 * then updates the words array of that utterance with the new text from textarea while keeping timing data where possible
 */

function updateTranscriptStorage(index) {
  const raw = localStorage.getItem(TRANSCRIPT_KEY);
  if (!raw) return;
  
  const parsed = JSON.parse(raw); // parsed is now the session object

  if (!Array.isArray(parsed.utterances)) parsed.utterances = [];
  // Persist compact utterance shape to keep snapshot small and quota-safe.
  parsed.utterances[index] = {
    speaker: editableTranscript[index].speaker,
    start: editableTranscript[index].start,
    end: editableTranscript[index].end,
    text: editableTranscript[index].text
  };
  parsed.text = editableTranscript.map((u) => u.text).join(' ');

  saveToLocalStorage(TRANSCRIPT_KEY, parsed);
  console.log(`Storage updated at index ${index}`);
  
  lastSavedAt = Date.now();
  updateSaveLabel();
}

function updateSaveLabel() {
  const saveTime = document.querySelector('.saved-time');
  if (!lastSavedAt) return;
  saveTime.innerText = `Last saved: ${getRelativeTime(lastSavedAt)}`;
}
// Re-run every 30 seconds so the label stays accurate
setInterval(updateSaveLabel, 30_000);


// Function to handle edit of speaker box
function handleEdit(index) {
  // Update state of the target speaker block
  editingIndex = index;
  updateTranscriptState(editingIndex, 'editing');
}

// Function to handle save logic
function handleSave(index) {
  const currentSpeakerBlock = document.querySelector(`[data-index="${index}"]`);
  const textarea = currentSpeakerBlock.querySelector('textarea');
  if (!textarea) console.warn('Textarea not found');

  const newText = textarea.value.trim().split(/\s+/);
  const oldWords = editableTranscript[index].words;

  // If word count changed, timing alignment is broken so null everything out
  // This means the edited block won't highlight at all - better than highlighting wrong words
  const countChanged = newText.length !== oldWords.length;

  editableTranscript[index].words = newText.map((text, i) => {
    if (!countChanged && oldWords[i]) {
      return { ...oldWords[i], text }; // same count - safe to keep timing
    }
    // count changed OR new word beyond old length - no valid timing
    return { text, start: null, end: null, speaker: oldWords[0]?.speaker || null, confidence: null };

  });
  // Rebuild .text from the updated words so they always match
  editableTranscript[index].text = editableTranscript[index].words.map(w => w.text).join(' ');

  editingIndex = null;
  transcriptEditor.classList.remove('has-editing');
  updateTranscriptState(index, 'normal');
}


// Function to handle cancel logic
function cancelEdit(index) {
  editingIndex = null;
  transcriptEditor.classList.remove('has-editing');
  updateTranscriptState(index, 'normal');
}

let progressInterval = null; // global progress variable for fake loading progress

function startFakeProgress() {
  const uploadMetric = document.querySelector('.upload-metric'); //
  const percentage = document.querySelector('.percentage');
  
  // Stages: [target%, label, duration to reach it in ms]
  const stages = [
    { target: 12, label: 'Receiving your audio...', duration: 1500 },
    { target: 35, label: 'Auralis is tuning in...', duration: 2000 },
    { target: 55, label: 'Picking up the voices...', duration: 3000 },
    { target: 72, label: 'Mapping the conversation...', duration: 4000 },
    { target: 88, label: 'Putting words to speech...', duration: 5000 },
    { target: 92, label: 'Transcript almost ready...', duration: 8000 },
  ];

  let current = 0;
  let stageIndex = 0;
  const loadingDesc = document.querySelector('.loading-desc');

  // Clear any existing interval
  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    if (sizeInMB && uploadMetric) {
      const uploaded = (sizeInMB * (current / 100)).toFixed(1);
      uploadMetric.innerText = `${uploaded} / ${sizeInMB.toFixed(2)} MB`;
    }
    const stage = stages[stageIndex];
    if (!stage) return; // stay at 92% until done

    if (current < stage.target) {
      current += 0.5; // increment slowly
      percentage.innerText = `${Math.floor(current)}%`;
      
      if (loadingDesc) loadingDesc.innerText = stage.label;
    } else {
      stageIndex++; // move to next stage
    }
  }, 400); // runs every 400ms
}

function finishProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  const percentage = document.querySelector('.percentage');
  const loadingDesc = document.querySelector('.loading-desc');
  
  percentage.innerText = '100%';
  if (loadingDesc) loadingDesc.innerText = 'Transcription complete!';
}



const audioInput = document.getElementById('audio-input');
const urlInput = document.getElementById('url-audio-input');
const urlUploadBtn = document.querySelector('.url-upload-btn.dock-btn');
const label = document.querySelector('label[for="audio-input"]');
const urlDesc = document.querySelector('.url-desc');
const uploadStatus = document.querySelector('.state');
const audioSize = document.querySelector('.audio-size');

let currentAudioUrl = null; //To keep track of the current audio URL for cleanup
const speakerCount = document.querySelector('.speakers');



async function handleTranscription() {
  // TIP: this function is async it awaits result from uploadAndTranscribe() in ./js/transcribe.js
  let uploadType, uploadData;
  const audioplayer = document.querySelector('.audio-player');
  const uploadmetirc = document.querySelector('.upload-metric');

  // Revoke any other previous audio urls to free memory
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl); // release previous blob URL before assigning a new one
    currentAudioUrl = null;
  }
  await clearAudioBlob(); // ensure previous persisted blob is removed before new upload source is set
  transcriptAudio.pause();
  transcriptAudio.removeAttribute('src');
  transcriptAudio.load();

  // UI CLEANUP: Reset the play button and slider here
  resetAudioUI();
  
  // Use uploadType || uploadData variables instead of re-fetching them
  if (audioInput.files && audioInput.files[0]) {
    uploadType = 'file';
    uploadData = audioInput.files[0];
    console.log(`File type: ${uploadData.type}`)
    sizeInMB = uploadData.size / (1024 * 1024);
    audioSize.innerText = `${sizeInMB.toFixed(2)} MB`;
    uploadmetirc.innerText = `0 / ${sizeInMB.toFixed(2)} MB`;
    
    if (sizeInMB >= 500) {
      alert('File too large. Maximum size is 500MB.');
      return;
    }
    
    audioplayer.classList.remove('is-disabled');
    
    // Update Audio player in transcript
    const src = URL.createObjectURL(uploadData); // create a new src for audio element
    currentAudioUrl = src;  
    // set transcriptAudio src to src varibale and load
    transcriptAudio.crossOrigin = 'anonymous';
    transcriptAudio.preload = 'metadata';
    transcriptAudio.src = src;
    transcriptAudio.load()
    await saveAudioBlob(uploadData); // uploadData is the File object 
    
    
  } else if (urlInput.value.trim()) {
    uploadType = 'url';
    uploadData = urlInput.value.trim();
    
    
    if (!uploadData.startsWith('http://') && !uploadData.startsWith('https://')) {
      // TODO: Show warning toasts here
      showToast('Please enter a valid URL starting with http:// or https://', 'warning');
      urlDesc.innerHTML = 'Please enter a valid URL starting with <span class="highlight">http://</span> or <span class="highlight">https://</span>';
      return;
    }
    
    audioplayer.classList.add('is-disabled');
    uploadmetirc.innerText = `-- / --`;

    transcriptAudio.crossOrigin = 'anonymous';
    transcriptAudio.preload = 'metadata';
    transcriptAudio.src = uploadData;
    transcriptAudio.load();
  } else {
    showToast('Please select a file or enter a URL', 'info');
    urlDesc.innerHTML = 'Please select a file or enter a <span class="highlight">URL</span>';
    return;
  }

  await runAttempt(uploadType, uploadData);
}

async function resolveUploadDuration(uploadType, uploadData) {
  if (uploadType !== 'file') return null;

  const fromElement = Number.isFinite(transcriptAudio.duration) && transcriptAudio.duration > 0
    ? transcriptAudio.duration
    : null;
  if (fromElement != null) return fromElement;

  try {
    const decodeTimeoutMs = 1500;
    const decodedDuration = await Promise.race([
      uploadData.arrayBuffer().then(async (buffer) => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;

        const context = new AudioCtx();
        try {
          const decoded = await context.decodeAudioData(buffer.slice(0));
          return Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : null;
        } finally {
          await context.close();
        }
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), decodeTimeoutMs))
    ]);

    return decodedDuration;
  } catch (error) {
    return null;
  }
}

async function runAttempt(uploadType, uploadData) {
  if (isProcessing) return;
  lockUploadUI();

  const start = Date.now();
  const MIN_DISPLAY_TIME = 2500;
  const hadTranscriptBeforeAttempt = Array.isArray(editableTranscript) && editableTranscript.length > 0;

  try {

    const projectSection = document.getElementById('projects');
    const projectTab = document.querySelector('.nav-link[data-id="projects"]');
    const file = document.querySelector('.file.loading-sub-text');
    const transcriptTitle = document.querySelector('.transcript-title');
    const audioName = document.querySelector('.audio-name');
    const audioDuration = document.querySelector('.audio-duration');
    const transcriptDate = document.querySelector('.current-date');
    const transcriptLanguage = document.querySelector('.lang');

    // UI Prep
    transcriptTitle.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}`;
    audioName.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;
    transcriptDate.innerText = formatDate(Date.now(), true);
    uploadStatus.innerText = 'Active';
    uploadStatus.classList.remove('failed');
    file.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;

    const fileDuration = await resolveUploadDuration(uploadType, uploadData);
    if (uploadType === 'file' && Number.isFinite(fileDuration) && fileDuration < MIN_UPLOAD_DURATION) {
      console.debug('duration-check', { duration: fileDuration, blocked: true });
      showToast('Clip too short — minimum 2.5 seconds.', 'warning');
      updateState(projectSection, hadTranscriptBeforeAttempt ? 'loaded' : 'empty');
      return;
    }

    updateState(projectSection, 'loading');
    projectTab.click();
    // Start fake progress here
    startFakeProgress(uploadType === 'file' ? uploadData.size / (1024 * 1024) : null); 

    const transcriptionResult = await uploadAndTranscribe(uploadType, uploadData, fileDuration);

    finishProgress();

    const elapsed = Date.now() - start;
    if (elapsed < MIN_DISPLAY_TIME) {
      await wait(MIN_DISPLAY_TIME - elapsed);
    }

    // uploadAndTranscribe now has a stable return contract.
    // We check `ok` before touching transcript fields to prevent undefined access crashes.
    if (!transcriptionResult.ok || !transcriptionResult.transcript) {
      const reasonMessageMap = {
        no_speech_detected: 'No clear speech detected — try a different clip.',
        low_confidence: 'Low confidence transcript — try again.'
      };

      uploadStatus.innerText = 'Needs retry';
      uploadStatus.classList.add('failed');
      updateState(projectSection, hadTranscriptBeforeAttempt ? 'loaded' : 'empty');

      showToast(
        reasonMessageMap[transcriptionResult.reason] || 'Transcription failed — please retry.',
        'warning',
        4500,
        {
          label: 'Retry',
          callback: () => {
            console.debug('retry-action');
            runAttempt(uploadType, uploadData);
          }
        }
      );

      const transcriptTab = document.querySelector('.nav-link[data-id="transcription"]');
      transcriptTab.click();
      return;
    }

    const result = transcriptionResult.transcript;
    utterances = result.utterances;
    window.transcriptResult = result; // Expose result for debugging
    originalTranscript = result //Set original copy of API response

    if (!Array.isArray(originalTranscript.utterances)) {
      uploadStatus.innerText = 'Needs retry';
      uploadStatus.classList.add('failed');
      updateState(projectSection, hadTranscriptBeforeAttempt ? 'loaded' : 'empty');
      showToast('Transcription could not be completed for this audio.', 'warning');
      return;
    }
   
    // new Set() automatically removes duplicates — so if you pass it ["A", "A", "B", "A", "B"] it gives you {A, B} and .size gives you 2.
    const uniqueSpeakers = new Set(originalTranscript.utterances.map(u => u.speaker)).size;
    
    session = {
      audio_duration: originalTranscript.audio_duration,
      confidence: originalTranscript.confidence,
      language_code: originalTranscript.language_code,
      id: originalTranscript.id,
      text: originalTranscript.text,
      speakers: originalTranscript.speakers,
      date: Date.now(),
      speakercount: `${uniqueSpeakers} Speaker${uniqueSpeakers > 1 ? 's' : ''}`,

      // These come from uploadData, not the API
      title: uploadType === 'file' ? uploadData.name : uploadData,
      audio_size: uploadType === 'file' ? `${(uploadData.size / (1024 * 1024)).toFixed(2)} MB` : '--',
    }

    /**The .map() HOF enables us to create our own version result we ca manipulate while keeping source of truth true
    *Should produce something like this
     *[{
        speaker: "A",
        start: 800,
        end: 482820,
        words: [...]
        }]
        */
    editableTranscript = toEditableUtterances(originalTranscript.utterances);
    session.utterances = editableTranscript;
    
    transcriptLanguage.innerText = `${session.language_code}`;
    speakerCount.innerText = session.speakercount;
    audioDuration.innerText = formatTime(session.audio_duration * 1000); // API gives seconds, convert to ms for formatting


    console.log(`originalTranscript:`, originalTranscript);
    console.log(`Session:`, session);
    console.log(`editableTranscript:`, editableTranscript);
    
    renderTranscript(editableTranscript);
    updateState(projectSection, 'loaded');
    // Save the full session (including original transcript) to localStorage for persistence and future use in recordings section
    try {
      // Keep lightweight client metadata with canonical transcript for reliable restore reconciliation.
      originalTranscript._client = {
        title: session.title,
        audio_size: session.audio_size,
        date: session.date,
        speakercount: session.speakercount
      };
      localStorage.setItem('originalTranscript', JSON.stringify(originalTranscript)); // write canonical transcript first
      localStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(buildSessionSnapshot(session, editableTranscript))); // then write compact UI snapshot
      console.log('Transcription session saved to localStorage');
    } catch (e) {
      showToast('Failed to save transcript session', 'error');
    }

    // Show success toast for UI feedback
    showToast('Transcription successful!', 'success')
    
  } catch (error) {
    console.error('Failed to transcribe:', error);
    uploadStatus.innerText = 'Failed';
    uploadStatus.classList.add('failed');

    await wait(2000); 

    // Show error toast for UI feedback
    showToast(`Transcription failed - ${error}`, 'error')

    const transcriptTab = document.querySelector('.nav-link[data-id="transcription"]');
    transcriptTab.click();
  } finally {
    // UNLOCK UI here 
    unlockUploadUI();
  }
}

// Function to reset the custom audio player UI
function resetAudioUI() {
  // Reset the play button to the 'play' icon
  playBtn.innerHTML = `<i data-lucide="play"></i>`;
  
  // Reset the slider to the beginning
  audioRange.value = 0;
  
  // Re-run Lucide to render the new icon
  if (window.lucide) {
    lucide.createIcons();
  }
}

let isProcessing = false;

function lockUploadUI() {
  isProcessing = true;
  label.classList.add('is-disabled');
  urlUploadBtn.classList.add('is-disabled');
}

function unlockUploadUI() {
  isProcessing = false;
  label.classList.remove('is-disabled');
  urlUploadBtn.classList.remove('is-disabled');
  label.innerText = 'Upload Audio';
  urlUploadBtn.innerText = 'Upload Audio';
  audioInput.value = '';
  urlInput.value = '';
}


// 2. Initialize EVENT LISTENERS
// Sync ranger slider input with audio
const audioRange = document.getElementById('audio-range');
const audioTime = document.querySelector('.total-time');
const currentTime = document.querySelector('.current-time');

transcriptAudio.addEventListener("timeupdate", () => {
  audioRange.value = transcriptAudio.currentTime;

  const currentTimeMs = transcriptAudio.currentTime * 1000;
  currentTime.innerText = formatTime(currentTimeMs);

  // Remove highlight from whichever word had it before
  const previousWord = document.querySelector('.speaker-text span.active-word');
  if (previousWord) {
    previousWord.classList.remove('active-word');
  }

  // Find and highlight the word that matches current playback time
  const allSpans = document.querySelectorAll('.speaker-text span');
  allSpans.forEach(span => {
    const start = Number(span.dataset.start);
    const end = Number(span.dataset.end);

    if (start && end && currentTimeMs >= start && currentTimeMs <= end) {
      span.classList.add('active-word');

      // --- AUTO-SCROLL LOGIC ---
      // getBoundingClientRect() tells us where this element is on screen RIGHT NOW
      // It gives us top/bottom relative to the visible viewport (what you can see)
      const rect = span.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Check if the word has gone below 85% of the screen height
      // We use 75% (not 100%) so the scroll happens before the word fully disappears
      // giving the user a comfortable head start before the next scroll
      const isBelow = rect.bottom > windowHeight * 0.85;

      // Check if the word is above the top of the screen
      // (happens when user manually scrolls up and audio keeps playing)
      const isAbove = rect.top < 0;

      if (isBelow || isAbove) {
        // 'center' places the active word in the middle of the screen
        // so the user gets a full screen of reading space before next scroll
        // 'smooth' makes it animate instead of jump
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
});

// Set the audio time on metadata load for better UX
transcriptAudio.addEventListener("loadedmetadata", () => {
  // Convert duration seconds to MS for your utility
  const durationMs = transcriptAudio.duration * 1000;
  audioTime.innerText = formatTime(durationMs);

  // Set the slider max to seconds
  audioRange.max = transcriptAudio.duration;
  
  // Reset 0
  transcriptAudio.currentTime = 0; 
  audioRange.value = 0;

  if (audioRange.value === audioRange.max) {
    resetAudioUI();
  }
});

// Audio debug event listners
transcriptAudio.addEventListener('error', (e) => {
  console.error('Audio error event', e, transcriptAudio.error);
});
transcriptAudio.addEventListener('canplay', () => console.log('canplay', transcriptAudio.duration));
transcriptAudio.addEventListener('loadedmetadata', () => console.log('loadedmetadata', transcriptAudio.duration));
transcriptAudio.addEventListener('play', () => console.log('play event'));

audioRange.addEventListener('input', () => {
  transcriptAudio.currentTime = audioRange.value;
});

audioInput.addEventListener('change', () => {
  if (isProcessing) return; // ← guard
  if (audioInput.files && audioInput.files[0]) {
    label.innerText = 'Uploading...';
    setTimeout(() => { handleTranscription(); }, 2000);
  }
});

urlUploadBtn.addEventListener('click', () => {
  if (isProcessing) return; // ← guard
  if (urlInput.value.trim()) {
    urlUploadBtn.innerText = 'Uploading...';
    setTimeout(() => { handleTranscription(); }, 2000);
  } else {
    handleTranscription();
  }
});

// Add event listeners to play btn in custom audio interface
const playBtn = document.getElementById('play-btn')
playBtn.addEventListener("click", ()=> {
  // set hasClicked to true for use in editing state logic to auto-pause when user clicks play
  hasClicked = true;
  // Check if audio element is paused
  if (transcriptAudio.paused) {
    // Play audio and change btn icon for UI feedback
    transcriptAudio.play()
    playBtn.innerHTML = `<i data-lucide="pause"></i>`
  } else {
    transcriptAudio.pause()
    playBtn.innerHTML = `<i data-lucide="play"></i>`
  }
  if (transcriptAudio.ended) {
    transcriptAudio.currentTime = 0;
    audioRange.value = 0;
  }
  lucide.createIcons();
})

const backBtn = document.querySelector('.backward-btn')
backBtn.addEventListener("click", ()=> {
  transcriptAudio.currentTime = 0;
  audioRange.value = 0;
  playBtn.innerHTML = `<i data-lucide="play"></i>`
  lucide.createIcons();
})

const fowardBtn = document.querySelector('.forward-btn')
fowardBtn.addEventListener("click", ()=> {
  transcriptAudio.currentTime = transcriptAudio.duration;
  audioRange.value = audioRange.max;
  playBtn.innerHTML = `<i data-lucide="play"></i>`
  lucide.createIcons();
})

const playbackBtn = document.querySelector('.playback');
// The speeds to cycle through in order
const speedSteps = [1, 1.5, 2];
let speedIndex = 0; // start at 1x
playbackBtn.addEventListener('click', () => {
  // Move to next speed, wrap back to 0 when we reach the end
  speedIndex = (speedIndex + 1) % speedSteps.length;
  
  const newSpeed = speedSteps[speedIndex];
  
  // Apply to the actual audio element - this affects playback AND karaoke timing
  // because timeupdate still fires based on real audio position
  transcriptAudio.playbackRate = newSpeed;
  
  // Update the button label
  playbackBtn.innerHTML = `<i data-lucide="gauge"></i> ${newSpeed}x`;
  
  // Re-render the lucide icon since we replaced innerHTML
  lucide.createIcons();
});


// !NOTE: export button should open a modal with all the export formats and attach export formats to the btns
const exportBtn = document.querySelector('.export-btn');
exportBtn.addEventListener('click', () => {
  if (!editableTranscript) {
    showToast('No transcript to export', 'info');
    return;
  }
  downloadTXT(editableTranscript, session.title || 'transcript');
});

// Store the handler in a variable so we can re-attach it without arguments.callee
function attachTitleEdit(element) {
  element.addEventListener('dblclick', handleTitleDblClick);
}

function handleTitleDblClick() {
  const currentTitle = session.title || 'Untitled';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentTitle;
  input.className = 'title-edit-input';

  this.replaceWith(input); // 'this' is the heading element that was double-clicked
  input.focus();
  input.select();

  // Guard flag - prevents saveTitle from running twice
  // (blur fires after keydown replaces the element, causing the second crash)
  let saved = false;

  function saveTitle() {
    if (saved) return; // already ran once, bail out
    saved = true;

    const newTitle = input.value.trim() || currentTitle;

    // Update session in memory
    session.title = newTitle;

    // Sync audio player name
    document.querySelector('.audio-name').innerText = newTitle;

    // Persist to localStorage
    const raw = localStorage.getItem(TRANSCRIPT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.title = newTitle;
      saveToLocalStorage(TRANSCRIPT_KEY, parsed, showToast);
    }

    // Rebuild the heading and re-attach the listener using the named function
    const newHeading = document.createElement('h1');
    newHeading.className = 'transcript-title';
    newHeading.innerText = newTitle;
    input.replaceWith(newHeading);
    attachTitleEdit(newHeading); // ← named reference, no arguments.callee needed

    showToast('Title updated', 'success');
    lastSavedAt = Date.now();
    updateSaveLabel();
  }

  function cancelEdit() {
    if (saved) return;
    saved = true;

    const restored = document.createElement('h1');
    restored.className = 'transcript-title';
    restored.innerText = currentTitle;
    input.replaceWith(restored);
    attachTitleEdit(restored);
  }

  input.addEventListener('blur', saveTitle);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveTitle();
    if (e.key === 'Escape') cancelEdit();
  });
}

// Attach to the initial element on load
const transcriptTitleEl = document.querySelector('.transcript-title');
if (transcriptTitleEl) attachTitleEdit(transcriptTitleEl);




// Onboarding Setup with LocalStorage
let username;

const progressBar = document.querySelector('.progress-bars');
const sliderTrack = document.querySelector('.slider-track');

function goToStep(step) {
  const storageKey = 'auralis-onboarding';
  let onboarding = null;

  try {
    onboarding = JSON.parse(localStorage.getItem(storageKey));
  } catch (e) {
    console.warn('auralis-onboarding is invalid JSON, resetting.', e);
  }

  // If nothing valid is found, create a default object
  if (!onboarding || typeof onboarding !== 'object') {
    onboarding = {
      isCompleted: false,
      currentStep: 1,
      time: new Date().toISOString()
    };
  }

  // update onboarding current step
  onboarding.currentStep = step;

  // Save the new step permanently
  localStorage.setItem(storageKey, JSON.stringify(onboarding));

  console.log('onboarding:', onboarding);

  // Update elements for sliding effects (guard in case DOM nodes are missing)
  if (progressBar) progressBar.dataset.step = onboarding.currentStep;
  if (sliderTrack) sliderTrack.dataset.step = onboarding.currentStep;
}


// expose goToStep function globally so the HTML buttons can access it
window.goToStep = goToStep

// Get the data we saved from index file to restore current step
const savedState = JSON.parse(localStorage.getItem('auralis-onboarding'));

// If the user isn't finished yet, restore their step
if (savedState && !savedState.isCompleted) {
  // This calls your function immediately when the script loads
  goToStep(savedState.currentStep);
}

const stepTwoBtn = document.getElementById('step-two-btn')
stepTwoBtn.addEventListener("click", ()=> {
  const usernameInput = document.getElementById('user-name-input')
  const username = usernameInput.value.trim()
  const errMsg = document.querySelector('.err-msg')
  if (username === '') {
    console.log('Fill username first')
    errMsg.style.display = 'block';
  } else {
    errMsg.style.display = 'none';
    // Move to third step
    goToStep(3)
    // Create Initials
    createInitials(username)
  }
})

const dashboardBtn = document.getElementById('dashboard-link')
dashboardBtn.addEventListener("click", ()=>{
  // Add transitioning class for smoother animation
  document.documentElement.classList.add('transitioning');
  
  // Small delay to let the fade-out animation play
  setTimeout(() => {
    // Set onboarding complete status to true, set new date and save again for data persistence
    savedState.isCompleted = true;
    savedState.time = new Date().toISOString();
    const newSavedState = JSON.stringify(savedState)
    localStorage.setItem('auralis-onboarding', newSavedState);

    // Add onboarded class to document Element to manually remove onboarding and replace with dashboard
    document.documentElement.classList.add('onboarded');
    
    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('transitioning');
    }, 500);
  }, 400); // Small delay for smoothness
})



// Handle active class toggles



// Nav links
const navLinks = document.querySelectorAll('.nav-link')
// Callback function to handle section switching
function handleSectionSwitch(clickedElement) {
  // Check if the clicked element has a data-id attribute
  const targetId = clickedElement.dataset.id;
  
  if (targetId) {
    // Get all sections
    const sections = document.querySelectorAll('.section');

    // Save current targetId to LocalStorage
    localStorage.setItem('current-section', targetId)
    const currentSection = localStorage.getItem('current-section')
    // console.log(currentSection)
    // Find the matching section
    let matchFound = false;
    
    sections.forEach((section) => {
      if (section.id === targetId) {
        matchFound = true;
        // Remove show class from all sections
        sections.forEach((sec) => sec.classList.remove('show'));
        // Add show class to the matching section
        section.classList.add('show');
        // console.log(`Switched to section: ${targetId}`);
      }
    });
    
    // Log if no matching section was found
    if (!matchFound) {
      console.warn(`No section found with id: ${targetId}`);
    }
  } else {
    console.warn('Clicked nav link does not have a data-id attribute');
    console.warn(`${targetId} nav link does not have a data-id attribute`);
  }
}


toggleClass(navLinks, 'active', handleSectionSwitch)


const uploadBtnSecondary = document.querySelector('.upload-btn-alt')
uploadBtnSecondary.addEventListener('click', ()=> {
  const transcriptionNavLink = document.querySelector('[data-id="transcription"]');
  transcriptionNavLink.click()  
})

// Initialize theme toggle
// const toggleBtn = document.querySelector('.toggle-btn')
// toggleBtn.addEventListener("click", ()=> {
//   toggleClass(toggleBtn, 'on')
//   toggleClass(document.body, 'light')
// })


// Empty State - Navigate to Transcription section when footer is clicked
const emptyFooter = document.querySelector('.empty-footer');

if (emptyFooter) {
  emptyFooter.addEventListener('click', () => {
    // Find the Transcription nav link
    const transcriptionNavLink = document.querySelector('[data-id="transcription"]');
    
    if (transcriptionNavLink) {
      // Trigger a click on the Transcription nav link
      transcriptionNavLink.click();
      
      // console.log('Navigated to Transcription section from empty state');
    }
  });
}


// ============================================
// MOBILE MENU FUNCTIONALITY
// ============================================

const menuBtn = document.getElementById('menu');
const sidebar = document.querySelector('.sidebar');

// Function to close the mobile menu
function closeMobileMenu() {
  document.body.classList.remove('open-nav');
  // console.log('Mobile menu closed');
}

// Function to toggle the mobile menu
function toggleMobileMenu() {
  document.body.classList.toggle('open-nav');
  const isOpen = document.body.classList.contains('open-nav');
  // console.log(`Mobile menu ${isOpen ? 'opened' : 'closed'}`);
}

// Menu button click handler
if (menuBtn) {
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling up
    toggleMobileMenu();
  });
}

// Close menu when nav link is clicked
navLinks.forEach((navLink) => {
  navLink.addEventListener('click', () => {
    // Only close on mobile (when sidebar is position: fixed)
    if (window.innerWidth <= 763) {
      closeMobileMenu();
      // console.log('Nav link clicked - closing mobile menu');
    }
  });
});

// Close menu when clicking outside sidebar
document.addEventListener('click', (e) => {
  const isMenuOpen = document.body.classList.contains('open-nav');
  const clickedInsideSidebar = sidebar.contains(e.target);
  const clickedMenuBtn = menuBtn.contains(e.target);
  
  // If menu is open, click is outside sidebar, and not on menu button
  if (isMenuOpen && !clickedInsideSidebar && !clickedMenuBtn) {
    closeMobileMenu();
    // console.log('Clicked outside sidebar - closing mobile menu');
  }
});

// Prevent clicks inside sidebar from closing the menu
if (sidebar) {
  sidebar.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}


const urlBox = document.getElementById('url-audio-input')
const urlButton = document.querySelector('.url-btn')

urlButton.addEventListener("click", ()=> {
  // Swap audio upload methods
  const btn = document.querySelector('.url-btn')
  const dock = document.querySelector('.loading-dock')

  // Hide or show urlBox with toggled class
  toggleClass(dock, 'show-url-box')
  toggleClass(btn, 'url-toggle')
})























