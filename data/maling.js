/* ===========================================================================
   ID-er for måling. Fyll inn når kontoene er satt opp.

   Står de tomme, lastes ingen sporing i det hele tatt – nettstedet kjører
   uten informasjonskapsler, og samtykkebanneret vises ikke.

   GA4_ID     Google Analytics 4, formen «G-XXXXXXXXXX».
              Analytics → Administrator → Datastrømmer → opprett strøm for
              bergutleie.no. Egen eiendom, ikke samme som Berg Event.

   ADS_ID     Google Ads-konverteringskonto, formen «AW-123456789».
              Ads → Mål → Konverteringer → ny handling → Nettsted.

   ADS_LABEL  Konverteringsetiketten som hører til handlingen, en kort
              streng som «AbC-D_efGhIjK». Står i tagg-oppsettet rett etter
              konto-ID-en: send_to: 'AW-123456789/AbC-D_efGhIjK'.
   ======================================================================== */

export const GA4_ID = 'G-H47JC9G245';
export const ADS_ID = 'AW-603503615';
export const ADS_LABEL = 'SLAqCNz23OIcEP_34p8C';

/* Egen konverteringshandling for BETALTE bookinger. Står den tom, brukes
   ADS_LABEL over, slik at betalinger måles som lead framfor ikke i det
   hele tatt.

   Lag den i Ads → Mål → Konverteringer → + → Nettsted → Google-tag:
     Kategori:  Kjøp
     Navn:      Berg Utleie – booking betalt
     Verdi:     Bruk ulike verdier
     Telling:   Én
   Den bør på sikt være PRIMÆR, og lead-handlingen sekundær – det er
   betalte bookinger Google skal by etter, ikke forespørsler. */
export const ADS_KJOP_LABEL = '';
