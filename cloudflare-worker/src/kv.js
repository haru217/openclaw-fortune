function dailyKey(date) {
  return `daily:${date}`;
}

function userKey(userId) {
  return `user:${userId}`;
}

function previousDate(dateString, daysBack) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

async function getDailyFortune(kv, date, options = {}) {
  const fallbackDays = Number.isInteger(options.fallbackDays) && options.fallbackDays > 0
    ? options.fallbackDays
    : 0;

  for (let offset = 0; offset <= fallbackDays; offset += 1) {
    const targetDate = offset === 0 ? date : previousDate(date, offset);
    const data = await kv.get(dailyKey(targetDate), { type: 'json' });
    if (data) {
      return data;
    }
  }

  return null;
}

async function saveDailyFortune(kv, date, data) {
  await kv.put(dailyKey(date), JSON.stringify(data));
}

async function getUser(kv, userId) {
  return kv.get(userKey(userId), { type: 'json' });
}

async function saveUser(kv, userId, { sign, birthday }) {
  const user = {
    sign,
    birthday,
    registered_at: new Date().toISOString(),
    view_count: 0,
  };

  await kv.put(userKey(userId), JSON.stringify(user));
  return user;
}

async function incrementViewCount(kv, userId) {
  const user = await getUser(kv, userId);
  if (!user) {
    return -1;
  }

  user.view_count = (user.view_count ?? 0) + 1;
  await kv.put(userKey(userId), JSON.stringify(user));
  return user.view_count;
}

export {
  dailyKey,
  userKey,
  getDailyFortune,
  saveDailyFortune,
  getUser,
  saveUser,
  incrementViewCount,
};
