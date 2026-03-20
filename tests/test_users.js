const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUsers, saveUser, getUser, incrementViewCount } = require('../lib/users');

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

  it('saveUser initializes view_count to 0', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'aries', birthday: '1990-03-25' });
    const data = JSON.parse(fs.readFileSync(TEST_PATH, 'utf8'));
    assert.equal(data['U123'].view_count, 0);
  });

  it('incrementViewCount increments from 0 to 1', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'aries', birthday: null });
    const result = incrementViewCount(TEST_PATH, 'U123');
    assert.equal(result, 1);
    const user = getUser(TEST_PATH, 'U123');
    assert.equal(user.view_count, 1);
  });

  it('incrementViewCount increments multiple times', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'aries', birthday: null });
    incrementViewCount(TEST_PATH, 'U123');
    incrementViewCount(TEST_PATH, 'U123');
    const result = incrementViewCount(TEST_PATH, 'U123');
    assert.equal(result, 3);
  });

  it('incrementViewCount handles legacy user without view_count', () => {
    // Write a legacy user directly (no view_count field)
    fs.writeFileSync(TEST_PATH, JSON.stringify({ 'U_LEGACY': { sign: 'leo', birthday: null, registered_at: '2024-01-01T00:00:00.000Z' } }, null, 2), 'utf8');
    const result = incrementViewCount(TEST_PATH, 'U_LEGACY');
    assert.equal(result, 1);
  });

  it('incrementViewCount returns -1 for unknown user', () => {
    const result = incrementViewCount(TEST_PATH, 'NO_SUCH_USER');
    assert.equal(result, -1);
  });
});
