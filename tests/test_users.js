const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUsers, saveUser, getUser } = require('../lib/users');

const TEST_PATH = path.join(__dirname, 'tmp_users.json');

describe('users', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_PATH)) fs.unlinkSync(TEST_PATH);
  });

  after(() => {
    if (fs.existsSync(TEST_PATH)) fs.unlinkSync(TEST_PATH);
  });

  it('loadUsers returns empty object when file does not exist', () => {
    const users = loadUsers(TEST_PATH);
    assert.deepEqual(users, {});
  });

  it('saveUser creates file and saves user', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'aries', birthday: '1990-03-25' });
    const data = JSON.parse(fs.readFileSync(TEST_PATH, 'utf8'));
    assert.equal(data['U123'].sign, 'aries');
    assert.equal(data['U123'].birthday, '1990-03-25');
    assert.ok(data['U123'].registered_at);
  });

  it('saveUser appends to existing users', () => {
    saveUser(TEST_PATH, 'U001', { sign: 'aries', birthday: null });
    saveUser(TEST_PATH, 'U002', { sign: 'taurus', birthday: null });
    const data = loadUsers(TEST_PATH);
    assert.equal(Object.keys(data).length, 2);
  });

  it('getUser returns user data', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'scorpio', birthday: '1990-10-23' });
    const user = getUser(TEST_PATH, 'U123');
    assert.equal(user.sign, 'scorpio');
  });

  it('getUser returns null for unknown user', () => {
    const user = getUser(TEST_PATH, 'UNKNOWN');
    assert.equal(user, null);
  });
});
