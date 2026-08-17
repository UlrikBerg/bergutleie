/* ===========================================================================
   Åpningstider på lageret, og tidspunktene kunden kan velge.

   Står ett sted fordi de dukker opp fire: teksten på forsiden, FAQ-en,
   nedtrekkslistene i kassen, og valideringen på serveren. Endrer du dem
   her, følger alt annet med.

   MERK lørdag: lageret er stengt. Det er ikke en glipp – helgeleie hentes
   torsdag eller fredag og leveres tilbake mandag. Uten dette ville kunden
   kunne reservere og betale for en henting som ikke kan skje.
   ======================================================================== */

/** 0 = søndag, 1 = mandag … 6 = lørdag. null = stengt. */
export const APNINGSTID = [
  { fra: 12, til: 15 },   // søndag
  { fra: 9,  til: 18 },   // mandag
  { fra: 9,  til: 18 },   // tirsdag
  { fra: 9,  til: 18 },   // onsdag
  { fra: 9,  til: 18 },   // torsdag
  { fra: 9,  til: 18 },   // fredag
  null                    // lørdag – stengt
];

export const APNINGSTID_TEKST = 'Man–fre 09–18 · Søndag 12–15 · Lørdag stengt';

/**
 * Tidspunktene kunden kan velge for en gitt dato, som «09:00», «10:00» …
 * Tom liste betyr stengt den dagen.
 *
 * @param iso  «2026-08-20»
 */
export function tiderFor(iso) {
  const d = ukedag(iso);
  if (d === null) return [];
  const t = APNINGSTID[d];
  if (!t) return [];
  const ut = [];
  for (let time = t.fra; time <= t.til; time++) ut.push(String(time).padStart(2, '0') + ':00');
  return ut;
}

/** Er lageret stengt denne datoen? */
export function erStengt(iso) {
  const d = ukedag(iso);
  return d !== null && !APNINGSTID[d];
}

/** Ukedag 0–6 for en ISO-dato, eller null hvis datoen er ugyldig.
    Bruker UTC med vilje: «2026-08-20» skal bety den datoen uansett hvilken
    tidssone nettleseren eller serveren står i. */
function ukedag(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

/** Er tidspunktet «14:00» gyldig for denne datoen? */
export function gyldigTid(iso, tid) {
  return tiderFor(iso).includes(tid);
}
