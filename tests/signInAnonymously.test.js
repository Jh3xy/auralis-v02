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
const fnToken = 'export async function signInAnonymously()';
const fnIndex = source.indexOf(fnToken);
assert.notEqual(fnIndex, -1, 'signInAnonymously declaration not found');
const braceStart = source.indexOf('{', fnIndex);
assert.notEqual(braceStart, -1, 'signInAnonymously body not found');
const fnBody = extractBlock(source, braceStart);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const signInAnonymouslyImpl = new AsyncFunction('supabase', fnBody);

const mockResponse = {
  data: { user: { id: 'anon-1', is_anonymous: true }, session: {} },
  error: null
};
const supabase = {
  auth: {
    async signInAnonymously() {
      return mockResponse;
    }
  }
};

const result = await signInAnonymouslyImpl(supabase);

assert.deepEqual(result, { data: mockResponse.data, error: mockResponse.error });
assert.equal(result.data.user.is_anonymous, true);

console.log('tests/signInAnonymously.test.js: PASSED');
