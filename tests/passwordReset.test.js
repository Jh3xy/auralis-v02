import assert from 'node:assert/strict';
import fs from 'node:fs';

function extractBlock(source, braceStartIndex) {
  let depth = 0;
  let end = -1;
  for (let i = braceStartIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error('Failed to extract block');
  return source.slice(braceStartIndex + 1, end);
}

function extractFunctionBody(source, token) {
  const fnIndex = source.indexOf(token);
  assert.notEqual(fnIndex, -1, `${token} declaration not found`);
  const braceStart = source.indexOf('{', fnIndex);
  assert.notEqual(braceStart, -1, `${token} body not found`);
  return extractBlock(source, braceStart);
}

class ClassList {
  constructor(initial = []) {
    this.set = new Set(initial);
  }
  add(name) {
    this.set.add(name);
  }
  remove(name) {
    this.set.delete(name);
  }
  has(name) {
    return this.set.has(name);
  }
}

const authSource = fs.readFileSync('src/js/auth.js', 'utf8');
const scriptSource = fs.readFileSync('src/script.js', 'utf8');

const updatePasswordToken = 'export async function updatePassword(newPassword)';
const updatePasswordBody = extractFunctionBody(authSource, updatePasswordToken);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const updatePasswordImpl = new AsyncFunction('newPassword', 'supabase', updatePasswordBody);
assert.equal(typeof updatePasswordImpl, 'function');

const showRecoveryToken = 'function showPasswordRecoveryPanel()';
const showRecoveryBody = extractFunctionBody(scriptSource, showRecoveryToken);
const showPasswordRecoveryPanelImpl = new Function('document', 'goToStep', showRecoveryBody);

const authPanelSignup = { classList: new ClassList() };
const authPanelLogin = { classList: new ClassList() };
const authPanelForgot = { classList: new ClassList() };
const authPanelSetNew = { classList: new ClassList(['hidden']) };
const authTabA = { classList: new ClassList(['active']) };
const authTabB = { classList: new ClassList() };
const setNewPasswordErr = { innerText: 'old error', style: { display: 'block' } };
const documentStub = {
  documentElement: { classList: new ClassList(['onboarded']) },
  querySelectorAll(selector) {
    if (selector === '.auth-tab') return [authTabA, authTabB];
    if (selector === '.auth-panel') return [authPanelSignup, authPanelLogin, authPanelForgot, authPanelSetNew];
    return [];
  },
  getElementById(id) {
    if (id === 'set-new-password-panel') return authPanelSetNew;
    if (id === 'set-new-password-err') return setNewPasswordErr;
    return null;
  }
};

let stepCalled = null;
showPasswordRecoveryPanelImpl(documentStub, (step) => {
  stepCalled = step;
});

assert.equal(documentStub.documentElement.classList.has('onboarded'), false);
assert.equal(stepCalled, 4);
assert.equal(authPanelSignup.classList.has('hidden'), true);
assert.equal(authPanelLogin.classList.has('hidden'), true);
assert.equal(authPanelForgot.classList.has('hidden'), true);
assert.equal(authPanelSetNew.classList.has('hidden'), false);
assert.equal(setNewPasswordErr.innerText, '');
assert.equal(setNewPasswordErr.style.display, 'none');

const validateToken = 'function validatePasswordResetInputs(newPassword, confirmPassword)';
const validateBody = extractFunctionBody(scriptSource, validateToken);
const validatePasswordResetInputsImpl = new Function('newPassword', 'confirmPassword', validateBody);

assert.equal(validatePasswordResetInputsImpl('password123', 'password456'), 'Passwords do not match.');
assert.equal(validatePasswordResetInputsImpl('short', 'short'), 'Password must be at least 8 characters.');
assert.equal(validatePasswordResetInputsImpl('longenough', 'longenough'), null);

console.log('tests/passwordReset.test.js: PASSED');
