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

function createClassList() {
  const set = new Set();
  return {
    add(value) {
      set.add(value);
    },
    remove(value) {
      set.delete(value);
    },
    has(value) {
      return set.has(value);
    }
  };
}

const source = fs.readFileSync('src/script.js', 'utf8');
const handlerMatch = source.match(/dashboardBtn\.addEventListener\("click",\s*\(\)\s*=>\s*\{/);
assert.ok(handlerMatch, 'dashboardBtn sync handler declaration not found');
const handlerStart = handlerMatch.index + handlerMatch[0].length - 1;
const handlerBody = extractBlock(source, handlerStart);
assert.equal(handlerBody.includes('getSession'), false);

const FunctionCtor = Object.getPrototypeOf(function () {}).constructor;
const dashboardHandler = new FunctionCtor('document', 'setTimeout', 'localStorage', handlerBody);

const docElClassList = createClassList();
const document = { documentElement: { classList: docElClassList } };
const timeoutDelays = [];
const setTimeoutMock = (cb, ms) => {
  timeoutDelays.push(ms);
  cb();
  return timeoutDelays.length;
};
const localStorageCalls = [];
const localStorage = {
  setItem(key, value) {
    localStorageCalls.push([key, value]);
  }
};

dashboardHandler(document, setTimeoutMock, localStorage);

assert.equal(localStorageCalls.some(([key, value]) => key === 'auralis-guest' && value === 'true'), true);
assert.equal(docElClassList.has('onboarded'), true);
assert.equal(docElClassList.has('transitioning'), false);
assert.deepEqual(timeoutDelays, [400, 500]);

console.log('tests/dashboardBtn.test.js: PASSED');
