
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




export { toggleClass,createInitials }