import assert from 'node:assert/strict';

function runDashboardSetTimeoutCallback(savedState, { localStorage, document }) {
  if (!savedState || typeof savedState !== 'object') {
    const fallback = {
      isCompleted: true,
      time: new Date().toISOString(),
      currentStep: 4
    };
    localStorage.setItem('auralis-onboarding', JSON.stringify(fallback));
    document.documentElement.classList.add('onboarded');
    return;
  }
  savedState.isCompleted = true;
  savedState.time = new Date().toISOString();
  const newSavedState = JSON.stringify(savedState);
  localStorage.setItem('auralis-onboarding', newSavedState);
  document.documentElement.classList.add('onboarded');
}

{
  let stored = null;
  const classes = new Set();
  const localStorage = {
    setItem(key, value) {
      if (key === 'auralis-onboarding') stored = value;
    }
  };
  const document = {
    documentElement: {
      classList: {
        add(value) {
          classes.add(value);
        }
      }
    }
  };

  runDashboardSetTimeoutCallback(null, { localStorage, document });
  const parsed = JSON.parse(stored);
  assert.equal(parsed.isCompleted, true);
  assert.equal(parsed.currentStep, 4);
  assert.equal(typeof parsed.time, 'string');
  assert.equal(classes.has('onboarded'), true);
}

{
  let stored = null;
  const classes = new Set();
  const localStorage = {
    setItem(key, value) {
      if (key === 'auralis-onboarding') stored = value;
    }
  };
  const document = {
    documentElement: {
      classList: {
        add(value) {
          classes.add(value);
        }
      }
    }
  };
  const savedState = { isCompleted: false, currentStep: 3, time: null };

  runDashboardSetTimeoutCallback(savedState, { localStorage, document });
  const parsed = JSON.parse(stored);
  assert.equal(savedState.isCompleted, true);
  assert.equal(typeof savedState.time, 'string');
  assert.deepEqual(parsed, savedState);
  assert.equal(classes.has('onboarded'), true);
}

{
  let threw = false;
  const localStorage = {
    setItem() {}
  };
  const document = {
    documentElement: {
      classList: {
        add() {}
      }
    }
  };

  try {
    runDashboardSetTimeoutCallback(null, { localStorage, document });
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
}

console.log('tests/savedStateGuard.test.js: PASSED');
