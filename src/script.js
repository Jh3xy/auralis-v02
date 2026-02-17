// IMPORTANT: Notes:
// - Add a small delay (setTimeout) when switching states to allow CSS transitions to play for smoother UX
// - Use small spinner button beside file name in loading state for better feedback and in buttons in loading dock


// Stylesheets
import './styles/variables.css'
import './styles/resets.css'
import './styles.css'
import './styles/utils.css'
import './styles/onboarding.css'
import './styles/transcripts.css'
import './styles/queries.css'

console.log('Vite is Running Script!');
const APP_VERSION = 'v1.5-1.00';
const plan = document.querySelector('.plan');
plan.innerText = `Beta - ${APP_VERSION}`
console.log(`Auralis ${APP_VERSION}`)

// Import JS files here
import { toggleClass, createInitials, formatTime, formatDate  } from './js/utils'
import { uploadAndTranscribe } from "./js/transcribe";
import { eventHub } from "./js/eventhub";

window.createInitials = createInitials

let utterances;
window.utterances = utterances;


let originalTranscript = null // Will store original transcript result
let editableTranscript = null // Will store editable transcript result

// Function that sets UI states
function updateState(element, state) {
  const states = ['loading', 'loaded'];
  element.classList.remove(...states)
  element.classList.add(state)
}


// Wait promise for enforcng mimimum dispay time
// This creates a "pause" that doesn't freeze the browser
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Show toast Utility
function showToast(msg, type = 'info', duration = 3000) {
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
  // Auto-dismiss after duration
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
 * and can be called upon editing events to update the UI without needing to re-call the API or reset the audio player
 * It will:
 *  Reads state,
 * Produces DOM
 * @param {Array} transcriptData - The editableTranscript array containing the transcript data to render
*/
const transcriptEditor = document.querySelector('.transcript-body');
let editingIndex = null; //for tracking current editing block

function renderTranscript(array) {
  transcriptEditor.innerHTML = '';
  if (!Array.isArray(array)) {
    console.log(`${array} is not an array`);
    return
  }

  array.forEach(
    (utterance, index)=> {
      let contentHTML = ''; //Initialize what content should be (textarea or span) based on editingIndex === index
      const startTime = formatTime(utterance.start)
      const endTime = formatTime(utterance.end)
      
      // Check if editing index is eqaul to index to change contentHTML
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

      // Create dynamic speaker block now
      const speakerBox = `
      <div class="speaker-box flex items-start gap-8 ${editingIndex === index ? 'is-editing': ''}" data-index="${index}">
        <div class="speaker-tag flex gap-1 shrink-0 flex-col">
          <span class="speaker">Speaker ${utterance.speaker}</span><span class="speaker-metadata sub-text"> ${startTime} - ${endTime}</span>
              <div class="edit-controls flex gap-2"><button class="edit-btn btn"><i data-lucide="square-pen"></i></button><div class="controls-secondary flex gap-1"><button class="save-btn btn"><i data-lucide="save"></i></button><button class="cancel-btn btn"><i data-lucide="ban"></i></button></div></div></div><p class="speaker-text">${contentHTML}</p></div>
      `
      transcriptEditor.insertAdjacentHTML('beforeend', speakerBox);
    }
  )
  console.log('Finished Rendering Transcript')
  lucide.createIcons();

  // Use event delegation on parent to avoid multiple event listnes added
  transcriptEditor.addEventListener("click", (e)=> {
    const btn = e.target.closest('.edit-btn');
    if (!btn) return; // Exit if they didn't click an edit button
    console.log(btn);

    const speakerbox = btn.closest('.speaker-box')

    // Set editingIndex
    editingIndex = Number(speakerbox.dataset.index); //Force with Number() to convert data-index to number
    renderTranscript(editableTranscript);
  })
}


const audioInput = document.getElementById('audio-input');
const urlInput = document.getElementById('url-audio-input');
const urlUploadBtn = document.querySelector('.url-upload-btn.dock-btn');
const label = document.querySelector('label[for="audio-input"]');
const urlDesc = document.querySelector('.url-desc');
const uploadStatus = document.querySelector('.state');
const audioSize = document.querySelector('.audio-size');

let currentAudioUrl = null; //To keep track of the current audio URL for cleanup
const transcriptAudio = document.getElementById('audio-engine');

async function handleTranscription() {
  let uploadType, uploadData;

  // Revoke any other previous audio urls to free memory
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  // UI CLEANUP: Reset the play button and slider
  resetAudioUI();
  
  // Use the global variables instead of re-fetching them
  if (audioInput.files && audioInput.files[0]) {
    uploadType = 'file';
    uploadData = audioInput.files[0];
    const sizeInMB = uploadData.size / (1024 * 1024);
    audioSize.innerText = `${sizeInMB.toFixed(2)} MB`;
    if (sizeInMB >= 500) {
      alert('File too large. Maximum size is 500MB.');
      return;
    }
    
    // Update Audio player in transcript

    // create a new src for audio element
    const src = URL.createObjectURL(uploadData);
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

    transcriptAudio.src = uploadData;
    transcriptAudio.load();
  } else {
    urlDesc.innerHTML = 'Please select a file or enter a <span class="highlight">URL</span>';
    return;
  }

  const start = Date.now();
  const MIN_DISPLAY_TIME = 2500; 

  try {
    // LOCK UI immediately
    toggleClass(label, 'disabled');
    toggleClass(urlUploadBtn, 'disabled');
    label.innerText = 'Uploading...';
    urlUploadBtn.innerText = 'Uploading...';


    const projectSection = document.getElementById('projects');
    const projectTab = document.querySelector('.nav-link[data-id="projects"]');
    const file = document.querySelector('.file.loading-sub-text');
    const transcriptTitle = document.querySelector('.transcript-title');
    const audioName = document.querySelector('.audio-name');
    const transcriptDate = document.querySelector('.current-date');
    const transcriptLanguage = document.querySelector('.lang');
    const speakerCount = document.querySelector('.speakers');

    // UI Prep
    transcriptTitle.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;
    audioName.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;
    transcriptDate.innerText = formatDate(Date.now(), true);
    uploadStatus.innerText = 'Active';
    uploadStatus.classList.remove('failed');
    file.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;

    updateState(projectSection, 'loading');
    projectTab.click();

    const result = await uploadAndTranscribe(uploadType, uploadData);

    const elapsed = Date.now() - start;
    if (elapsed < MIN_DISPLAY_TIME) {
      await wait(MIN_DISPLAY_TIME - elapsed);
    }

    transcriptLanguage.innerText = `${result.language_code}`;
    utterances = result.utterances;

    window.transcriptResult = result; // Expose result for debugging
    originalTranscript = result //Set original copy of API response

    // The .map() HOF enables us to create our own version of the original transcript that we can manipulate and edit without affecting the original data from the API. This is important for maintaining data integrity and allowing users to revert changes if needed.

    /**Should produce something like this
     *[{
        speaker: "A",
        start: 800,
        end: 482820,
        words: [...]
      }]
     */
    editableTranscript = originalTranscript.utterances.map(
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
    
    console.log(`originalTranscript:`, originalTranscript);
    console.log(`editableTranscript:`, editableTranscript);
    
    renderTranscript(editableTranscript);

    updateState(projectSection, 'loaded');

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
    // 2. UNLOCK UI here 
    // label.classList.remove('disabled');
    // urlUploadBtn.classList.remove('disabled');
    toggleClass(label, 'disabled');
    toggleClass(urlUploadBtn, 'disabled');
    label.innerText = 'Upload Audio';
    urlUploadBtn.innerText = 'Upload Audio';
    audioInput.value = '';
    urlInput.value = '';
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
  if (audioInput.files && audioInput.files[0]) {
    label.innerText = 'Uploading...'
    setTimeout(() => {
      handleTranscription();
    }, 2000);
  }
});

urlUploadBtn.addEventListener('click', () => {
  if (urlInput.value.trim()) {
    urlUploadBtn.innerText = 'Uploading...'
    setTimeout(() => {
      handleTranscription();
    }, 2000);
  } else {
    handleTranscription();
  }
});

// Add event listeners to play btn in custom audio interface
const playBtn = document.getElementById('play-btn')
playBtn.addEventListener("click", ()=> {
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






















