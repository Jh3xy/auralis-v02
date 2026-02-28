import assert from 'node:assert/strict';

function createPollingHarness() {
  let pollingInFlight = false;
  let pollingContext = { uploadType: 'file', uploadData: { name: 'a.wav' } };
  let pollingErrorCount = 0;

  let stopPollingCalls = 0;
  let clearActiveJobCalls = 0;
  let stopElapsedTimerCalls = 0;
  let stopLoadingCopyRotationCalls = 0;
  let showRetryToastCalls = 0;
  let unlockUploadUICalls = 0;

  function stopPolling() {
    stopPollingCalls += 1;
    pollingErrorCount = 0;
  }

  function clearActiveJob() {
    clearActiveJobCalls += 1;
  }

  function stopElapsedTimer() {
    stopElapsedTimerCalls += 1;
  }

  function stopLoadingCopyRotation() {
    stopLoadingCopyRotationCalls += 1;
  }

  function showRetryToast() {
    showRetryToastCalls += 1;
  }

  function unlockUploadUI() {
    unlockUploadUICalls += 1;
  }

  async function pollOnce(mode) {
    if (pollingInFlight) return;
    pollingInFlight = true;

    try {
      if (mode === 'error') {
        throw new Error('Network failure');
      }

      // Mirrors the counter reset on successful fetch response.
      pollingErrorCount = 0;
    } catch (error) {
      console.error('Polling error:', error);
      const activeJob = null;
      const startedAt = Number(activeJob?.startedAt);
      const uploadWindowMs = 15 * 60 * 1000;
      if (Number.isFinite(startedAt) && (Date.now() - startedAt) <= uploadWindowMs) {
        console.warn('Polling transient error within upload window; retaining active job state.');
        return;
      }
      pollingErrorCount += 1;
      console.warn(`Polling error (${pollingErrorCount}/3):`, error);
      if (pollingErrorCount < 3) return;
      const contextSnapshot = pollingContext;
      stopPolling();
      clearActiveJob();
      stopElapsedTimer();
      stopLoadingCopyRotation();
      showRetryToast('default', contextSnapshot?.uploadType, contextSnapshot?.uploadData);
      unlockUploadUI();
    } finally {
      pollingInFlight = false;
    }
  }

  return {
    pollOnce,
    getState() {
      return {
        stopPollingCalls,
        clearActiveJobCalls,
        stopElapsedTimerCalls,
        stopLoadingCopyRotationCalls,
        showRetryToastCalls,
        unlockUploadUICalls,
        pollingErrorCount
      };
    }
  };
}

{
  const harness = createPollingHarness();
  await harness.pollOnce('error');
  await harness.pollOnce('error');
  const state = harness.getState();
  assert.equal(state.stopPollingCalls, 0);
  assert.equal(state.clearActiveJobCalls, 0);
}

{
  const harness = createPollingHarness();
  await harness.pollOnce('error');
  await harness.pollOnce('error');
  await harness.pollOnce('error');
  const state = harness.getState();
  assert.equal(state.stopPollingCalls, 1);
  assert.equal(state.clearActiveJobCalls, 1);
}

{
  const harness = createPollingHarness();
  await harness.pollOnce('error');
  await harness.pollOnce('error');
  await harness.pollOnce('success');
  await harness.pollOnce('error');
  const state = harness.getState();
  assert.equal(state.stopPollingCalls, 0);
  assert.equal(state.clearActiveJobCalls, 0);
}

console.log('tests/polling.test.js: PASSED');
