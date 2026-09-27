const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
];

const TENS: Record<number, string> = {
  2: 'vingt',
  3: 'trente',
  4: 'quarante',
  5: 'cinquante',
  6: 'soixante',
};

/** `plural` : « vingts » / « cents » ne prennent un s qu'en fin de nombre (ou devant million/milliard). */
function below100(n: number, plural: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens < 7) {
    const base = TENS[tens];
    if (unit === 0) return base;
    if (unit === 1) return `${base}-et-un`;
    return `${base}-${UNITS[unit]}`;
  }
  if (tens === 7) {
    if (unit === 1) return 'soixante-et-onze';
    return `soixante-${below100(10 + unit, false)}`;
  }
  if (n === 80) return plural ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${below100(n - 80, false)}`;
}

function below1000(n: number, plural: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (hundreds > 0) {
    out = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent${rest === 0 && plural ? 's' : ''}`;
  }
  if (rest > 0) out += `${out ? ' ' : ''}${below100(rest, plural)}`;
  return out;
}

/** Nombre entier en toutes lettres (orthographe traditionnelle). */
export function numberToFrenchWords(value: number): string {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const scales: Array<[number, string]> = [
    [1_000_000_000, 'milliard'],
    [1_000_000, 'million'],
  ];
  for (const [scale, name] of scales) {
    const q = Math.floor(n / scale);
    if (q > 0) {
      const words = q < 1000 ? below1000(q, true) : numberToFrenchWords(q);
      parts.push(`${words} ${name}${q > 1 ? 's' : ''}`);
      n %= scale;
    }
  }
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`);
    n %= 1000;
  }
  if (n > 0) parts.push(below1000(n, true));
  return parts.join(' ');
}

export function amountInWordsGnf(amount: number): string {
  const words = numberToFrenchWords(Math.round(amount));
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} francs guinéens`;
}
