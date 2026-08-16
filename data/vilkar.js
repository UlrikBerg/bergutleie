/* ===========================================================================
   Forretningsvilkår som står flere steder samtidig.

   Forskuddsandelen dukker opp fire steder: leievilkårene på nettsiden,
   bekreftelsesmalen i e-posten, PDF-bilaget og – når den kommer – Vipps.
   Står tallet hardkodet fire steder, blir ett av dem glemt ved neste
   endring. Derfor står det her, og de andre regner seg fram.

   MERK at resten alltid er (1 − andelen). Skriver du «resterende 50 %» i
   en tekst, blir den feil i det andelen endres. Bruk RESTANDEL.
   ======================================================================== */

/** Andel av totalen som betales som forskudd for å reservere utstyret.
    Holdes lav med vilje: forskuddet går gjennom Vipps, som tar gebyr av
    beløpet, mens resten faktureres uten gebyr. */
export const FORSKUDD_ANDEL = 0.25;

/** Det som faktureres etter at utstyret er levert tilbake. */
export const RESTANDEL = 1 - FORSKUDD_ANDEL;

/** Til bruk i tekst: 25, ikke 0.25. */
export const FORSKUDD_PROSENT = Math.round(FORSKUDD_ANDEL * 100);
export const REST_PROSENT = 100 - FORSKUDD_PROSENT;

/* ---------------------------------------------------------------------------
   Er Vipps i drift?

   Leievilkårene beskriver to ulike flyter: en der kunden betaler forskuddet
   i handlekurven, og en der det faktureres etterpå. Hvilken som er sann,
   avhenger av om Vipps-nøklene er satt i Cloudflare.

   Byggeskriptet kan ikke vite det – nøklene er Worker-hemmeligheter, og
   sidene bygges før Worker-en kjører. Derfor denne bryteren.

   Står den `false`, beskriver vilkårene fakturaflyten, som er det som
   faktisk skjer. Sier vilkårene at man betaler i kassa før kassen finnes,
   er vi verre stilt enn å si ingenting.

   NÅR DU SETTER NØKLENE: sett denne til `true` og push i samme slengen.
   Se VIPPS.md.
   ------------------------------------------------------------------------ */
export const VIPPS_I_DRIFT = false;
