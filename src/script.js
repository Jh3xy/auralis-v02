
// Stylesheets
import './styles/variables.css'
import './styles/resets.css'
import './styles.css'
import './styles/utils.css'
import './styles/onboarding.css'
import './styles/queries.css'

console.log('Vite is Running Script!');
console.log('Auralis v02-0.00')

// Import JS files here
import { toggleClass, createInitials  } from './js/utils'

window.createInitials = createInitials

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

    // TODO: Save current targetId to LocalStorage
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
    console.log(`${currentSection} section found`)
    
    // loop through sections remove show class and add to matching section
    const sections = document.querySelectorAll('.section');
    sections.forEach((section)=> {
      if (section.id === currentSection) {
        // Remove show class from all sections
        sections.forEach((sec) => sec.classList.remove('show'));
        // Add show class to the matching section
        section.classList.add('show');
        console.log(`Switched to section: ${currentSection} after reload`);
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
        console.log(`Activated nav link: ${currentSection}`)
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



// Initialize theme toggle
// const toggleBtn = document.querySelector('.toggle-btn')
// toggleBtn.addEventListener("click", ()=> {
//   toggleClass(toggleBtn, 'on')
//   toggleClass(document.body, 'light')
// })



// Grab file upload input for API use
const audioInput = document.getElementById('audio-input')
audioInput.addEventListener("change", ()=> {
  const audio = audioInput.files[0];
  // Check if an actual audio file was selected
  if (!audio) {
    console.log('No audio Uploaded')
    return
  }

  // Convert audio size from Bytes to MB and check if larger than 500MB as per Assembly AI's specs
  const sizeInMB = audio.size / (1024 * 1024)
  if (sizeInMB >= 500) {
    console.log('Cannot upload file greater than 500MB')
    return
  }
  console.log(`${audio.name} has been uploaded`);
  console.log(`Audio type is ${audio.type}`);
  console.log(`Audio size is ${sizeInMB.toFixed(2)}`);
})




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


