
// Stylesheets
import './styles/variables.css'
import './styles/resets.css'
import './styles.css'
import './styles/utils.css'
import './styles/onboarding.css'
import './styles/queries.css'

console.log('Vite is Running Script!');
console.log('Auralis v02-0.00')


// Onboarding Setup with LocalStorage

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

const dashboardBtn = document.getElementById('dashboard-link')
console.log(dashboardBtn)


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
  }, 200); // Small delay for smoothness
})






