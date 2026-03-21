'use strict';

const MASTER_NUMBERS = [11, 22, 33];

function reduceToSingle(num) {
  while (num > 9 && !MASTER_NUMBERS.includes(num)) {
    num = String(num).split('').reduce((sum, d) => sum + Number(d), 0);
  }
  return num;
}

function lifePathNumber(birthday) {
  const [y, m, d] = birthday.split('-').map(Number);
  const sumY = reduceToSingle(y);
  const sumM = reduceToSingle(m);
  const sumD = reduceToSingle(d);
  return reduceToSingle(sumY + sumM + sumD);
}

function personalYear(birthday, year) {
  const [, m, d] = birthday.split('-').map(Number);
  const sumY = reduceToSingle(year);
  const sumM = reduceToSingle(m);
  const sumD = reduceToSingle(d);
  return reduceToSingle(sumY + sumM + sumD);
}

function personalMonth(birthday, year, month) {
  const py = personalYear(birthday, year);
  return reduceToSingle(py + reduceToSingle(month));
}

module.exports = { lifePathNumber, personalYear, personalMonth, reduceToSingle };
