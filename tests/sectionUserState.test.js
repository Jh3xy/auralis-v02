import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/script.js', 'utf8');
const match = source.match(/export function classifySectionUserState\(supabaseUser, guestFlag\) \{[\s\S]*?\n\}/);

assert.ok(match, 'classifySectionUserState export was not found in src/script.js');

const sandbox = { module: { exports: null } };
vm.createContext(sandbox);
vm.runInContext(`${match[0].replace('export ', '')}\nmodule.exports = classifySectionUserState;`, sandbox);
const classifySectionUserState = sandbox.module.exports;

assert.equal(
  classifySectionUserState({ is_anonymous: true }, null),
  'guest',
  'anonymous Supabase users should be guest'
);

assert.equal(
  classifySectionUserState(null, 'true'),
  'guest',
  'guest localStorage flag should force guest state'
);

assert.equal(
  classifySectionUserState({ id: 'abc', is_anonymous: false }, null),
  'user',
  'non-anonymous authenticated users should be user'
);

assert.equal(
  classifySectionUserState(null, null),
  null,
  'missing Supabase user should return null'
);

console.log('sectionUserState tests passed');
