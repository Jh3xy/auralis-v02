
// utils.js


// toggle active class on elements
function toggleClass(element, className, callback) {

  //check the typeof element using instaceof since typeof will return 'object' for both a Nodelist and an element
  if (element instanceof NodeList) {
    // loop through them to toggle class
    element.forEach((elem)=> {
      elem.addEventListener("click",()=>{
        element.forEach((el)=> {
          el.classList.remove(className)
        })
        elem.classList.add(className)
        // Call the callback function if provided, passing the clicked element
        if (callback && typeof callback === 'function') {
          callback(elem)
        }
      })
    })
  } else {
    element.classList.toggle(className)
  }

}


// TODO: Write function to grab username from onboarding phase and set in localStorage 
function createInitials(username) {
  if (!username || typeof username !== 'string') {
    console.warn('Invalid username provided to createInitials');
    return;
  }
  // grab username in full for .username in dashboard
  let user = username

  // turn username into an array & grab the first letter of the first item in that array (first name)
  let names = username.trim().split(' ');
  let initials = names[0].charAt(0).toUpperCase();
  if (names.length > 1) {
    initials += names[names.length -1].charAt(0).toUpperCase();
  };
  
  // Grab username from localStorage
  let onboarding;

  try {
    onboarding = JSON.parse(localStorage.getItem('auralis-onboarding'));
  } catch (e) {
    console.warn('auralis-onboarding is invalid JSON, resetting.', e);
    onboarding = null;
  }

  if (!onboarding || typeof onboarding !== 'object') {
    onboarding = {
      username: user,
      isCompleted: false,
      currentStep: 2,
      time: new Date().toISOString()
    };
  } else {
    onboarding.username = user;
  }

  localStorage.setItem('auralis-onboarding', JSON.stringify(onboarding));

  
  
  console.log(initials);
  console.log(onboarding.username)
  // return initials;

  // Personalize slider four heading text
  const sliderHeading = document.querySelector('.slider-four h1')
  if (sliderHeading) {
    sliderHeading.textContent = `Ready to Listen ${names[0].charAt(0).toUpperCase()}${names[0].slice(1).toLowerCase()}?`
  }

  // Update the username display in sidebar
  const usernameElement = document.getElementById('username');
  if (usernameElement) {
    username = `${names[0].charAt(0).toUpperCase()}${names[0].slice(1).toLowerCase()}`
    usernameElement.textContent = username;
  }

  // Update both pfp elements
  const headerPfp = document.getElementById('header-pfp');
  const sidebarPfp = document.getElementById('sidebar-pfp');
  
  if (headerPfp) {
    headerPfp.textContent = initials;
  }
  
  if (sidebarPfp) {
    sidebarPfp.textContent = initials;
  }

  console.log(`Updated initials to: ${initials} for user: ${username}`);
}


// Format time for speak diarization print in UI 
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // This ensures we get "01:05" instead of "1:5"
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}


/**
 * Converts a timestamp (like Date.now()) to formatted date string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {boolean} useMonthName - If true, uses month name (e.g., "Feb"), if false uses number (e.g., "02")
 * @returns {string} Formatted date string
 */
function formatDate(timestamp, useMonthName = false) {
  const date = new Date(timestamp);
  
  const month = date.getMonth() + 1; // 0-indexed, so add 1
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2); // Last 2 digits
  
  if (useMonthName) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${day}, ${year}`;
  }
  
  // Numeric format with leading zeros
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  
  return `${monthStr} ${dayStr}, ${year}`;
}


// Additional date formatting functions for different contexts (e.g., full date, relative time)

/**
 * Get current date formatted
 * @param {boolean} useMonthName - If true, uses month name
 * @returns {string} Current date formatted
 */
function getCurrentDate(useMonthName = false) {
  return formatDate(Date.now(), useMonthName);
}

/**
 * Formats date in full format (e.g., "October 24, 2023")
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Full formatted date
 */
function formatDateFull(timestamp) {
  const date = new Date(timestamp);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Formats time in 12-hour format (e.g., "02:30 PM")
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // If 0, make it 12
  
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Get relative time (e.g., "Just now", "2 mins ago", "3 hours ago")
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Relative time string
 */
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  // If older than a week, return formatted date
  return formatDate(timestamp, true);
}



// Export all utility functions
export {
  // DOM Utilities
  toggleClass,
  createInitials,
  
  // Date Formatting
  formatDate,
  getCurrentDate,
  formatDateFull,
  
  // Time Utilities
  formatTime,
  getRelativeTime,
};