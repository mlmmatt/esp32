const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getStatusPillCopy,
  getAgentUpdateCopy,
  getSystemChatCopy,
  getHeroSubtitle,
  getHeroTagline,
  getAssistantLabel,
} = require('../ui-copy.js');

test('status pill emphasizes deterministic core and Hy3 assist states', () => {
  assert.equal(getStatusPillCopy('idle'), 'Core build: ready');
  assert.equal(getStatusPillCopy('thinking'), 'Core build: ready • Hy3 assist: updating');
  assert.equal(getStatusPillCopy('live'), 'Core build: ready • Hy3 assist: active');
  assert.equal(getStatusPillCopy('offline'), 'Core build: ready • Hy3 assist: unavailable');
});

test('silent agent update copy keeps deterministic build primary', () => {
  assert.equal(
    getAgentUpdateCopy({ mode: 'thinking', silent: true }),
    'Core build is ready. Hy3 is writing a short explanation for this hardware selection.'
  );
  assert.equal(
    getAgentUpdateCopy({ mode: 'offline', silent: true }),
    'Core build updated locally for this hardware selection. Hy3 assist is unavailable right now.'
  );
  assert.equal(
    getAgentUpdateCopy({ mode: 'live', silent: true, summary: 'Added wind and rain pulse handling.' }),
    'Core build is ready. Hy3 assist: Added wind and rain pulse handling.'
  );
});

test('chat/system copy reflects Hy3 as optional assist rather than source of truth', () => {
  assert.equal(
    getSystemChatCopy({ mode: 'silent-offline' }),
    'Core build updated locally. Hy3 assist is offline, so the deterministic sketch is still shown.'
  );
  assert.equal(
    getSystemChatCopy({ mode: 'silent-live', summary: 'Added OLED output comments.' }),
    'Hy3 assist updated the explanation: Added OLED output comments.'
  );
  assert.equal(getHeroSubtitle(), 'Build ESP32 projects visually. Get a deterministic wiring-safe sketch, then use Hy3 for explanation and refinement.');
  assert.equal(getHeroTagline(), 'Deterministic core build + optional Hy3 assist');
  assert.equal(getAssistantLabel(), 'Chat with Hy3 assist');
});

test('fallback sketch placeholder keeps deterministic build primary', () => {
  const { generateFallbackCode } = require('../fallback.js');
  const result = generateFallbackCode('devkit', [], { boardLabel: 'ESP32 DevKit', assignments: {}, bus: {} }, []);
  assert.match(result.code, /TODO: add your app behavior here\. Hy3 can still help explain or refine it later/);
});
