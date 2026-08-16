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

   Faller adressen utenfor de faste sonene, får bookingen `tilbudspris` og
   ingen total. Da kan den ikke betales på nett, bare svares på manuelt –
   for vi vet ikke hva utkjøringen koster ennå.
   ======================================================================== */

import { PRODUKTER, SONER, enhetspris } from '../data/produkter.js';
import { soneForKommune } from '../data/kommuner.js';

const MAKS_LINJER = 60;      // flere varelinjer enn dette er ikke en ekte booking
const MAKS_ANTALL = 99;      // per varelinje
const MAKS_DAGER = 365;

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
 * @returns { ok, feil?, varer, leie, frakt, total, dager, dagerLabel,
 *            tilbudspris, sonenavn }
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
  let frakt = 0, tilbudspris = false, sonenavn = '';
  if (modus === 'lev') {
    const nr = soneForKommune(kommune);
    if (nr && SONER[nr - 1]) {
      frakt = SONER[nr - 1].pris;
      sonenavn = SONER[nr - 1].navn;
    } else {
      // Kjent adresse utenfor sonene, eller ingen adresse valgt. Begge deler
      // betyr at prisen må settes for hånd.
      tilbudspris = true;
    }
  }

  return {
    ok: true,
    varer, leie, frakt,
    total: leie + frakt,
    dager: d.n,
    dagerLabel: d.har ? (d.n === 1 ? '1 døgn' : `${d.n} dager`) : '1–4 dager',
    tilbudspris, sonenavn
  };
}
