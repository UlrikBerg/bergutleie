/* Berg Utleie – priskalkulator
   Prisene leses fra data-attributtene i HTML-en, så prislisten har
   én kilde: markupen. Endrer du en pris i priskalkulator/index.html,
   følger kalkulatoren automatisk etter. */

(function () {
  'use strict';

  var STEDER = [
    { navn: 'Halden', km: 5 }, { navn: 'Svinesund', km: 12 }, { navn: 'Aremark', km: 22 },
    { navn: 'Sarpsborg', km: 30 }, { navn: 'Rakkestad', km: 38 }, { navn: 'Fredrikstad', km: 40 },
    { navn: 'Ørje', km: 42 }, { navn: 'Mysen', km: 48 }, { navn: 'Råde', km: 50 },
    { navn: 'Askim', km: 55 }, { navn: 'Moss', km: 62 }, { navn: 'Son', km: 72 },
    { navn: 'Vestby', km: 78 }, { navn: 'Ås', km: 90 }, { navn: 'Ski', km: 98 },
    { navn: 'Oslo', km: 115 }, { navn: 'Lillestrøm', km: 125 }, { navn: 'Sandvika', km: 135 },
    { navn: 'Asker', km: 142 }, { navn: 'Drammen', km: 155 }, { navn: 'Annet sted', km: -1 }
  ];

  var state = { periode: 'helg', modus: 'hent', sted: '' };

  var rader = Array.prototype.slice.call(document.querySelectorAll('.kalk-row'));
  if (!rader.length) return;

  var el = {
    stedFelt: document.getElementById('sted-felt'),
    sted: document.getElementById('sted'),
    soneNote: document.getElementById('sone-note'),
    periodeTag: document.getElementById('periode-tag'),
    leieSum: document.getElementById('leie-sum'),
    levSum: document.getElementById('lev-sum'),
    bilNote: document.getElementById('bil-note'),
    totalSum: document.getElementById('total-sum'),
    sendKnapp: document.getElementById('send-foresporsel')
  };

  function fmt(n) {
    return n.toLocaleString('nb-NO').replace(/ /g, ' ') + ' kr';
  }

  function sone(km) {
    if (km <= 25) return { pris: 990, navn: 'Sone 1 (0–25 km)' };
    if (km <= 50) return { pris: 1490, navn: 'Sone 2 (25–50 km)' };
    if (km <= 100) return { pris: 2290, navn: 'Sone 3 (50–100 km)' };
    if (km <= 150) return { pris: 2990, navn: 'Sone 4 (100–150 km)' };
    return null;
  }

  /* Fyll stedslisten */
  STEDER.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.navn;
    o.textContent = s.km < 0 ? s.navn : s.navn + ' · ca. ' + s.km + ' km';
    el.sted.appendChild(o);
  });

  /* Antall per rad */
  var antall = {};
  rader.forEach(function (rad) { antall[rad.dataset.id] = 0; });

  function prisFor(rad) {
    return parseFloat(state.periode === 'helg' ? rad.dataset.helg : rad.dataset.dogn);
  }

  function tegnRader() {
    rader.forEach(function (rad) {
      var d = parseFloat(rad.dataset.dogn);
      var h = parseFloat(rad.dataset.helg);
      var helg = state.periode === 'helg';
      rad.querySelector('.hoved').textContent = fmt(helg ? h : d) + (helg ? ' /helg' : ' /døgn');
      rad.querySelector('.alt').textContent = helg ? fmt(d) + ' /døgn' : fmt(h) + ' /helg';
      rad.querySelector('.val').textContent = antall[rad.dataset.id];
    });
  }

  function valgtUtstyr() {
    return rader.filter(function (rad) { return antall[rad.dataset.id] > 0; })
      .map(function (rad) {
        return antall[rad.dataset.id] + ' × ' + rad.querySelector('.navn').textContent;
      });
  }

  function beregn() {
    var leie = 0, lastplass = 0;
    rader.forEach(function (rad) {
      var q = antall[rad.dataset.id];
      leie += q * prisFor(rad);
      lastplass += q * parseFloat(rad.dataset.lp);
    });

    var stort = lastplass > 40;
    var levering = 0, levLabel = '0 kr', soneTekst = '', bilTekst = '', tilbud = false;

    if (state.modus === 'lev') {
      var sted = STEDER.filter(function (s) { return s.navn === state.sted; })[0];
      if (!sted) {
        levLabel = 'Velg sted';
      } else if (sted.km < 0) {
        tilbud = true;
        levLabel = 'Etter avtale';
        soneTekst = 'Utenfor faste soner – send forespørsel, så gir vi deg fast pris på levering.';
      } else {
        var z = sone(sted.km);
        if (!z) {
          tilbud = true;
          levLabel = 'Etter avtale';
          soneTekst = sted.navn + ' ligger over 150 km fra lageret – vi gir deg fast pris på forespørsel.';
        } else {
          levering = Math.round(z.pris * (stort ? 1.5 : 1) / 10) * 10;
          levLabel = fmt(levering);
          soneTekst = z.navn + ' · ca. ' + sted.km + ' km fra lageret. Levering og henting av Berg Event-ansatte er inkludert.';
          if (stort && leie > 0) bilTekst = 'Stort volum – kjøres med lastebil (+50 % på sonepris)';
        }
      }
    }

    var total = leie + levering;

    el.periodeTag.textContent = state.periode === 'helg' ? '(helg)' : '(døgn)';
    el.leieSum.textContent = fmt(leie);
    el.levSum.textContent = levLabel;
    el.totalSum.textContent = tilbud ? fmt(total) + ' + levering' : fmt(total);

    el.soneNote.textContent = soneTekst;
    el.soneNote.hidden = !soneTekst;
    el.bilNote.textContent = bilTekst;
    el.bilNote.hidden = !bilTekst;
    el.stedFelt.hidden = state.modus !== 'lev';

    oppdaterEpost(total, levLabel, tilbud);
  }

  /* Forhåndsutfylt e-post – midlertidig til vi har et skjema med backend */
  function oppdaterEpost(total, levLabel, tilbud) {
    var linjer = valgtUtstyr();
    var kropp = 'Hei Berg Utleie,\n\nJeg ønsker å leie følgende:\n\n';
    kropp += linjer.length ? linjer.join('\n') : '(ikke valgt utstyr ennå)';
    kropp += '\n\nLeieperiode: ' + (state.periode === 'helg' ? 'Helg (tor–man)' : 'Per døgn');
    kropp += '\nHenting/levering: ' + (state.modus === 'lev'
      ? 'Levering til ' + (state.sted || '(sted ikke valgt)') + ' – ' + levLabel
      : 'Jeg henter selv på lageret');
    kropp += '\nBeregnet total: ' + (tilbud ? fmt(total) + ' + levering' : fmt(total));
    kropp += '\n\nDato for arrangementet: \nNavn: \nTelefon: \nAdresse: \n\nMvh\n';

    el.sendKnapp.href = 'mailto:post@bergutleie.no'
      + '?subject=' + encodeURIComponent('Bestillingsforespørsel fra bergutleie.no')
      + '&body=' + encodeURIComponent(kropp);
  }

  /* Hendelser */
  rader.forEach(function (rad) {
    var id = rad.dataset.id;
    rad.querySelector('.inc').addEventListener('click', function () {
      antall[id]++;
      rad.querySelector('.val').textContent = antall[id];
      beregn();
    });
    rad.querySelector('.dec').addEventListener('click', function () {
      antall[id] = Math.max(0, antall[id] - 1);
      rad.querySelector('.val').textContent = antall[id];
      beregn();
    });
  });

  function koblSegment(id, nokkel, etter) {
    var knapper = Array.prototype.slice.call(document.querySelectorAll('#' + id + ' button'));
    knapper.forEach(function (b) {
      b.addEventListener('click', function () {
        state[nokkel] = b.dataset.val;
        knapper.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        if (etter) etter();
        beregn();
      });
    });
  }

  koblSegment('seg-periode', 'periode', tegnRader);
  koblSegment('seg-modus', 'modus');

  el.sted.addEventListener('change', function () {
    state.sted = el.sted.value;
    beregn();
  });

  tegnRader();
  beregn();
})();
