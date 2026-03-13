/**
 * social-language.constants.ts
 *
 * Forbidden word lists for social locale variants.
 *
 * These are Real Money Game (RMG) terms that must NOT appear in:
 *   en_so — Social English
 *   es_so — Social Spanish
 *   de_so — Social German
 *
 * Sources:
 *   - "Social Language Rules EN ES" (12/8/2025)
 *   - "Social German Rules"
 *
 * Each entry contains:
 *   word       — the forbidden term (matched with word-boundary regex, case-insensitive)
 *   suggestion — the approved social alternative from the rules document
 */

export interface ForbiddenEntry {
  word:       string;
  suggestion: string;
}

// ── Social English (en_so) ────────────────────────────────────────────────────

export const FORBIDDEN_EN_SO: ForbiddenEntry[] = [
  { word: 'buy bonus',      suggestion: 'get/play bonus, play feature' },
  { word: 'buy feature',    suggestion: 'play feature' },
  { word: 'total bet',      suggestion: 'total spin / total play' },
  { word: 'max bet',        suggestion: 'max spin / max play' },
  { word: 'betting',        suggestion: 'spinning' },
  { word: 'paytable',       suggestion: 'award table' },
  { word: 'pays out',       suggestion: 'awards / wins' },
  { word: 'paid out',       suggestion: 'awarded' },
  { word: 'payout',         suggestion: 'award / reward' },
  { word: 'paying',         suggestion: 'winning' },
  { word: 'payer',          suggestion: 'winner' },
  { word: 'paid',           suggestion: 'awarded / won' },
  { word: 'pay',            suggestion: 'win' },
  { word: 'bets',           suggestion: 'spins' },
  { word: 'bet',            suggestion: 'spin / play' },
  { word: 'at the cost of', suggestion: 'for' },
  { word: 'worth',          suggestion: 'can be played for' },
  { word: 'gamble',         suggestion: 'take a chance' },
  { word: 'losing',         suggestion: 'non-winning / missed' },
  { word: 'purchase',       suggestion: 'play' },
  { word: 'buy',            suggestion: 'play' },
  { word: 'currency',       suggestion: 'coin type' },
  { word: 'credits',        suggestion: 'coins' },
  { word: 'funds',          suggestion: 'coins' },
  { word: 'money',          suggestion: 'coin(s)' },
  { word: 'cash',           suggestion: 'coins' },
  { word: 'stake',          suggestion: 'spin / play' },
];

// ── Social Spanish (es_so) ────────────────────────────────────────────────────

export const FORBIDDEN_ES_SO: ForbiddenEntry[] = [
  { word: 'comprar bono',         suggestion: 'conseguir/juega la bonificación' },
  { word: 'función de compra',    suggestion: 'juega la función' },
  { word: 'comprar función',      suggestion: 'juega la función' },
  { word: 'apuesta total',        suggestion: 'giro / juego' },
  { word: 'apuesta máxima',       suggestion: 'max juego' },
  { word: 'apostando',            suggestion: 'girante' },
  { word: 'apuestas',             suggestion: 'giras / montos en juego' },
  { word: 'apuesta',              suggestion: 'girar / jugar / monto en juego' },
  { word: 'pagando',              suggestion: 'ganando' },
  { word: 'pagador',              suggestion: 'ganador' },
  { word: 'pagado',               suggestion: 'premió / ganado' },
  { word: 'paga',                 suggestion: 'premia / gana' },
  { word: 'pago',                 suggestion: 'canjeo de premio' },
  { word: 'pagar',                suggestion: 'ganar' },
  { word: 'al costo de',          suggestion: 'por' },
  { word: 'costo de',             suggestion: 'se puede jugar por' },
  { word: 'valor',                suggestion: 'se puede jugar por' },
  { word: 'apostar',              suggestion: 'arriesgarse' },
  { word: 'giro perdedor',        suggestion: 'giro sin premio / giro sin acierto' },
  { word: 'compra',               suggestion: 'jugar' },
  { word: 'comprar',              suggestion: 'jugar' },
  { word: 'efectivo',             suggestion: 'monedas' },
  { word: 'dinero',               suggestion: 'moneda(s)' },
  { word: 'fondos',               suggestion: 'monedas' },
  { word: 'crédito',              suggestion: 'monedas' },
  { word: 'credito',              suggestion: 'monedas' },
];

// ── Social German (de_so) ─────────────────────────────────────────────────────

export const FORBIDDEN_DE_SO: ForbiddenEntry[] = [
  { word: 'bonus kaufen',         suggestion: 'Bonus erhalten/spielen, Feature spielen' },
  { word: 'feature kaufen',       suggestion: 'Feature spielen' },
  { word: 'auszahlungstabelle',   suggestion: 'Gewinntabelle' },
  { word: 'zahlt aus',            suggestion: 'Gewinne' },
  { word: 'ausgezahlt',           suggestion: 'Gewonnen' },
  { word: 'auszahlung',           suggestion: 'Gewinn / Belohnung' },
  { word: 'bezahlen',             suggestion: 'Gewinnen' },
  { word: 'zahlung',              suggestion: 'Gewinn' },
  { word: 'zahler',               suggestion: 'Gewinner' },
  { word: 'bezahlt',              suggestion: 'Gewonnen' },
  { word: 'gezahlt',              suggestion: 'Gewonnen' },
  { word: 'zahlen',               suggestion: 'Gewinnen' },
  { word: 'wetteinsatz',          suggestion: 'Einsatz' },
  { word: 'gesamtwette',          suggestion: 'Gesamteinsatz' },
  { word: 'maximalwette',         suggestion: 'Maximaleinsatz' },
  { word: 'wetten',               suggestion: 'Drehen' },
  { word: 'wette',                suggestion: 'Einsatz' },
  { word: 'bargeld',              suggestion: 'Münzen' },
  { word: 'geldmittel',           suggestion: 'Münzen' },
  { word: 'währung',              suggestion: 'Münztyp' },
  { word: 'guthaben',             suggestion: 'Münzen' },
  { word: 'einkauf',              suggestion: 'Spielen' },
  { word: 'kaufen',               suggestion: 'Spielen' },
  { word: 'kauf',                 suggestion: 'Spielen' },
  { word: 'zum preis von',        suggestion: 'Für' },
  { word: 'wert von',             suggestion: 'Kann gespielt werden für' },
  { word: 'kosten von',           suggestion: 'Kann gespielt werden für' },
  { word: 'glücksspiel',          suggestion: 'Versuchen Sie Ihr Glück' },
  { word: 'glucksspiel',          suggestion: 'Versuchen Sie Ihr Glück' },
  { word: 'verlierend',           suggestion: 'Nicht gewonnen (Spin) / verpasst (Spin)' },
  { word: 'verlust',              suggestion: 'Nicht gewonnen' },
];

// ── Lookup map ────────────────────────────────────────────────────────────────

export const FORBIDDEN_WORDS: Record<string, ForbiddenEntry[]> = {
  en_so: FORBIDDEN_EN_SO,
  es_so: FORBIDDEN_ES_SO,
  de_so: FORBIDDEN_DE_SO,
};

/**
 * Returns a case-insensitive word-boundary RegExp for a given phrase.
 * Multi-word phrases use flexible whitespace between words.
 * Accounts for special regex characters in the phrase.
 */
export function buildForbiddenRegex(phrase: string): RegExp {
  const escaped = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![\\w\\u00C0-\\u024F])${escaped}(?![\\w\\u00C0-\\u024F])`, 'i');
}

/**
 * Scan a single string value and return all forbidden entries that match.
 * ALL-CAPS values (e.g. jackpot tiers: GRAND, MAJOR) are skipped.
 */
export function findViolations(value: string, locale: string): ForbiddenEntry[] {
  // Skip ALL-CAPS values — these are brand/jackpot labels, not translated copy
  if (value === value.toUpperCase() && /[A-Z]/.test(value)) return [];

  const entries = FORBIDDEN_WORDS[locale] ?? [];
  return entries.filter(entry => buildForbiddenRegex(entry.word).test(value));
}
