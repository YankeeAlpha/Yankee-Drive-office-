/* Firemné šablóny */
const TEMPLATES = [
  {
    type: 'writer', name: 'Faktúra', desc: 'Jednoduchá faktúra pre zákazníka',
    content: `<h1 style="text-align:right">FAKTÚRA č. 2026001</h1>
<table><tbody>
<tr><td><b>Dodávateľ</b><br>Názov firmy s.r.o.<br>Ulica 1, 811 01 Bratislava<br>IČO: 12345678<br>DIČ: 2021234567<br>IBAN: SK00 0000 0000 0000 0000 0000</td>
<td><b>Odberateľ</b><br>Zákazník a.s.<br>Ulica 2, 040 01 Košice<br>IČO: 87654321</td></tr>
</tbody></table>
<p>Dátum vystavenia: 1. 1. 2026 &nbsp;·&nbsp; Dátum splatnosti: 15. 1. 2026 &nbsp;·&nbsp; Variabilný symbol: 2026001</p>
<table><tbody>
<tr><th>Položka</th><th>Množstvo</th><th>Cena/ks</th><th>Spolu</th></tr>
<tr><td>Služba / tovar</td><td>1</td><td>100,00 €</td><td>100,00 €</td></tr>
<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>
<tr><td colspan="3" style="text-align:right"><b>Celkom na úhradu</b></td><td><b>100,00 €</b></td></tr>
</tbody></table>
<p><br></p><p>Pečiatka a podpis: ______________________</p>`
  },
  {
    type: 'writer', name: 'Obchodný list', desc: 'Formálny list s hlavičkou',
    content: `<p><b>Názov firmy s.r.o.</b><br>Ulica 1, 811 01 Bratislava<br>tel.: +421 900 000 000 · info@firma.sk</p>
<p style="text-align:right">V Bratislave, dňa 1. 1. 2026</p>
<p>Vážený pán / Vážená pani<br>Meno Priezvisko<br>Firma<br>Adresa</p>
<p><b>Vec: Predmet listu</b></p>
<p>Vážený pán / Vážená pani,</p>
<p>týmto Vám oznamujeme…</p>
<p>S pozdravom</p>
<p><br>Meno Priezvisko<br>konateľ</p>`
  },
  {
    type: 'writer', name: 'Zápisnica z porady', desc: 'Účastníci, body, úlohy',
    content: `<h1>Zápisnica z porady</h1>
<p><b>Dátum:</b> &nbsp; <b>Miesto:</b> &nbsp; <b>Zapisovateľ:</b></p>
<h2>Účastníci</h2><ul><li>Meno</li></ul>
<h2>Program</h2><ol><li>Bod programu</li></ol>
<h2>Závery a úlohy</h2>
<table><tbody><tr><th>Úloha</th><th>Zodpovedný</th><th>Termín</th></tr><tr><td></td><td></td><td></td></tr></tbody></table>`
  },
  {
    type: 'sheet', name: 'Mesačný rozpočet', desc: 'Príjmy, výdavky, bilancia',
    content: { sheets: [{ name: 'Rozpočet', cells: {
      A1: 'Položka', B1: 'Plán (€)', C1: 'Skutočnosť (€)', D1: 'Rozdiel',
      A2: 'Tržby', B2: '10000', C2: '11200', D2: '=C2-B2',
      A3: 'Nájom', B3: '-1500', C3: '-1500', D3: '=C3-B3',
      A4: 'Mzdy', B4: '-5000', C4: '-5200', D4: '=C4-B4',
      A5: 'Energie', B5: '-400', C5: '-380', D5: '=C5-B5',
      A6: 'Marketing', B6: '-800', C6: '-650', D6: '=C6-B6',
      A8: 'Bilancia', B8: '=SUM(B2:B6)', C8: '=SUM(C2:C6)', D8: '=C8-B8'
    }, styles: { A1: { b: 1 }, B1: { b: 1 }, C1: { b: 1 }, D1: { b: 1 }, A8: { b: 1 }, B8: { b: 1 }, C8: { b: 1 }, D8: { b: 1 } } }] }
  },
  {
    type: 'sheet', name: 'Evidencia dochádzky', desc: 'Príchody, odchody, hodiny',
    content: { sheets: [{ name: 'Dochádzka', cells: {
      A1: 'Dátum', B1: 'Zamestnanec', C1: 'Príchod (h)', D1: 'Odchod (h)', E1: 'Odpracované',
      A2: '1.1.2026', B2: 'Ján Novák', C2: '8', D2: '16.5', E2: '=D2-C2',
      A3: '2.1.2026', B3: 'Ján Novák', C3: '7.5', D3: '16', E3: '=D3-C3',
      D5: 'Spolu:', E5: '=SUM(E2:E4)'
    }, styles: { A1: { b: 1 }, B1: { b: 1 }, C1: { b: 1 }, D1: { b: 1 }, E1: { b: 1 }, D5: { b: 1 }, E5: { b: 1 } } }] }
  },
  {
    type: 'slides', name: 'Firemná prezentácia', desc: 'Úvod, ciele, výsledky',
    content: { theme: 'theme-blue', slides: [
      { layout: 'layout-title', title: 'Názov firmy', body: 'Prezentácia výsledkov 2026', notes: '' },
      { layout: 'layout-content', title: 'O nás', body: '<ul><li>Kto sme</li><li>Čo robíme</li><li>Naši zákazníci</li></ul>', notes: '' },
      { layout: 'layout-content', title: 'Výsledky', body: '<ul><li>Tržby +12 %</li><li>Noví zákazníci: 40</li><li>Spokojnosť: 95 %</li></ul>', notes: '' },
      { layout: 'layout-title', title: 'Ďakujeme', body: 'Otázky?', notes: '' }
    ] }
  }
];
