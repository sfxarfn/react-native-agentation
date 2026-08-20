import assert from 'node:assert/strict';
import {test} from 'node:test';

import {appFrames, formatFrame, isAppFrame, shortPath, type Frame} from './format.ts';

const frame = (file: string | null, extra: Partial<Frame> = {}): Frame => ({
  name: 'C',
  file,
  line: 1,
  column: 0,
  ...extra,
});

test('drops React and React Native frames', () => {
  assert.equal(isAppFrame(frame('/p/node_modules/react-native/Libraries/View.js')), false);
  assert.equal(isAppFrame(frame('/p/node_modules/react/cjs/react.js')), false);
  assert.equal(isAppFrame(frame('/p/node_modules/@react-native/x.js')), false);
  assert.equal(isAppFrame(frame('[native code]')), false);
  assert.equal(isAppFrame(frame(null)), false);
  assert.equal(isAppFrame(frame('/p/src/App.tsx', {collapse: true})), false);
});

test('keeps app code and third-party components', () => {
  assert.equal(isAppFrame(frame('/p/src/App.tsx')), true);
  assert.equal(isAppFrame(frame('/p/node_modules/react-native-paper/Button.js')), true);
});

test('falls back to the raw stack rather than nothing', () => {
  const internals = [frame('/p/node_modules/react-native/Libraries/View.js')];
  assert.deepEqual(appFrames(internals), internals);
});

test('shortPath strips the Metro bundle URL and query', () => {
  assert.equal(shortPath('http://localhost:8081/src/App.tsx?platform=ios'), 'src/App.tsx');
  assert.equal(shortPath('/Users/me/p/src/App.tsx'), '/Users/me/p/src/App.tsx');
});

test('formatFrame is greppable', () => {
  assert.equal(formatFrame(frame('/p/src/App.tsx', {name: 'Button', line: 23})), 'Button  /p/src/App.tsx:23');
  assert.equal(formatFrame(frame(null, {name: 'Button'})), 'Button');
});
