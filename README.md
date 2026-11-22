# Yankee Office

Bezplatný kancelársky balík pre kanceláriu a firmu, ktorý beží priamo v prehliadači.
Bez inštalácie, bez licencií, bez registrácie – funguje aj offline.

## Aplikácie

| Aplikácia | Čo vie |
|---|---|
| **Yankee Text** (`writer.html`) | Formátovanie textu, nadpisy, písma, farby, zarovnanie, odrážky, tabuľky, obrázky, odkazy, nájsť a nahradiť, počítadlo slov. Export do **Word (.doc)**, HTML, TXT a **PDF** (cez tlač). Otvorí .html, .txt. |
| **Yankee Tabuľky** (`sheet.html`) | Mriežka 26 × 200, viac hárkov, vzorce (`=SUM(A1:A10)`, `IF`, `VLOOKUP`, `SUMIF`, `COUNTIF`, `ROUND`, …, aj slovensky `SÚČET`, `PRIEMER`, `KEĎ`), absolútne odkazy `$A$1`, formát čísla (€, %, 0,00), tučné/farby/výplň, zoradenie, automatický súčet Σ, kopírovanie/vkladanie z Excelu, späť/znova. Import **CSV**, export **Excel (.xls)**, CSV, PDF. |
| **Yankee Prezentácie** (`slides.html`) | Snímky s nadpisom a obsahom, 5 motívov, obrázky, poznámky rečníka, celoobrazovkový prezentačný režim (F5, šípky, Esc). Export do samostatného **HTML** a **PDF**. |

Úvodná stránka (`index.html`) obsahuje zoznam dokumentov, vyhľadávanie, **firemné šablóny**
(faktúra, obchodný list, zápisnica z porady, rozpočet, dochádzka, firemná prezentácia)
a zálohu / obnovu všetkých dokumentov do jedného `.json` súboru.

## Spustenie

Stačí otvoriť `index.html` v prehliadači (Chrome, Edge, Firefox, Safari).

Pre celú firmu ho môžete zverejniť ako statickú stránku (GitHub Pages, Netlify, firemný server):
nepotrebuje žiadny backend ani databázu.

```bash
# lokálne cez jednoduchý server
python3 -m http.server 8000
# potom otvorte http://localhost:8000
```

## Kde sú moje dáta?

Dokumenty sa ukladajú automaticky do úložiska prehliadača (`localStorage`) na vašom počítači.
Nikam sa neodosielajú. Pravidelne si robte zálohu tlačidlom **Zálohovať všetko** na úvodnej stránke –
vymazaním údajov prehliadača by sa dokumenty stratili.

## Klávesové skratky

- `Ctrl+S` uložiť ihneď, `Ctrl+Z` / `Ctrl+Y` späť / znova, `Ctrl+B/I/U` formátovanie
- Text: `Ctrl+H` nájsť a nahradiť, `Ctrl+P` tlač / PDF, `Tab` odsadenie
- Tabuľky: šípky, `Enter`/`F2` úprava, `Delete` vymazanie, `Shift+šípky` výber
- Prezentácie: `F5` spustiť od začiatku, `Shift+F5` od aktuálnej snímky
