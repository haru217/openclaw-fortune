'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { verifySignature, buildReplyBody } = require('../src/line.js');

describe('verifySignature', () => {
  const SECRET = 'test-channel-secret';

  it('returns true for valid signature', async () => {
    const body = '{"events":[]}';
    const crypto = require('node:crypto');
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
    const result = await verifySignature(body, expected, SECRET);
    assert.equal(result, true);
  });

  it('returns false for invalid signature', async () => {
    const body = '{"events":[]}';
    const result = await verifySignature(body, 'invalid-signature', SECRET);
    assert.equal(result, false);
  });

  it('returns false for tampered body', async () => {
    const body = '{"events":[]}';
    const crypto = require('node:crypto');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
    const result = await verifySignature('{"events":[{"type":"follow"}]}', sig, SECRET);
    assert.equal(result, false);
  });
});

describe('buildReplyBody', () => {
  it('builds correct JSON structure', () => {
    const result = buildReplyBody('token123', [{ type: 'text', text: 'hello' }]);
    assert.deepStrictEqual(result, {
      replyToken: 'token123',
      messages: [{ type: 'text', text: 'hello' }],
    });
  });
});
