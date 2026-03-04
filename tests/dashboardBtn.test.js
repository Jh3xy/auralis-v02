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

function createClassList(operations) {
  const set = new Set();
  return {
    add(value) {
      operations.push(`class.add:${value}`);
      set.add(value);
    },
    remove(value) {
      operations.push(`class.remove:${value}`);
      set.delete(value);
    },
    has(value) {
      return set.has(value);
    }
  };
}

function createTestContext() {
  const operations = [];
  const document = { documentElement: { classList: createClassList(operations) } };
  const timeoutDelays = [];
  const setTimeoutMock = (cb, ms) => {
    timeoutDelays.push(ms);
    cb();
    return timeoutDelays.length;
  };
  const localStorageCalls = [];
  const localStorage = {
    setItem(key, value) {
      operations.push(`localStorage.setItem:${key}:${value}`);
      localStorageCalls.push([key, value]);
    }
  };
  return { document, timeoutDelays, setTimeoutMock, localStorage, localStorageCalls, operations };
}

const source = fs.readFileSync('src/script.js', 'utf8');
const handlerMatch = source.match(/dashboardBtn\.addEventListener\("click",\s*async\s*\(\)\s*=>\s*\{/);
assert.ok(handlerMatch, 'dashboardBtn async handler declaration not found');
const handlerStart = handlerMatch.index + handlerMatch[0].length - 1;
const handlerBody = extractBlock(source, handlerStart);
assert.equal(handlerBody.includes('getSession'), false);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const dashboardHandler = new AsyncFunction('signInAnonymously', 'document', 'setTimeout', 'localStorage', 'console', handlerBody);

{
  const ctx = createTestContext();
  let signInCalls = 0;
  const signInAnonymously = async () => {
    signInCalls += 1;
    ctx.operations.push('signInAnonymously.called');
    return { data: { session: { access_token: 't1' } }, error: null };
  };
  const consoleMock = { warn() {} };

  await dashboardHandler(signInAnonymously, ctx.document, ctx.setTimeoutMock, ctx.localStorage, consoleMock);

  assert.equal(signInCalls, 1);
  const signInIndex = ctx.operations.indexOf('signInAnonymously.called');
  const firstTransitionIndex = ctx.operations.indexOf('class.add:transitioning');
  assert.notEqual(signInIndex, -1);
  assert.notEqual(firstTransitionIndex, -1);
  assert.equal(signInIndex < firstTransitionIndex, true);
  assert.equal(ctx.localStorageCalls.some(([key, value]) => key === 'auralis-guest' && value === 'true'), true);
  assert.equal(ctx.document.documentElement.classList.has('onboarded'), true);
  assert.equal(ctx.document.documentElement.classList.has('transitioning'), false);
  assert.deepEqual(ctx.timeoutDelays, [400, 500]);
}

{
  const ctx = createTestContext();
  let signInCalls = 0;
  const signInAnonymously = async () => {
    signInCalls += 1;
    ctx.operations.push('signInAnonymously.called');
    return { data: null, error: { message: 'anon disabled' } };
  };
  let warned = false;
  const consoleMock = { warn() { warned = true; } };

  await dashboardHandler(signInAnonymously, ctx.document, ctx.setTimeoutMock, ctx.localStorage, consoleMock);

  assert.equal(signInCalls, 1);
  assert.equal(warned, true);
  assert.equal(ctx.document.documentElement.classList.has('onboarded'), true);
  assert.equal(ctx.document.documentElement.classList.has('transitioning'), false);
  assert.deepEqual(ctx.timeoutDelays, [400, 500]);
}

console.log('tests/dashboardBtn.test.js: PASSED');
