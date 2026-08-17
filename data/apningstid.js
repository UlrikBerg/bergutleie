/* ===========================================================================
   Åpningstider på lageret, og tidspunktene kunden kan velge.

   Står ett sted fordi de dukker opp fem: teksten på forsiden, FAQ-en,
   nedtrekkslistene i kassen, valideringen på serveren, og bekreftelsen
   som sendes ut.

   MERK skillet mellom BETJENT og SELVBETJENT: kunden kan velge hvilket
   som helst tidspunkt mellom 07 og 22, hver dag. Er lageret bemannet, tar
   vi imot. Ellers er henting og tilbakelevering selvbetjent. Det er hele
   poenget med Berg Utleie – å ikke være bundet av en skranke.

   Lørdag er ubemannet hele dagen, men ikke stengt.
   ======================================================================== */

/** Tidsrommet kunden kan velge innenfor, uansett dag. */
export const DAGEN = { fra: 7, til: 22 };

/** 0 = søndag, 1 = mandag … 6 = lørdag. null = ubemannet hele dagen. */
export const BETJENT = [
  { fra: 12, til: 15 },   // søndag
  { fra: 9,  til: 18 },   // mandag
  { fra: 9,  til: 18 },   // tirsdag
  { fra: 9,  til: 18 },   // onsdag
  { fra: 9,  til: 18 },   // torsdag
  { fra: 9,  til: 18 },   // fredag
  null                    // lørdag
];

export const APNINGSTID_TEKST = 'Betjent man–fre 09–18 og søndag 12–15 · ellers selvbetjent';

const UKEDAGER = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const MANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
                 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/**
 * Alle tidspunkt kunden kan velge for en dato.
 * @returns [{ tid: '14:00', betjent: true }]
 */
export function tiderFor(iso) {
  if (ukedag(iso) === null) return [];
  const ut = [];
  for (let t = DAGEN.fra; t <= DAGEN.til; t++) {
    const tid = String(t).padStart(2, '0') + ':00';
    ut.push({ tid, betjent: erBetjent(iso, tid) });
  }
  return ut;
}

/** Er lageret bemannet på dette tidspunktet? */
export function erBetjent(iso, tid) {
  const d = ukedag(iso);
  if (d === null) return false;
  const b = BETJENT[d];
  if (!b) return false;
  const time = Number(String(tid).slice(0, 2));
  return Number.isFinite(time) && time >= b.fra && time < b.til;
}

/** Kan kunden velge dette tidspunktet i det hele tatt? */
export function gyldigTid(iso, tid) {
  if (ukedag(iso) === null) return false;
  if (!/^\d{2}:00$/.test(String(tid))) return false;
  const time = Number(String(tid).slice(0, 2));
  return time >= DAGEN.fra && time <= DAGEN.til;
}

/** «torsdag 20. august» – til bruk over tidspunktvelgerne. */
export function dagNavn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = ukedag(iso);
  return `${UKEDAGER[d]} ${Number(m[3])}. ${MANEDER[Number(m[2]) - 1]}`;
}

/** Ukedag 0–6 for en ISO-dato, eller null hvis datoen er ugyldig.
    Bruker UTC med vilje: «2026-08-20» skal bety den datoen uansett hvilken
    tidssone nettleseren eller serveren står i. */
function ukedag(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}
