import assert from 'node:assert/strict';

function createMockDocument() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners.has(type)) return;
      listeners.set(
        type,
        listeners.get(type).filter((listener) => listener !== fn)
      );
    },
    dispatch(type, event) {
      const handlers = listeners.get(type) || [];
      handlers.slice().forEach((handler) => handler(event));
    }
  };
}

function createKeydownEvent() {
  return {
    ctrlKey: true,
    metaKey: false,
    key: 's',
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

{
  const document = createMockDocument();
  let editingIndex = 5;
  let saveCalls = 0;

  function handleSave(index) {
    document.removeEventListener('keydown', handleKeyDown);
    saveCalls += 1;
    assert.strictEqual(index, 5);
  }

  function cancelEdit(index) {
    document.removeEventListener('keydown', handleKeyDown);
    void index;
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const index = editingIndex;
      handleSave(index);
    }
  }

  for (let i = 0; i < 5; i += 1) {
    document.addEventListener('keydown', handleKeyDown);
  }

  handleSave(editingIndex);
  const event = createKeydownEvent();
  document.dispatch('keydown', event);

  assert.strictEqual(saveCalls, 1, 'Ctrl+S should not trigger handleSave after save cleanup');
  assert.strictEqual(event.defaultPrevented, false, 'No keydown handler should run after cleanup');

  cancelEdit(editingIndex);
}

{
  const document = createMockDocument();
  let editingIndex = 2;
  let saveCalls = 0;

  function handleSave(index) {
    document.removeEventListener('keydown', handleKeyDown);
    saveCalls += 1;
    void index;
  }

  function cancelEdit(index) {
    document.removeEventListener('keydown', handleKeyDown);
    void index;
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave(editingIndex);
    }
  }

  for (let i = 0; i < 3; i += 1) {
    document.addEventListener('keydown', handleKeyDown);
  }

  cancelEdit(editingIndex);
  document.dispatch('keydown', createKeydownEvent());

  assert.strictEqual(saveCalls, 0, 'Ctrl+S should not trigger handleSave after cancel cleanup');
}

console.log('tests/handleKeyDown.test.js: PASSED');
