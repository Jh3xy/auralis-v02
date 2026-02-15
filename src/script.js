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
console.log('Auralis v02-1.00')

// Import JS files here
import { toggleClass, createInitials, formatTime, formatDate, resetAudioUI  } from './js/utils'
import { uploadAndTranscribe } from "./js/transcribe";
import { eventHub } from "./js/eventhub";

window.createInitials = createInitials

let utterances;
window.utterances = utterances;

// Function that sets UI states
function updateState(element, state) {
  const states = ['loading', 'loaded'];
  element.classList.remove(...states)
  element.classList.add(state)
}


// Wait promise for enforcng mimimum dispay time
// This creates a "pause" that doesn't freeze the browser
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));



// === TRANSCRIPTION FUNCTION
// ============================================

const audioInput = document.getElementById('audio-input');
const urlInput = document.getElementById('url-audio-input');
const urlUploadBtn = document.querySelector('.url-upload-btn');
const label = document.querySelector('label[for="audio-input"]');
const urlDesc = document.querySelector('.url-desc');
const uploadStatus = document.querySelector('.state');

let currentAudioUrl = null;
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
    if (sizeInMB >= 500) {
      alert('File too large. Maximum size is 500MB.');
      return;
    }
    
    // Update Audio player in transcript

    // create a new one
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
    const projectSection = document.getElementById('projects');
    const projectTab = document.querySelector('.nav-link[data-id="projects"]');
    const file = document.querySelector('.file.loading-sub-text');
    const transcriptTitle = document.querySelector('.transcript-title');
    const audioName = document.querySelector('.audio-name');
    const transcriptDate = document.querySelector('.current-date');
    const transcriptEditor = document.querySelector('.transcript-body');

    // UI Prep
    transcriptTitle.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;
    audioName.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;
    transcriptDate.innerText = formatDate(Date.now(), true);
    uploadStatus.innerText = 'Active';
    uploadStatus.classList.remove('failed');
    file.innerText = `${uploadType === 'file' ? uploadData.name : uploadData}...`;

    updateState(projectSection, 'loading');
    projectTab.click();

    const transcriptText = await uploadAndTranscribe(uploadType, uploadData);
    
    const elapsed = Date.now() - start;
    if (elapsed < MIN_DISPLAY_TIME) {
      await wait(MIN_DISPLAY_TIME - elapsed);
    }

    transcriptEditor.innerHTML = ''; 
    utterances = transcriptText.utterances;

    utterances.forEach((utterance) => {
      const startTime = formatTime(utterance.start);
      const endTime = formatTime(utterance.end);
      const wordsHTML = utterance.text.split(' ').map(word => `<span>${word} </span>`).join('');

      const speakerBox = `
          <div class="speaker-box flex items-start gap-8">
            <div class="speaker-tag flex gap-1 shrink-0 flex-col">
              <span class="speaker">Speaker 1</span><span class="speaker-metadata sub-text">00:00 - 00:45</span>
                  <div class="edit-controls flex gap-2"><button class="edit-btn btn"><i data-lucide="square-pen"></i></button><div class="controls-secondary flex gap-1"><buttons class="save-btn btn"><i data-lucide="save"></i></buttons><buttons class="cancel-btn btn"><i data-lucide="ban"></i></buttons></div></div></div><p class="speaker-text">${wordsHTML}</p></div>
      `
      transcriptEditor.insertAdjacentHTML('beforeend', speakerBox);
      lucide.createIcons();

      // TODO: Attach event listners for editing .speaker-text
    });

    updateState(projectSection, 'loaded');

    // Clean up
    label.classList.remove('disabled');
    urlUploadBtn.classList.remove('disabled');
    label.innerText = 'Upload Audio';
    urlUploadBtn.innerText = 'Upload Audio';
    audioInput.value = '';
    urlInput.value = '';
    
  } catch (error) {
    console.error('Failed to transcribe:', error);
    uploadStatus.innerText = 'Failed';
    uploadStatus.classList.add('failed');

    await wait(2000); 

    label.classList.remove('disabled');
    urlUploadBtn.classList.remove('disabled');
    label.innerText = 'Upload Audio';
    urlUploadBtn.innerText = 'Upload Audio';

    const transcriptTab = document.querySelector('.nav-link[data-id="transcription"]');
    transcriptTab.click();
  }
}

// 2. Initialize EVENT LISTENERS
audioInput.addEventListener('change', () => {
  if (audioInput.files && audioInput.files[0]) {
    label.classList.add('disabled');
    label.innerText = 'Uploading...';

    setTimeout(() => {
      handleTranscription();
    }, 1000);
  }
});

urlUploadBtn.addEventListener('click', () => {
  if (urlInput.value.trim()) {
    urlUploadBtn.classList.add('disabled');
    urlUploadBtn.innerText = 'Uploading...';
    setTimeout(() => {
      handleTranscription();
    }, 1000);
  } else {
    handleTranscription();
  }
});

// Add event listeners to play btn in custom audio interface
const playBtn = document.getElementById('customPlayBtn')
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
  lucide.createIcons();
})

// Sync ranger slider input with audio
const audioRange = document.getElementById('audio-range');
transcriptAudio.addEventListener("timeupdate", ()=> {
  const percentage = (transcriptAudio.currentTime / transcriptAudio.duration) * 100;
  audioRange.value = percentage;
});
audioRange.addEventListener('input', () => {
  const time = (audioRange.value / 100) * transcriptAudio.duration;
  transcriptAudio.currentTime = time;
});




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
    console.log(currentSection)
    // Find the matching section
    let matchFound = false;
    
    sections.forEach((section) => {
      if (section.id === targetId) {
        matchFound = true;
        // Remove show class from all sections
        sections.forEach((sec) => sec.classList.remove('show'));
        // Add show class to the matching section
        section.classList.add('show');
        console.log(`Switched to section: ${targetId}`);
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
      
      console.log('Navigated to Transcription section from empty state');
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






















