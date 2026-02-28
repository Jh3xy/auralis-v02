import assert from 'node:assert/strict';

const MAX_POLL_MS = 5 * 60 * 1000;

function createPollingTimeoutHarness(startedAt) {
  let pollingIntervalId = 1;
  let pollingInFlight = false;
  let pollingJobId = 'job-1';
  let pollingContext = {
    startedAt,
    uploadType: 'file',
    uploadData: { name: 'clip.wav' }
  };
  let pollingErrorCount = 0;

  let stopPollingCalls = 0;
  let clearActiveJobCalls = 0;
  let stopElapsedTimerCalls = 0;
  let stopLoadingCopyRotationCalls = 0;
  let showRetryToastCalls = 0;
  let unlockUploadUICalls = 0;
  let fetchCalls = 0;

  function stopPolling() {
    if (pollingIntervalId) {
      pollingIntervalId = null;
    }
    pollingInFlight = false;
    pollingJobId = null;
    pollingContext = null;
    pollingErrorCount = 0;
    stopPollingCalls += 1;
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

  async function fetchMock() {
    fetchCalls += 1;
    return {
      ok: true,
      async json() {
        return { status: 'processing' };
      }
    };
  }

  async function pollOnce() {
    if (pollingInFlight) return;
    pollingInFlight = true;

    try {
      const pollStartedAt = pollingContext?.startedAt;
      if (
        typeof pollStartedAt === 'number' &&
        Number.isFinite(pollStartedAt) &&
        (Date.now() - pollStartedAt) > MAX_POLL_MS
      ) {
        const contextSnapshot = pollingContext;
        stopPolling();
        clearActiveJob();
        stopElapsedTimer();
        stopLoadingCopyRotation();
        showRetryToast('default', contextSnapshot?.uploadType, contextSnapshot?.uploadData);
        unlockUploadUI();
        return;
      }
      const response = await fetchMock();
      pollingErrorCount = 0;
      if (!response.ok) {
        throw new Error('unexpected');
      }
      const payload = await response.json();
      if (payload.status === 'processing') return;
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
        fetchCalls,
        pollingIntervalId,
        pollingJobId,
        pollingContext
      };
    }
  };
}

{
  const harness = createPollingTimeoutHarness(Date.now());
  await harness.pollOnce();
  const state = harness.getState();
  assert.equal(state.stopPollingCalls, 0);
  assert.equal(state.clearActiveJobCalls, 0);
  assert.equal(state.fetchCalls, 1);
}

{
  const harness = createPollingTimeoutHarness(Date.now() - (6 * 60 * 1000));
  await harness.pollOnce();
  const state = harness.getState();
  assert.equal(state.stopPollingCalls, 1);
  assert.equal(state.clearActiveJobCalls, 1);
}

{
  const harness = createPollingTimeoutHarness(Date.now() - (6 * 60 * 1000));
  await harness.pollOnce();
  await harness.pollOnce();
  const state = harness.getState();
  assert.equal(state.stopPollingCalls, 1);
  assert.equal(state.clearActiveJobCalls, 1);
}

console.log('tests/pollingTimeout.test.js: PASSED');
