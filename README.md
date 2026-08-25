# Districo Pallet Flow

Lovable Masterprompt — Districo Retour (demo, 3 componenten)

Plak dit in één keer, of voer het in de 5 stappen onderaan (aanbevolen voor een stabiel resultaat).

Wat we bouwen

Eén web-applicatie met drie rolgebaseerde views op één gedeelde Supabase-backend. Geen drie aparte apps. Alle data wordt gedeeld via dezelfde database, zodat wat de magazijnier opslaat onmiddellijk zichtbaar is op het kantoor-dashboard.

Drie routes:

/klant — klantenportaal (laptop of telefoon)

/magazijn — magazijnier-app (telefoon, mobile-first)

/kantoor — Districo back-office dashboard (laptop)

Technologie

React + Supabase (Postgres database, Storage voor foto's, Realtime voor live updates)

QR-generatie met een standaard QR-library

QR-payload = volledige HTTPS-URL naar de palletpagina, zodat de telefooncamera de pallet direct opent

Foto's via de browsercamera (getUserMedia of <input type="file" capture>), geüpload naar Supabase Storage

Gedeployed op HTTPS (verplicht: de camera werkt niet op localhost via de telefoon)

Taal van de interface: Nederlands

Datamodel (Supabase-tabellen)

customers: id, naam, klantnummer, plaats

products: id, naam, categorie (bier / water / frisdrank), leeggoedwaarde_per_bak

pallet_types: id, naam

retours: id, retournummer (bv. RET-2026-00145), customer_id, status, created_at

pallets: id, palletnummer (bv. PAL-2026-3014-00001), retour_id, product_id, pallet_type_id, soort (vol / mixed), status, qr_payload, created_at

pallet_photos: id, pallet_id, storage_path, created_at

audit_events: id, pallet_id, type (aangemaakt / ontvangen / foto_toegevoegd / product_gewijzigd / pallettype_gewijzigd), actor, created_at

Statussen van een pallet: aangemaakt → klaar_voor_retour → ontvangen.

Seeddata

Klanten (pas gerust aan): Drinxit Kapellen (klantnr 3014), Drinxit Brasschaat (3015), Drankenhandel Swinnen (3145).

Producten met leeggoedwaarde per bak:

Bier: Jupiler (4,50), Maes (4,50), Vedett (6,00), Leffe (7,00), Liefmans (7,00)

Water: Spa Rood (6,00), Spa Blauw (6,00)

Frisdrank: Coca-Cola (6,35), Fanta (6,35)

Pallettypes: Europallet, CHEP, Wegwerppallet.

/klant — Klantenportaal

Bovenaan een dropdown "Kies klant" (vervangt login in de demo). De gekozen klant bepaalt naam en klantnummer.

Dashboard met een grote knop "Nieuwe retour".

Wizard "Nieuwe retour":

Stap 1: kies product uit een visueel raster, gegroepeerd per categorie (bier / water / frisdrank). Eventueel een zoekveld.

Stap 2: kies pallettype (Europallet standaard geselecteerd).

Stap 3: aantal pallets via een stepper (bv. 3).

"Toevoegen aan retour". Meerdere producten kunnen worden toegevoegd.

"Retour bevestigen" genereert een retournummer en N pallets. Elke pallet krijgt een uniek palletnummer en een qr_payload met de URL https://<app>/magazijn/pallet/{pallet_id}. Status van elke pallet wordt klaar_voor_retour. Schrijf een audit_event aangemaakt per pallet.

Daarna een knop "Print QR-codes": een printvriendelijke pagina met de N QR-codes, elk met het palletnummer en het product eronder. Eén QR per pallet, groot genoeg om af te drukken en op te kleven.

/magazijn — Magazijnier-app (telefoon, mobile-first, grote knoppen)

Startscherm met één grote knop "Scan pallet" (in-app scanner). Daarnaast werkt scannen met de gewone telefooncamera ook, want de QR bevat de directe URL naar de palletpagina.

Palletpagina (/magazijn/pallet/{id}):

Toon: klantnaam en klantnummer, retournummer, "Pallet X van Y", aangegeven product, aangegeven pallettype.

"Komt product overeen?" met knoppen Ja / Wijzigen. Bij Wijzigen: kies ander product, schrijf audit_event product_gewijzigd.

"Komt pallettype overeen?" met Ja / Wijzigen. Bij Wijzigen: audit_event pallettype_gewijzigd.

"Foto's toevoegen": open de camera, minimaal 2 foto's, upload naar Supabase Storage, toon thumbnails. Audit_event foto_toegevoegd.

"Ontvangst bevestigen": status wordt ontvangen, audit_event ontvangen met tijdstip.

Bevestigingsscherm, daarna terug naar "Scan pallet".

Ontwerp: weinig tekst, grote tikdoelen, één handeling per scherm. Doel is een pallet in onder de 20 seconden afhandelen.

/kantoor — Districo dashboard (laptop)

Overzichtskaarten bovenaan: aantal retours vandaag, aantal pallets ontvangen vandaag, aantal nog te ontvangen.

Realtime tabel met pallets: palletnummer, klant, product, pallettype, status, aantal foto's, tijdstip ontvangst. Nieuwe ontvangsten verschijnen automatisch via een Supabase realtime subscription, zonder verversen.

Klik op een pallet opent een detailpaneel: de foto's groot, de aangegeven versus bevestigde gegevens, de volledige audittrail, en de klantinfo.

Een filter of groepering per retour en per klant is mooi meegenomen.

Stijl

Clean en zakelijk, met een herkenbare Districo-blauwe accentkleur. Klantportaal: rustige wizard. Magazijn: mobile-first met grote knoppen. Kantoor: dashboard met kaarten, een tabel en fotothumbnails. Alles in het Nederlands.

Cruciaal voor de demo

De qr_payload is een volledige HTTPS-URL, niet alleen een palletnummer, zodat de telefooncamera de juiste pallet direct opent.

De camera (scannen en foto's) werkt alleen op HTTPS. Demo dus op de Lovable-URL, niet op localhost.

Geen echte authenticatie in de demo. De klantkeuze gebeurt via de dropdown.

"Doorsturen naar kantoor" is automatisch. Opslaan op de telefoon schrijft naar dezelfde database, en het kantoor-dashboard toont het realtime.

Aanbevolen invoervolgorde (5 stappen)

Maak de Supabase-tabellen en laad de seeddata.

Bouw /klant tot en met de printbare QR-pagina.

Bouw /magazijn (scan, product en pallettype bevestigen, foto's, ontvangst bevestigen).

Bouw /kantoor met realtime tabel en fotodetail.

Afwerking: stijl, overzichtskaarten, audittrail-weergave.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5661cb68-0ccd-42a9-9fd8-213945242301).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
