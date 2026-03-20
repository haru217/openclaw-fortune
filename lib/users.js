'use strict';

const fs = require('node:fs');

function loadUsers(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveUser(filePath, userId, { sign, birthday }) {
  const users = loadUsers(filePath);
  users[userId] = {
    sign,
    birthday: birthday || null,
    registered_at: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
}

function getUser(filePath, userId) {
  const users = loadUsers(filePath);
  return users[userId] || null;
}

module.exports = { loadUsers, saveUser, getUser };
