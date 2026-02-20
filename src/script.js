// !IMPORTANT: Notes:
// - Add a small delay (setTimeout) when switching states to allow state transitions for smoother UX
// - (Optional) Use small spinner button beside file name in loading state for better feedback and in buttons in loading dock


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
const plan = document.querySelector('.plan');
plan.innerText = `Beta - ${APP_VERSION}`
console.log('Vite is Running Script!');
console.log(`Auralis ${APP_VERSION}`)

// Import JS files here
  
import { toggleClass, createInitials, formatTime, formatDate, saveToLocalStorage, getRelativeTime} from './js/utils'
import { uploadAndTranscribe } from "./js/transcribe";
import { eventHub } from "./js/eventhub";


let utterances;
window.utterances = utterances;
window.createInitials = createInitials

let session = null
let originalTranscript = null // store original transcript result - Full API response Object
let editableTranscript = null // store editable transcript result - Array of utternaces from API result object
let hasClicked = false;
let sizeInMB;

const transcriptAudio = document.getElementById('audio-engine');

// Restore transcripts, etc on load
document.addEventListener('DOMContentLoaded', () => {
  const savedData = localStorage.getItem(TRANSCRIPT_KEY);
  if (!savedData) return;

  const projectSection = document.getElementById('projects');
  const savedSession = JSON.parse(savedData);

  // Restore session and editableTranscript
  session = savedSession;
  editableTranscript = savedSession.utterances;

  // Restore UI metadata
  document.querySelector('.lang').innerText = session.language_code || '--';
  document.querySelector('.transcript-title').innerText = session.title || 'Untitled';
  document.querySelector('.audio-name').innerText = session.title || 'Untitled';
  document.querySelector('.lang').innerText = session.language_code || '--';
  document.querySelector('.audio-size').innerText = session.audio_size || '--';
  // add whatever other metadata fields you want restored here

  renderTranscript(editableTranscript);
  updateState(projectSection, 'loaded');
  showToast('Previous session restored', 'info');
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
function showToast(msg, type = 'info', duration = 4500) {
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
  message.textContent = msg;
  
  // Append message to toast
  toast.appendChild(message);
  
  // Append toast to container
  container.appendChild(toast);
  console.log(container)

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
  }, duration);
  
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

  parsed.utterances[index] = editableTranscript[index]; // go into .utterances

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
  // Grab the current speakerblock and the textarea
  const currentSpeakerBlock = document.querySelector(`[data-index="${index}"]`)
  const textarea = currentSpeakerBlock.querySelector('textarea')
  if (!textarea) console.warn('Textarea not found');

  // use .value on textarea as it gets updated on every keystroke unlike innerText
  const newText = textarea.value.trim().split(/\s+/); // split on any whitespace
  console.log(newText);
 
  const oldWords = editableTranscript[index].words;

  // Reconcile: keep timing data where possible, null it out where the word is new
   editableTranscript[index].words = newText.map((text, i) => {
    if (oldWords[i]) {
      // Word existed at this index - keep timing, just update the text
      return { ...oldWords[i], text: text };
    } else {
      // Brand new word (user typed more than existed) - no timing data
      return { text: text, start: null, end: null, speaker: oldWords[0]?.speaker || null, confidence: null };
    }
  });

  // Reset edit state and re-render
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
  }, 100); // runs every 100ms
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
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  // UI CLEANUP: Reset the play button and slider
  resetAudioUI();
  
  // Use uploadType || uploadData variables instead of re-fetching them
  if (audioInput.files && audioInput.files[0]) {
    uploadType = 'file';
    uploadData = audioInput.files[0];
    sizeInMB = uploadData.size / (1024 * 1024);
    audioSize.innerText = `${sizeInMB.toFixed(2)} MB`;
    uploadmetirc.innerText = `0 / ${sizeInMB.toFixed(2)} MB`;
    // !IMPORTANT: replace 0 in uploadmetirc with actual file size uploaded
    
    if (sizeInMB >= 500) {
      alert('File too large. Maximum size is 500MB.');
      return;
    }
    
    audioplayer.classList.remove('is-disabled');
    
    // Update Audio player in transcript
    const src = URL.createObjectURL(uploadData); // create a new src for audio element
    currentAudioUrl = src;  
    // set transcriptAudio src to src varibale and load
    transcriptAudio.src = src;
    transcriptAudio.load()
    
    
  } else if (urlInput.value.trim()) {
    uploadType = 'url';
    uploadData = urlInput.value.trim();
    
    
    if (!uploadData.startsWith('http://') && !uploadData.startsWith('https://')) {
      urlDesc.innerHTML = 'Please enter a valid URL starting with <span class="highlight">http://</span> or <span class="highlight">https://</span>';
      return;
    }
    
    audioplayer.classList.add('is-disabled');
    uploadmetirc.innerText = `-- / --`;

    transcriptAudio.src = uploadData;
    transcriptAudio.load();
  } else {
    // todo: show toast (type="info")
    urlDesc.innerHTML = 'Please select a file or enter a <span class="highlight">URL</span>';
    return;
  }

  const start = Date.now();
  const MIN_DISPLAY_TIME = 2500; 

  try {

    const projectSection = document.getElementById('projects');
    const projectTab = document.querySelector('.nav-link[data-id="projects"]');
    const file = document.querySelector('.file.loading-sub-text');
    const transcriptTitle = document.querySelector('.transcript-title');
    const audioName = document.querySelector('.audio-name');
    const transcriptDate = document.querySelector('.current-date');
    const transcriptLanguage = document.querySelector('.lang');

    // UI Prep
    transcriptTitle.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}`;
    audioName.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;
    transcriptDate.innerText = formatDate(Date.now(), true);
    uploadStatus.innerText = 'Active';
    uploadStatus.classList.remove('failed');
    file.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;

    updateState(projectSection, 'loading');
    projectTab.click();
    // Start fake progress here
    startFakeProgress(uploadType === 'file' ? uploadData.size / (1024 * 1024) : null); 

    const result = await uploadAndTranscribe(uploadType, uploadData);

    finishProgress();

    const elapsed = Date.now() - start;
    if (elapsed < MIN_DISPLAY_TIME) {
      await wait(MIN_DISPLAY_TIME - elapsed);
    }

    
    utterances = result.utterances;
    window.transcriptResult = result; // Expose result for debugging
    originalTranscript = result //Set original copy of API response
   
    // new Set() automatically removes duplicates — so if you pass it ["A", "A", "B", "A", "B"] it gives you {A, B} and .size gives you 2.
    const uniqueSpeakers = new Set(originalTranscript.utterances.map(u => u.speaker)).size;
    
    session = {
      audio_duration: originalTranscript.audio_duration,
      confidence: originalTranscript.confidence,
      language_code: originalTranscript.language_code,
      id: originalTranscript.id,
      text: originalTranscript.text,
      utterances: originalTranscript.utterances,
      speakers: originalTranscript.speakers,
      words: originalTranscript.words,
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
    editableTranscript = session.utterances.map(
      (utterance)=> {
        return {
          speaker: utterance.speaker,
          start: utterance.start,
          end: utterance.end,
          text: utterance.text,
          confidence: utterance.confidence,
          words: utterance.words.map(
            (word) => {
               return {
                text: word.text,
                start: word.start,
                end: word.end,
                speaker: word.speaker,
                confidence: word.confidence
              }
            }
          )
        }
      }
    )
    
    transcriptLanguage.innerText = `${session.language_code}`;
    speakerCount.innerText = session.speakercount;


    console.log(`originalTranscript:`, originalTranscript);
    console.log(`Session:`, session);
    console.log(`editableTranscript:`, editableTranscript);
    
    renderTranscript(editableTranscript);
    updateState(projectSection, 'loaded');
    // Save the full session (including original transcript) to localStorage for persistence and future use in recordings section
    saveToLocalStorage('originalTranscript', originalTranscript, showToast);
    saveToLocalStorage(TRANSCRIPT_KEY, session, showToast);

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
  // Keep the range slider in seconds (it matches the audio player better)
  audioRange.value = transcriptAudio.currentTime; 
  
  // Convert seconds to MS for your specific formatTime function
  const currentTimeMs = transcriptAudio.currentTime * 1000;
  currentTime.innerText = formatTime(currentTimeMs); 
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

audioRange.addEventListener('input', () => {
  transcriptAudio.currentTime = audioRange.value;
});

audioInput.addEventListener('change', () => {
  if (isProcessing) return; // ← guard
  if (audioInput.files && audioInput.files[0]) {
    label.innerText = 'Uploading...';
    lockUploadUI(); // ← lock both
    setTimeout(() => { handleTranscription(); }, 2000);
  }
});

urlUploadBtn.addEventListener('click', () => {
  if (isProcessing) return; // ← guard
  if (urlInput.value.trim()) {
    urlUploadBtn.innerText = 'Uploading...';
    lockUploadUI(); // ← lock both
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


// Current section persistence on page reload
document.addEventListener("DOMContentLoaded", ()=> {
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
})

toggleClass(navLinks, 'active', handleSectionSwitch)


// Restore username and initials on page load
document.addEventListener('DOMContentLoaded', () => {
  const storageKey = 'auralis-onboarding';
  const onboarding = JSON.parse(localStorage.getItem(storageKey));
  
  if (onboarding && onboarding.username) {
    createInitials(onboarding.username);
    console.log('Username restored from localStorage');
  }
});

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

// Function to open the mobile menu
function openMobileMenu() {
  document.body.classList.add('open-nav');
  // console.log('Mobile menu opened');
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






















