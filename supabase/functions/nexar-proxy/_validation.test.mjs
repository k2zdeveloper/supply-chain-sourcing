// Standalone test for the MPN validation logic from nexar-proxy/index.ts
// Run: node _validation.test.mjs
// This is NOT a deployed file — Supabase ignores files starting with `_`.

const MPN_REGEX = /^[A-Z0-9][A-Z0-9\-\/\._]{1,49}$/i;
const MAX_MPNS_PER_REQUEST = 100;

function validateMpnList(input, max) {
  if (!Array.isArray(input)) throw new Error("Payload 'mpns' must be an array.");
  if (input.length === 0) throw new Error("Payload 'mpns' cannot be empty.");
  if (input.length > max) {
    throw new Error(`Too many MPNs: ${input.length}. Max ${max} per request.`);
  }
  const cleaned = [];
  for (const raw of input) {
    if (typeof raw !== 'string') {
      throw new Error(`Invalid MPN type: expected string, got ${typeof raw}.`);
    }
    const trimmed = raw.trim();
    if (!MPN_REGEX.test(trimmed)) {
      throw new Error(`Invalid MPN format: "${raw}". Allowed: A-Z, 0-9, '-', '/', '.', '_', length 2-50.`);
    }
    cleaned.push(trimmed);
  }
  return cleaned;
}

// ---------- Test harness ----------
let passed = 0;
let failed = 0;

function shouldPass(name, input, expected) {
  try {
    const got = validateMpnList(input, MAX_MPNS_PER_REQUEST);
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (ok) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${name}\n     expected: ${JSON.stringify(expected)}\n     got:      ${JSON.stringify(got)}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ❌ FAIL: ${name} (threw unexpectedly)\n     error: ${e.message}`);
    failed++;
  }
}

function shouldReject(name, input, expectedErrorSubstring) {
  try {
    const got = validateMpnList(input, MAX_MPNS_PER_REQUEST);
    console.log(`  ❌ FAIL: ${name} (should have thrown, got ${JSON.stringify(got)})`);
    failed++;
  } catch (e) {
    if (e.message.includes(expectedErrorSubstring)) {
      console.log(`  ✅ PASS: ${name}  →  "${e.message}"`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${name}\n     expected error containing: "${expectedErrorSubstring}"\n     got:                       "${e.message}"`);
      failed++;
    }
  }
}

// ---------- Tests ----------
console.log('\n=== Valid input tests ===');
shouldPass(
  'Single valid MPN',
  ['ATMEGA328P-PU'],
  ['ATMEGA328P-PU']
);
shouldPass(
  'Multiple valid MPNs',
  ['ATMEGA328P-PU', 'STM32F103C8T6', 'LM358N'],
  ['ATMEGA328P-PU', 'STM32F103C8T6', 'LM358N']
);
shouldPass(
  'Trims whitespace',
  ['  ATMEGA328P-PU  ', '\tSTM32F103\n'],
  ['ATMEGA328P-PU', 'STM32F103']
);
shouldPass(
  'Allows slashes, dots, underscores',
  ['ABC/123', 'ABC.123', 'ABC_123', '1N4148'],
  ['ABC/123', 'ABC.123', 'ABC_123', '1N4148']
);
shouldPass(
  'Exactly 100 MPNs (at the limit)',
  Array.from({length: 100}, (_, i) => `PART-${i}`),
  Array.from({length: 100}, (_, i) => `PART-${i}`)
);
shouldPass(
  'Mixed case preserved',
  ['atmega328p', 'AbC123'],
  ['atmega328p', 'AbC123']
);

console.log('\n=== Attack: too many MPNs ===');
shouldReject(
  '101 MPNs rejected',
  Array.from({length: 101}, (_, i) => `PART-${i}`),
  'Too many MPNs'
);
shouldReject(
  '10000 MPN flood attack',
  Array.from({length: 10000}, (_, i) => `PART-${i}`),
  'Too many MPNs'
);

console.log('\n=== Attack: malformed payloads ===');
shouldReject('Empty array', [], 'cannot be empty');
shouldReject('Not an array (object)', { mpn: 'X' }, 'must be an array');
shouldReject('Not an array (string)', 'ATMEGA328', 'must be an array');
shouldReject('Not an array (null)', null, 'must be an array');
shouldReject('Not an array (undefined)', undefined, 'must be an array');

console.log('\n=== Attack: invalid MPN values ===');
shouldReject('Number instead of string', [123], 'Invalid MPN type');
shouldReject('Null inside array', [null], 'Invalid MPN type');
shouldReject('Empty string', [''], 'Invalid MPN format');
shouldReject('Single char (too short)', ['A'], 'Invalid MPN format');
shouldReject('SQL injection attempt', ["' OR 1=1 --"], 'Invalid MPN format');
shouldReject('XSS attempt', ['<script>alert(1)</script>'], 'Invalid MPN format');
shouldReject('Spaces in middle', ['ATMEGA 328'], 'Invalid MPN format');
shouldReject('Starts with dash', ['-ATMEGA328'], 'Invalid MPN format');
shouldReject('Special chars (! @ #)', ['ATMEGA@328'], 'Invalid MPN format');
shouldReject('Newline injection', ['ATMEGA\n328'], 'Invalid MPN format');
shouldReject(
  '51-char string (over length limit)',
  ['A' + 'B'.repeat(50)],
  'Invalid MPN format'
);

console.log('\n=== Summary ===');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
