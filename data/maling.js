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
export const ADS_ID = '';
export const ADS_LABEL = '';
