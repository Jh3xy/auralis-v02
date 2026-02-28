import assert from 'node:assert/strict';

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

function createIndexedDbMock({ openFails = false } = {}) {
  const state = {
    lastDeleteRequest: null,
    lastPutRequest: null
  };

  const db = {
    transaction() {
      return {
        objectStore() {
          return {
            delete() {
              const request = { onsuccess: null, onerror: null };
              state.lastDeleteRequest = request;
              return request;
            },
            put() {
              const request = { onsuccess: null, onerror: null };
              state.lastPutRequest = request;
              return request;
            }
          };
        }
      };
    }
  };

  const indexedDB = {
    open() {
      const request = { onsuccess: null, onerror: null, onupgradeneeded: null };
      setTimeout(() => {
        if (openFails) {
          request.onerror?.({ target: { error: new Error('open failed') } });
          return;
        }
        request.onsuccess?.({ target: { result: db } });
      }, 0);
      return request;
    }
  };

  return { indexedDB, state };
}

const { indexedDB, state } = createIndexedDbMock();
globalThis.indexedDB = indexedDB;

const { clearAudioBlob, saveAudioBlob } = await import('../src/js/audioDB.js');

{
  const clearPromise = clearAudioBlob();
  let resolved = false;
  clearPromise.then(() => {
    resolved = true;
  });

  await nextTick();
  await nextTick();
  assert.equal(resolved, false, 'clearAudioBlob resolved before delete onsuccess fired');

  state.lastDeleteRequest.onsuccess?.({ target: { result: undefined } });
  await clearPromise;
  assert.equal(resolved, true, 'clearAudioBlob did not resolve after delete onsuccess');
}

{
  const events = [];
  const flow = (async () => {
    events.push('clear-start');
    await clearAudioBlob();
    events.push('clear-done');
    events.push('save-start');
    await saveAudioBlob(new Blob(['x']));
    events.push('save-done');
  })();

  await nextTick();
  await nextTick();
  assert.deepEqual(events, ['clear-start'], 'save started before clearAudioBlob finished');

  state.lastDeleteRequest.onsuccess?.({ target: { result: undefined } });
  await nextTick();
  assert.deepEqual(events, ['clear-start', 'clear-done', 'save-start'], 'sequential await ordering broke');

  while (!state.lastPutRequest) {
    await nextTick();
  }
  state.lastPutRequest.onsuccess?.({ target: { result: undefined } });
  await flow;
  assert.deepEqual(
    events,
    ['clear-start', 'clear-done', 'save-start', 'save-done'],
    'saveAudioBlob did not complete in expected order'
  );
}

{
  const error = new Error('delete failed');
  const clearPromise = clearAudioBlob();
  await nextTick();
  await nextTick();
  state.lastDeleteRequest.onerror?.({ target: { error } });
  await assert.rejects(clearPromise, (err) => err === error);
}

{
  const openFailMock = createIndexedDbMock({ openFails: true });
  globalThis.indexedDB = openFailMock.indexedDB;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnings.push(args);
  };

  const result = await clearAudioBlob();

  console.warn = originalWarn;
  globalThis.indexedDB = indexedDB;

  assert.equal(result, undefined, 'clearAudioBlob should resolve undefined on DB open failure');
  assert.equal(warnings.length, 1, 'clearAudioBlob should log one warning on DB open failure');
}

console.log('tests/clearAudioBlob.test.js: PASSED');
