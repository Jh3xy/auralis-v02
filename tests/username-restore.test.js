import assert from 'node:assert/strict';

function applyUsernameRestore(displayName, usernameEl) {
  if (usernameEl && displayName.trim()) usernameEl.textContent = displayName.trim();
}

{
  const usernameEl = { textContent: 'Guest' };
  const displayName = 'John Doe';
  applyUsernameRestore(displayName, usernameEl);
  assert.equal(usernameEl.textContent, 'John Doe');
}

{
  const usernameEl = { textContent: 'Guest' };
  const displayName = '';
  applyUsernameRestore(displayName, usernameEl);
  assert.equal(usernameEl.textContent, 'Guest');
}

{
  const usernameEl = { textContent: 'Guest' };
  const displayName = '   ';
  applyUsernameRestore(displayName, usernameEl);
  assert.equal(usernameEl.textContent, 'Guest');
}

console.log('username-restore tests passed');
