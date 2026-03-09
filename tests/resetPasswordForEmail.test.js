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
const fnToken = 'export async function resetPasswordForEmail(email)';
const fnIndex = source.indexOf(fnToken);
assert.notEqual(fnIndex, -1, 'resetPasswordForEmail declaration not found');
const braceStart = source.indexOf('{', fnIndex);
assert.notEqual(braceStart, -1, 'resetPasswordForEmail body not found');
const fnBody = extractBlock(source, braceStart);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const resetPasswordForEmailImpl = new AsyncFunction('email', 'supabase', 'window', fnBody);

global.window = { location: { origin: 'https://test.example.com' } };

let capturedEmail = null;
let capturedOptions = null;
const mockResponse = {
  data: { message: 'sent' },
  error: null
};
const supabase = {
  auth: {
    async resetPasswordForEmail(email, options) {
      capturedEmail = email;
      capturedOptions = options;
      return mockResponse;
    }
  }
};

const result = await resetPasswordForEmailImpl('test@example.com', supabase, global.window);

assert.equal(capturedEmail, 'test@example.com');
assert.equal(capturedOptions.redirectTo, 'https://test.example.com');
assert.deepEqual(result, { data: mockResponse.data, error: mockResponse.error });

delete global.window;
console.log('tests/resetPasswordForEmail.test.js: PASSED');
