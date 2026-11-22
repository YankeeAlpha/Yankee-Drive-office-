# Yankee Office

Bezplatný kancelársky balík pre kanceláriu a firmu. Beží v prehliadači alebo ako aplikácia na vašom počítači.
Žiadne licencie, žiadna registrácia, funguje aj bez internetu. Pracuje so súbormi Word, Excel a PowerPoint
a vie ukladať na Google Drive.

## Aplikácie

| Aplikácia | Čo vie |
|---|---|
| **Yankee Text** (`writer.html`) | Formátovanie, nadpisy, písma, farby, zarovnanie, odrážky a číslovanie, tabuľky, obrázky, odkazy, nájsť a nahradiť, počítadlo slov. **Otvára .docx**, ukladá do **Word (.docx)**, HTML, TXT a PDF. |
| **Yankee Tabuľky** (`sheet.html`) | Viac hárkov, vzorce (`SUM`, `AVERAGE`, `IF`, `IFERROR`, `VLOOKUP`, `SUMIF`, `COUNTIF`, `ROUND`… aj slovensky `SÚČET`, `PRIEMER`, `KEĎ`), odkazy medzi hárkami (`Hárok2!A1`), `$A$1`, formáty (€, %, 0,00), tučné/farby/výplň/zarovnanie, zoradenie, Σ, kopírovanie z/do Excelu, späť/znova, až 5000 riadkov. **Grafy**: stĺpcový, pruhový, čiarový, plošný, koláčový (s popisom hodnôt a exportom do PNG). **Otvára .xlsx, .xls, .ods, .csv**, ukladá do **Excel (.xlsx)**, .ods, CSV a PDF. |
| **Yankee Prezentácie** (`slides.html`) | Snímky, 5 motívov, obrázky, poznámky rečníka, prezentácia na celú obrazovku (F5). Ukladá do **PowerPoint (.pptx)**, upraviteľného súboru `.yslides.json`, samostatného HTML a PDF. |

Úvodná stránka: zoznam dokumentov, otvorenie súboru z počítača (aj pretiahnutím myšou), Google Drive,
firemné šablóny (faktúra, obchodný list, zápisnica, rozpočet, dochádzka, prezentácia) a záloha všetkých dokumentov.

## Inštalácia na vlastný počítač

### Možnosť A – stiahnuť ZIP (odporúčané)
1. Na úvodnej stránke kliknite na **💻 Stiahnuť do PC** (alebo si stiahnite tento repozitár ako ZIP).
2. Rozbaľte ho, napríklad do priečinka *Dokumenty*.
3. Spustite:
   - **Windows:** dvojklik na `Spustit-Windows.bat`
   - **Mac:** dvojklik na `Spustit-Mac.command` (prvýkrát: pravý klik → Otvoriť)
   - **Linux:** `./spustit-linux.sh`
4. Otvorí sa prehliadač na adrese `http://localhost:8765`. Malý lokálny server beží len na vašom počítači
   a nikam sa nepripája. Kým s Yankee Office pracujete, nechajte okno spúšťača otvorené.

### Možnosť B – nainštalovať ako aplikáciu
V Chrome alebo Edge (cez spúšťač alebo webovú adresu https) kliknite na **⬇ Nainštalovať** na úvodnej stránke.
Yankee Office potom dostane vlastnú ikonu, otvára sa vo vlastnom okne a funguje offline.

### Možnosť C – bez spúšťača
Stačí otvoriť `index.html` dvojklikom (odporúčame Chrome alebo Edge). Google Drive a inštalácia ako aplikácia
fungujú len cez spúšťač alebo https. Firefox pri otvorení zo súboru ukladá dokumenty každej stránky zvlášť,
preto pre Firefox použite spúšťač.

### Pre celú firmu
Celý priečinok je statická webová stránka. Dá sa zverejniť na GitHub Pages, Netlify alebo firemnom serveri
bez backendu a databázy.

## Google Drive

Ukladanie a otváranie súborov na Google Disku sa nastavuje raz (zadarmo):

1. V [Google Cloud Console](https://console.cloud.google.com/) vytvorte projekt a zapnite **Google Drive API**
   (pre výber ľubovoľného súboru aj **Google Picker API**).
2. Nastavte **OAuth consent screen** (typ *External*, pridajte sa ako testovací používateľ).
3. Vytvorte **OAuth client ID** typu *Web application*. Do *Authorized JavaScript origins* pridajte adresu,
   z ktorej Yankee Office otvárate, napríklad `http://localhost:8765` alebo vašu https adresu.
4. V Yankee Office kliknite na **⚙ Nastaviť Google Drive** a vložte *Client ID*. Voliteľne pridajte aj *API kľúč*,
   ktorý umožní otvárať ľubovoľné súbory z Disku.

Aplikácia používa obmedzené oprávnenie `drive.file`. Vidí iba súbory, ktoré sama uložila alebo ktoré ste
v okne výberu sami zvolili. Dokumenty Google a Tabuľky Google sa pri otvorení prevedú na .docx/.xlsx a uložia
sa ako nová kópia.

## Kde sú moje dáta?

Dokumenty sa automaticky ukladajú do úložiska prehliadača na vašom počítači, pre každú adresu zvlášť
(webová verzia a stiahnutá verzia majú oddelené úložisko). Pravidelne si robte zálohu tlačidlom
**Zálohovať všetko**. Rovnako ňou presuniete dokumenty na iný počítač alebo do stiahnutej verzie.

## Obmedzenia (úprimne)

- **.docx import** (cez mammoth.js) zachová text, nadpisy, tučné/kurzívu, zoznamy, tabuľky, obrázky a odkazy.
  Farby písma, zarovnanie, hlavičky a päty strán sa pri otvorení stratia.
- **.xlsx:** prenášajú sa hodnoty, vzorce, hárky, formáty čísel, písmo, farby, výplne a zarovnanie. Grafy, zlúčené
  bunky, podmienené formátovanie a makrá sa neprenášajú. Grafy si stiahnete ako PNG. Vzorec s funkciou,
  ktorú Yankee nepozná, ukáže `#NÁZOV?` (funkcia ostane v súbore zachovaná).
- **.pptx** sa dá ukladať, otvárať zatiaľ nie. Na ďalšiu úpravu ukladajte aj `.yslides.json`.
- Starý binárny formát `.doc` nie je podporovaný. Uložte ho vo Worde ako .docx.

## Klávesové skratky

- `Ctrl+S` uložiť ihneď, `Ctrl+Z` / `Ctrl+Y` späť / znova, `Ctrl+B/I/U` formátovanie
- Text: `Ctrl+H` nájsť a nahradiť, `Ctrl+P` tlač / PDF, `Tab` odsadenie
- Tabuľky: šípky, `Enter`/`F2` úprava, `Delete` vymazanie, `Shift+šípky` výber
- Prezentácie: `F5` spustiť od začiatku, `Shift+F5` od aktuálnej snímky

## Použité open-source knižnice (v priečinku `vendor/`)

[xlsx-js-style](https://github.com/gitbrent/xlsx-js-style) / SheetJS (Apache 2.0) · [mammoth.js](https://github.com/mwilliamson/mammoth.js) (BSD-2) ·
[PptxGenJS](https://github.com/gitbrent/PptxGenJS) (MIT) · [JSZip](https://stuk.github.io/jszip/) (MIT/GPLv3)
