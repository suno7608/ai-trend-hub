/**
 * Regression test for the Monthly Deep Dive truncation bug.
 *
 * The 2026-07-01 and 2026-08-01 pipeline runs both died with
 * `SyntaxError: Expected ',' or ']' after array element in JSON at position N`,
 * where N always landed just under the stage's own max_tokens budget: Claude's
 * bilingual (KO+EN) JSON hit the cap and was cut mid-array. Retrying with the
 * same budget reproduced the same truncation three times in a row.
 */

const test = require('node:test');
const assert = require('node:assert');

const { callClaude } = require('../monthly/pipeline');

// A response cut off mid-array, exactly as a max_tokens stop produces.
const TRUNCATED = '{"meta_narrative_ko":"에이전틱 커머스가","reinforcing_pairs":[{"theme_a":"T1"}';
const COMPLETE = '{"meta_narrative_ko":"에이전틱 커머스가","reinforcing_pairs":[]}';

function stubClient(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        const r = responses[Math.min(calls.length - 1, responses.length - 1)];
        return { content: [{ text: r.text }], stop_reason: r.stop_reason, usage: { output_tokens: 6000 } };
      }
    }
  };
}

test('truncated response reports max_tokens truncation, not a raw JSON SyntaxError', async () => {
  const client = stubClient([{ text: TRUNCATED, stop_reason: 'max_tokens' }]);
  await assert.rejects(
    () => callClaude(client, 'sys', 'user', 6000, 'Stage4'),
    (err) => {
      assert.match(err.message, /truncated at max_tokens/i,
        `expected a truncation error, got: ${err.message}`);
      return true;
    }
  );
});

test('retry after truncation escalates max_tokens instead of repeating the same budget', async () => {
  const client = stubClient([
    { text: TRUNCATED, stop_reason: 'max_tokens' },
    { text: COMPLETE, stop_reason: 'end_turn' }
  ]);
  const result = await callClaude(client, 'sys', 'user', 6000, 'Stage4');
  assert.deepStrictEqual(result.reinforcing_pairs, []);
  assert.strictEqual(client.calls.length, 2);
  assert.ok(client.calls[1].max_tokens > client.calls[0].max_tokens,
    `retry reused max_tokens=${client.calls[1].max_tokens}; truncation would just repeat`);
});

test('markdown code fences around the JSON are stripped', async () => {
  const client = stubClient([{ text: '```json\n' + COMPLETE + '\n```', stop_reason: 'end_turn' }]);
  const result = await callClaude(client, 'sys', 'user', 6000, 'Stage2');
  assert.strictEqual(result.meta_narrative_ko, '에이전틱 커머스가');
});
