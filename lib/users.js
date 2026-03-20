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
    view_count: 0,
  };
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
}

function getUser(filePath, userId) {
  const users = loadUsers(filePath);
  return users[userId] || null;
}

function incrementViewCount(filePath, userId) {
  const users = loadUsers(filePath);
  if (!users[userId]) return -1;
  // Handle legacy users saved before view_count was introduced
  const current = users[userId].view_count ?? 0;
  users[userId].view_count = current + 1;
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
  return users[userId].view_count;
}

module.exports = { loadUsers, saveUser, getUser, incrementViewCount };
