const ZODIAC_SIGNS = [
  { id: 'aries',       name: '牡羊座',   startMonth: 3,  startDay: 21 },
  { id: 'taurus',      name: '牡牛座',   startMonth: 4,  startDay: 20 },
  { id: 'gemini',      name: '双子座',   startMonth: 5,  startDay: 21 },
  { id: 'cancer',      name: '蟹座',     startMonth: 6,  startDay: 22 },
  { id: 'leo',         name: '獅子座',   startMonth: 7,  startDay: 23 },
  { id: 'virgo',       name: '乙女座',   startMonth: 8,  startDay: 23 },
  { id: 'libra',       name: '天秤座',   startMonth: 9,  startDay: 23 },
  { id: 'scorpio',     name: '蠍座',     startMonth: 10, startDay: 23 },
  { id: 'sagittarius', name: '射手座',   startMonth: 11, startDay: 23 },
  { id: 'capricorn',   name: '山羊座',   startMonth: 12, startDay: 22 },
  { id: 'aquarius',    name: '水瓶座',   startMonth: 1,  startDay: 20 },
  { id: 'pisces',      name: '魚座',     startMonth: 2,  startDay: 19 },
];

function parseMonthDay(input) {
  // Accept: MM-DD, MM/DD, YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, M月D日
  let month, day;

  const jpMatch = input.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jpMatch) {
    month = parseInt(jpMatch[1], 10);
    day = parseInt(jpMatch[2], 10);
  } else {
    const cleaned = input.replace(/\//g, '-');
    const parts = cleaned.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    } else if (parts.length === 1 && parts[0].length === 8) {
      month = parseInt(parts[0].slice(4, 6), 10);
      day = parseInt(parts[0].slice(6, 8), 10);
    } else {
      throw new Error(`Invalid date format: ${input}`);
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid date: month=${month}, day=${day}`);
  }

  return { month, day };
}

function getZodiacSign(dateString) {
  const { month, day } = parseMonthDay(dateString);

  // Iterate signs in order. Each sign starts at (startMonth, startDay).
  // A date belongs to a sign if it's >= that sign's start and < next sign's start.
  // Special handling for Capricorn which wraps around the year boundary.
  for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
    const sign = ZODIAC_SIGNS[i];
    const next = ZODIAC_SIGNS[(i + 1) % ZODIAC_SIGNS.length];

    const afterStart = (month > sign.startMonth) ||
      (month === sign.startMonth && day >= sign.startDay);
    const beforeNext = (month < next.startMonth) ||
      (month === next.startMonth && day < next.startDay);

    // Normal case (no year wrap)
    if (sign.startMonth < next.startMonth) {
      if (afterStart && beforeNext) return { ...sign };
    } else {
      // Year-wrapping case (Capricorn: Dec 22 - Jan 19)
      if (afterStart || beforeNext) return { ...sign };
    }
  }

  throw new Error(`Could not determine zodiac sign for ${dateString}`);
}

function getZodiacSignFromBirthday(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid birthday: empty or not a string');
  }

  const trimmed = input.trim();
  if (!trimmed) throw new Error('Invalid birthday: empty string');

  // Extract year if present
  let year = null;
  let dateForSign;

  const jpMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jpMatch) {
    dateForSign = trimmed;
  } else {
    const cleaned = trimmed.replace(/\//g, '-');
    const parts = cleaned.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      year = parts[0];
      dateForSign = `${parts[1]}-${parts[2]}`;
    } else if (parts.length === 2) {
      dateForSign = trimmed;
    } else if (parts.length === 1 && parts[0].length === 8) {
      year = parts[0].slice(0, 4);
      dateForSign = `${parts[0].slice(4, 6)}-${parts[0].slice(6, 8)}`;
    } else {
      throw new Error(`Invalid birthday format: ${input}`);
    }
  }

  const sign = getZodiacSign(dateForSign);

  const { month, day } = parseMonthDay(dateForSign);
  const birthday = year
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;

  return { ...sign, birthday };
}

export { ZODIAC_SIGNS, getZodiacSign, getZodiacSignFromBirthday, parseMonthDay };
