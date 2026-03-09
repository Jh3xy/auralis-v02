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

const source = fs.readFileSync('src/js/auth.js', 'utf8');
const fnToken = 'export async function signUp(email, password, displayName)';
const fnIndex = source.indexOf(fnToken);
assert.notEqual(fnIndex, -1, 'signUp declaration not found');
const braceStart = source.indexOf('{', fnIndex);
assert.notEqual(braceStart, -1, 'signUp body not found');
const fnBody = extractBlock(source, braceStart);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const signUpImpl = new AsyncFunction('email', 'password', 'displayName', 'supabase', 'window', fnBody);

global.window = { location: { origin: 'https://test.example.com' } };

let capturedPayload = null;
const mockResponse = {
  data: { user: { id: 'u1' }, session: null },
  error: null
};
const supabase = {
  auth: {
    async signUp(payload) {
      capturedPayload = payload;
      return mockResponse;
    }
  }
};

const result = await signUpImpl('ada@example.com', 'secret123', 'Ada', supabase, global.window);

assert.equal(capturedPayload.options.emailRedirectTo, 'https://test.example.com');
assert.equal(capturedPayload.options.data.display_name, 'Ada');
assert.deepEqual(result, { data: mockResponse.data, error: mockResponse.error });

delete global.window;
console.log('tests/signUp.test.js: PASSED');
