/* ===========================================================================
   Adressesøk med autofullføring mot Kartverket.

   Gjør et vanlig tekstfelt om til en søkeboks med forslagsliste. Kunden
   velger en reell adresse, og vi får postnummer, poststed og koordinater
   tilbake – langt mer pålitelig enn å tolke fritekst.

   Bruk:
     lagAdressesok(feltet, (valgt) => { ... });
   Tilbakekallet får { tekst, postnr, poststed, kommune, lat, lon }, eller
   null når kunden tømmer feltet eller skriver noe uten å velge.
   ======================================================================== */

const MIN_TEGN = 3;
const VENT_MS = 220;          // hvor lenge vi venter etter siste tastetrykk

export function lagAdressesok(felt, naarValgt) {
  if (!felt) return;

  const boks = document.createElement('div');
  boks.className = 'adr-boks';
  felt.parentNode.insertBefore(boks, felt);
  boks.appendChild(felt);

  const liste = document.createElement('ul');
  liste.className = 'adr-liste';
  liste.setAttribute('role', 'listbox');
  liste.hidden = true;
  boks.appendChild(liste);

  felt.setAttribute('role', 'combobox');
  felt.setAttribute('aria-autocomplete', 'list');
  felt.setAttribute('aria-expanded', 'false');
  felt.setAttribute('autocomplete', 'off');
  felt.removeAttribute('list');          // datalist er ikke lenger i bruk

  let treff = [], aktiv = -1, tidsavbrudd, sisteSok = '';

  const lukk = () => {
    liste.hidden = true;
    felt.setAttribute('aria-expanded', 'false');
    aktiv = -1;
  };

  const tegn = () => {
    if (!treff.length) { lukk(); return; }
    liste.innerHTML = treff.map((a, i) => `
      <li role="option" data-i="${i}" class="${i === aktiv ? 'aktiv' : ''}" aria-selected="${i === aktiv}">
        <span class="adr-gate">${esc(a.tekst)}</span>
        <span class="adr-sted">${esc(a.postnr)} ${esc(a.poststed)}</span>
      </li>`).join('');
    liste.hidden = false;
    felt.setAttribute('aria-expanded', 'true');
  };

  const velg = (i) => {
    const a = treff[i];
    if (!a) return;
    felt.value = `${a.tekst}, ${a.postnr} ${a.poststed}`;
    lukk();
    naarValgt(a);
  };

  const sok = async (q) => {
    if (q.length < MIN_TEGN) { treff = []; lukk(); return; }
    try {
      const r = await fetch('/api/adresse?sok=' + encodeURIComponent(q));
      if (!r.ok) throw new Error();
      const d = await r.json();
      // Et eldre svar kan komme etter et nyere – ignorer det da
      if (q !== sisteSok) return;
      treff = d.adresser || [];
      aktiv = -1;
      tegn();
    } catch {
      treff = [];
      lukk();
    }
  };

  felt.addEventListener('input', () => {
    const q = felt.value.trim();
    sisteSok = q;
    naarValgt(null);                     // valget er ikke lenger gyldig
    clearTimeout(tidsavbrudd);
    tidsavbrudd = setTimeout(() => sok(q), VENT_MS);
  });

  felt.addEventListener('keydown', (e) => {
    if (liste.hidden || !treff.length) return;
    if (e.key === 'ArrowDown') { aktiv = (aktiv + 1) % treff.length; tegn(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { aktiv = (aktiv - 1 + treff.length) % treff.length; tegn(); e.preventDefault(); }
    else if (e.key === 'Enter' && aktiv >= 0) { velg(aktiv); e.preventDefault(); }
    else if (e.key === 'Escape') { lukk(); }
  });

  liste.addEventListener('mousedown', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) { e.preventDefault(); velg(Number(li.dataset.i)); }
  });

  felt.addEventListener('blur', () => setTimeout(lukk, 120));

  document.addEventListener('click', (e) => { if (!boks.contains(e.target)) lukk(); });
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
