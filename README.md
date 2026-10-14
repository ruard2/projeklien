# VOL-program

Webtoepassing vir **Verskynselgebaseerde Ondersoekende Leer (VOL)** by die Gereformeerde Hoërskool Dirk Postma.
Groepe vul hul werkboek aanlyn in, vra KI-terugvoer teen vaste kriteria, en onderwysers teken die ses kontrolepunte af.

## Wat dit doen

| Rol | Wat |
| --- | --- |
| **Leerdergroep** | Meld aan met ’n groepkode (geen persoonlike rekeninge nie). Vul werkblaaie in; alles stoor outomaties. Vra terugvoer so dikwels as nodig. Dien ’n kontrolepunt in sodra al sy werkblaaie “Gereed vir onderwyser” is. |
| **KI (OpenAI)** | Lees die oorspronklike werkboekopdrag, die huidige antwoord en die relevante vorige werkblaaie. Beoordeel elke kriterium as *behaal / gedeeltelik / nog nie*, wys teenstrydighede en ontbrekende bewyse uit, vra oop vrae en let op die vyf reëls. Skryf nooit antwoorde nie. |
| **Onderwyser** | Sien elke groep se werk, die KI-terugvoer en die weergawegeskiedenis. Teken af of stuur terug met kommentaar. Kan die KI oorheers (“verklaar gereed”) en ’n kontrolepunt heropen. |
| **Administrateur** | Projekte (uit werkboek-sjablone) en onderwysers bestuur. |

Reëls wat bediener-kant afgedwing word:
- Werkblaaie van kontrolepunt *n* gaan eers oop wanneer kontrolepunt *n–1* afgeteken is.
- Ingediende en afgetekende werkblaaie is gesluit.
- “Gereed” geld net vir die presiese weergawe wat beoordeel is (hash); enige verandering daarna vereis nuwe terugvoer.
- Gelyktydige wysigings deur twee groeplede word opgespoor (revisienommer) – niks word stilweg oorskryf nie.

### Privaatheid (POPIA)
- Groepe meld met kodes aan. Slegs voorname van lede word gestoor, en dit word **nooit** na die KI gestuur nie (vervang met “Lid 1”, …).
- E-posadresse, telefoon- en ID-nommers word uit teks verwyder voordat dit na die KI gaan.
- Foto’s word nooit na die KI gestuur nie; dit word in die blaaier verklein (wat ook GPS/EXIF verwyder) en vereis ’n toestemmingsbevestiging.

## Struktuur

```
app/                    Next.js (App Router)
  page.tsx              Aanmelding vir groepe
  groep/                Groep se werkboek, werkblaaie, drukweergawe
  onderwyser/           Aanmelding + (binne)/ dashboard, groepe, kriteria, bestuur
  api/                  Stoor, terugvoer, kontrolepunte, foto’s, gesondheid
components/             Werkbladvorm (alle veldtipes), redigeerder, terugvoerpaneel, …
lib/
  werkboeke/            Werkboek-sjablone as data
    vol-basis.ts        Die 15 werkblaaie, kriteria en 6 kontrolepunte
    sjablone.ts         Graad 8 (Natuurbewaring) en Graad 9 (Haweloosheid)
    toegang.ts          Wie mag wanneer wysig/indien
    volledigheid.ts     Deterministiese volledigheidstoets
    teks.ts             Omskakeling na teks + anonimisering vir die KI
  ki.ts                 OpenAI-terugvoer (gestruktureerde JSON-uitset)
  diens.ts              Besigheidslogika (stoor, terugvoer, indien, aftekening)
  sessie.ts             Ondertekende, staatlose sessie-koekies
  berging.ts            Foto’s: databasis of S3-bucket
prisma/schema.prisma    Skool → Projek → Groep → Response/Feedback/Checkpoint/Photo
scripts/                dev-db (plaaslike Postgres), seed, start
```

### ’n Nuwe werkboek byvoeg
Skep ’n nuwe sjabloon in `lib/werkboeke/sjablone.ts` (met `buildVolTemplate` of ’n eie `Template`), registreer dit in `TEMPLATES`, en skep dan ’n projek onder **Bestuur**. Verhoog `version` as kriteria verander.

## Plaaslik werk (sonder Docker)

```bash
npm install
cp .env.example .env        # vul SESSION_SECRET en SEED_ADMIN_PASSWORD in
npm run db                  # terminaal 1: plaaslike Postgres op poort 5439 (data in .pgdata/)
npx prisma migrate dev      # eerste keer
npm run seed                # skool, admin, Gr 8- en Gr 9-projekte (+ toetsgroepe as SEED_DEMO=1)
npm run dev                 # terminaal 2: http://localhost:3010
```

Sonder `OPENAI_API_KEY` loop die terugvoer in **toetsmodus** (alles “behaal”) sodat die vloei getoets kan word. Die verstekmodel is `gpt-5.4-mini` met `medium` denkvlak; albei kan met `OPENAI_MODEL` en `OPENAI_REASONING_EFFORT` verander word.

## Railway

1. Koppel die GitHub-repo aan ’n Railway-diens en voeg ’n **Postgres**-diens by.
2. Stel veranderlikes op die app-diens:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SESSION_SECRET` (lang ewekansige string), `OPENAI_API_KEY`, `OPENAI_MODEL`
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (slegs vir die eerste ontplooiing nodig)
   - Opsioneel `S3_*` vir foto’s in ’n bucket
3. `railway.json` doen die res: `npm ci && npm run build`, en by elke begin van die bediener `prisma migrate deploy` + seed (idempotent, in `scripts/start.mjs`), en gesondheidskontrole op `/api/health`.
4. Die publieke domein se *target port* moet gelyk wees aan die `PORT` wat in die logs gewys word.

### Skaal
- Geen toestand in die bediener se geheue nie: sessies is ondertekende koekies, tempo-beperking is in Postgres → Railway kan veelvuldige replikas laat loop.
- Foto’s skuif na ’n S3-versoenbare bucket deur net `S3_BUCKET` (+ sleutels) te stel.
- Multi-skool: elke skool het eie onderwysers en projekte; groepkodes is globaal uniek.
