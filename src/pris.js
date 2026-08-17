/* ===========================================================================
   Serverside prisberegning – fasiten for hva en booking koster.

   Nettleseren sender hva som er valgt, aldri hva det koster. All summering
   skjer her, med de samme funksjonene som bygger prisene på nettsiden, slik
   at tallet kunden ser og tallet vi tar betalt for kommer fra samme kilde.

   Grunnen er Vipps. Skulle serveren tro på summen klienten oppgir, kunne
   hvem som helst åpne utviklerverktøyet og reservere et 5×10-telt for én
   krone. Så lenge forespørselen bare ble til en e-post du leste gjennom,
   var det ufarlig – du ville sett at noe var rart. Et beløp som går rett
   til trekk i Vipps, ser ingen over.

   Faller adressen utenfor de faste sonene, avvises bookingen. Levering dit
   er ikke en tjeneste vi tilbyr – ikke noe som prises i etterkant. Kunden
   henvises til forespørselsskjemaet, som er en helt annen flyt uten
   betaling. Alternativet ville vært å ta imot penger for en booking der
   totalsummen ennå ikke fantes.
   ======================================================================== */

import { PRODUKTER, SONER, enhetspris } from '../data/produkter.js';
import { soneForKommune } from '../data/kommuner.js';
import { gyldigTid } from '../data/apningstid.js';

const MAKS_LINJER = 60;      // flere varelinjer enn dette er ikke en ekte booking
const MAKS_ANTALL = 99;      // per varelinje
const MAKS_DAGER = 365;

/**
 * Sjekker at bookingdetaljene faktisk kan gjennomføres. Kalles bare når det
 * skal tas betalt – en forespørsel kan godt være løs i kantene, men en
 * reservasjon som er betalt må ha dato og klokkeslett vi kan møte opp på.
 *
 * @returns { ok: true } eller { ok: false, feil }
 */
export function sjekkBooking({ fra, til, hentetid, returtid, modus, adresse }) {
  if (!fra || !til) return { ok: false, feil: 'Velg datoer for leieperioden.' };
  const d = antallDager(fra, til);
  if (!d.har) return { ok: false, feil: 'Returdatoen må være etter hentedatoen.' };

  // Alle tidspunkt mellom 07 og 22 er lov, hver dag. Er lageret ubemannet,
  // er henting og tilbakelevering selvbetjent – ikke umulig.
  if (!gyldigTid(fra, hentetid)) return { ok: false, feil: 'Velg et tidspunkt for henting.' };
  if (!gyldigTid(til, returtid)) return { ok: false, feil: 'Velg et tidspunkt for tilbakelevering.' };

  if (modus === 'lev' && !adresse) {
    return { ok: false, feil: 'Velg leveringsadressen fra listen.' };
  }
  return { ok: true };
}

/** Antall leiedøgn mellom to ISO-datoer. Samme regnestykke som i nettleseren. */
function antallDager(fra, til) {
  const t1 = Date.parse(fra), t2 = Date.parse(til);
  if (isNaN(t1) || isNaN(t2) || t2 < t1) return { har: false, n: 1 };
  const n = Math.max(1, Math.round((t2 - t1) / 86400000));
  return { har: true, n: Math.min(n, MAKS_DAGER) };
}

/**
 * Regner ut hva bookingen koster ut fra det klienten har valgt.
 *
 * @param linjer   [{ id, antall }] – produkt-id-er fra data/produkter.js
 * @param fra,til  ISO-datoer, «2026-07-04»
 * @param modus    'lev' for utkjøring, alt annet regnes som henting
 * @param kommune  kommunenavn fra adressesøket, avgjør fraktsonen
 *
 * @returns { ok, feil?, utenforSone?, varer, leie, frakt, total, dager,
 *            dagerLabel, sonenavn }
 */
export function regnUt({ linjer, fra, til, modus, kommune }) {
  if (!Array.isArray(linjer) || !linjer.length) {
    return { ok: false, feil: 'Handlekurven er tom.' };
  }
  if (linjer.length > MAKS_LINJER) {
    return { ok: false, feil: 'For mange varelinjer.' };
  }

  const d = antallDager(fra, til);

  /* --- varelinjene --- */
  const varer = [];
  for (const l of linjer) {
    const p = PRODUKTER.find(x => x.id === l?.id);
    if (!p) return { ok: false, feil: 'Ukjent produkt i handlekurven.' };

    const antall = Math.floor(Number(l.antall));
    if (!Number.isFinite(antall) || antall < 1 || antall > MAKS_ANTALL) {
      return { ok: false, feil: `Ugyldig antall for ${p.navn}.` };
    }
    if (varer.some(v => v.id === p.id)) {
      return { ok: false, feil: 'Samme produkt står flere ganger.' };
    }

    const enhet = enhetspris(p, d.n);
    varer.push({ id: p.id, navn: p.navn, antall, enhet, fast: !!p.fast,
                 sum: antall * enhet });
  }

  const leie = varer.reduce((a, v) => a + v.sum, 0);

  /* --- frakt --- */
  let frakt = 0, sonenavn = '';
  if (modus === 'lev') {
    const nr = soneForKommune(kommune);
    if (!nr || !SONER[nr - 1]) {
      // Utenfor sonene er levering ikke en tjeneste vi tilbyr. Den skal
      // ikke prises senere heller – da måtte kunden betalt for en booking
      // med ukjent totalsum. De henvises til forespørselsskjemaet.
      return { ok: false, feil: 'Vi kjører ikke ut hit. Hent selv i Halden, eller send en forespørsel.',
               utenforSone: true };
    }
    frakt = SONER[nr - 1].pris;
    sonenavn = SONER[nr - 1].navn;
  }

  return {
    ok: true,
    varer, leie, frakt,
    total: leie + frakt,
    dager: d.n,
    dagerLabel: d.har ? (d.n === 1 ? '1 døgn' : `${d.n} dager`) : '1–4 dager',
    sonenavn
  };
}
