const STOP_WORDS = [
  'ідіот',
  'дурак',
  'дурень',
  'тупиця',
  'тупий',
  'кретин',
  'довбойоб',
  'дебіл',
  'мудак',
  'придурок',
  'ідиот',
  'сволоч',
  'падла',
  'сука',
  'блядь',
  'бляд',
  'хуй',
  'хуйня',
  'пизда',
  'піздец',
  'єбан',
  'ебан',
  'мразь',
  'шлюха',
  'лохотрон',
  'шахрай',
  'аферист',
  'розвод',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'idiot',
  'scam',
];

function containsStopWords(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const normalized = text.toLowerCase();
  return STOP_WORDS.some((word) => normalized.includes(word));
}

module.exports = { containsStopWords, STOP_WORDS };
