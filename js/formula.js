/* Yankee Tabuľky – výpočtové jadro vzorcov (bez eval) */
const Formula = (() => {
  const colToNum = s => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const numToCol = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const parseRef = ref => { const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref.toUpperCase()); return m ? { c: colToNum(m[1]), r: +m[2] - 1 } : null; };
  const makeRef = (c, r) => numToCol(c) + (r + 1);

  class FErr { constructor(code) { this.code = code; } toString() { return this.code; } }
  const ERR = { div0: new FErr('#DELENIE/0!'), val: new FErr('#HODNOTA!'), ref: new FErr('#ODKAZ!'), name: new FErr('#NÁZOV?'), cyc: new FErr('#CYKLUS!'), na: new FErr('#N/A') };

  /* ---- Tokenizer ---- */
  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') {
        let j = i + 1, s = '';
        while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; }
        t.push({ k: 'str', v: s }); i = j + 1; continue;
      }
      const num = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      if (num) { t.push({ k: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
      const sref = /^(?:'((?:[^']|'')+)'|([\p{L}_][\p{L}0-9_.]*))!(\$?[A-Za-z]+\$?\d+)(?::(\$?[A-Za-z]+\$?\d+))?/u.exec(src.slice(i));
      if (sref) {
        const sheet = (sref[1] ? sref[1].replace(/''/g, "'") : sref[2]);
        const a = sref[3].toUpperCase().replace(/\$/g, ''), b = sref[4] && sref[4].toUpperCase().replace(/\$/g, '');
        t.push(b ? { k: 'range', a, b, sheet } : { k: 'ref', v: a, sheet });
        i += sref[0].length; continue;
      }
      const id = /^\$?[\p{L}_][\p{L}0-9_.]*\$?\d*/u.exec(src.slice(i));
      if (id) {
        let w = id[0]; i += w.length;
        const range = /^:\$?[A-Za-z]+\$?\d+/.exec(src.slice(i));
        if (range && parseRef(w)) { t.push({ k: 'range', a: w.toUpperCase().replace(/\$/g, ''), b: range[0].slice(1).toUpperCase().replace(/\$/g, '') }); i += range[0].length; }
        else if (parseRef(w)) t.push({ k: 'ref', v: w.toUpperCase().replace(/\$/g, '') });
        else t.push({ k: 'id', v: w.toUpperCase() });
        continue;
      }
      const op2 = src.substr(i, 2);
      if (['<=', '>=', '<>'].includes(op2)) { t.push({ k: 'op', v: op2 }); i += 2; continue; }
      if ('+-*/^&=<>(),;%'.includes(ch)) { t.push({ k: 'op', v: ch === ';' ? ',' : ch }); i++; continue; }
      throw ERR.name;
    }
    return t;
  }

  /* ---- Parser (rekurzívny zostup) -> AST ---- */
  function parse(src) {
    const t = tokenize(src); let p = 0;
    const peek = () => t[p], next = () => t[p++];
    const isOp = v => t[p] && t[p].k === 'op' && t[p].v === v;
    function expect(v) { if (!isOp(v)) throw ERR.val; p++; }

    function cmp() {
      let l = concat();
      while (t[p] && t[p].k === 'op' && ['=', '<', '>', '<=', '>=', '<>'].includes(t[p].v)) { const o = next().v; l = { k: 'bin', o, l, r: concat() }; }
      return l;
    }
    function concat() { let l = add(); while (isOp('&')) { p++; l = { k: 'bin', o: '&', l, r: add() }; } return l; }
    function add() { let l = mul(); while (isOp('+') || isOp('-')) { const o = next().v; l = { k: 'bin', o, l, r: mul() }; } return l; }
    function mul() { let l = pow(); while (isOp('*') || isOp('/')) { const o = next().v; l = { k: 'bin', o, l, r: pow() }; } return l; }
    function pow() { let l = unary(); while (isOp('^')) { p++; l = { k: 'bin', o: '^', l, r: unary() }; } return l; }
    function unary() {
      if (isOp('-')) { p++; return { k: 'neg', e: unary() }; }
      if (isOp('+')) { p++; return unary(); }
      let e = primary();
      if (isOp('%')) { p++; e = { k: 'bin', o: '/', l: e, r: { k: 'num', v: 100 } }; }
      return e;
    }
    function primary() {
      const tok = next();
      if (!tok) throw ERR.val;
      if (tok.k === 'num') return { k: 'num', v: tok.v };
      if (tok.k === 'str') return { k: 'str', v: tok.v };
      if (tok.k === 'ref') return { k: 'ref', v: tok.v, sheet: tok.sheet };
      if (tok.k === 'range') return { k: 'range', a: tok.a, b: tok.b, sheet: tok.sheet };
      if (tok.k === 'id') {
        if (tok.v === 'TRUE' || tok.v === 'PRAVDA') return { k: 'bool', v: true };
        if (tok.v === 'FALSE' || tok.v === 'NEPRAVDA') return { k: 'bool', v: false };
        expect('(');
        const args = [];
        if (!isOp(')')) { do { args.push(cmp()); } while (isOp(',') && ++p); }
        expect(')');
        return { k: 'fn', n: tok.v, args };
      }
      if (tok.k === 'op' && tok.v === '(') { const e = cmp(); expect(')'); return e; }
      throw ERR.val;
    }
    const ast = cmp();
    if (p < t.length) throw ERR.val;
    return ast;
  }

  /* ---- Pomocné ---- */
  const flat = a => a.flat(Infinity);
  const isErr = v => v instanceof FErr;
  function toNum(v) {
    if (isErr(v)) throw v;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === '' || v == null) return 0;
    const n = Number(String(v).replace(',', '.'));
    if (isNaN(n)) throw ERR.val;
    return n;
  }
  const toStr = v => { if (isErr(v)) throw v; return v == null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v); };
  const toBool = v => { if (isErr(v)) throw v; return typeof v === 'string' ? v.toUpperCase() === 'TRUE' : !!v; };
  const nums = args => flat(args).filter(v => { if (isErr(v)) throw v; return typeof v === 'number'; });

  function matchCrit(v, crit) {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(crit));
    const op = m[1] || '=', rhs = m[2];
    const rn = Number(rhs.replace(',', '.'));
    const lhs = typeof v === 'number' && !isNaN(rn) && rhs !== '' ? v : String(v ?? '').toLowerCase();
    const r = typeof lhs === 'number' ? rn : rhs.toLowerCase();
    switch (op) { case '=': return lhs === r; case '<>': return lhs !== r; case '<': return lhs < r; case '>': return lhs > r; case '<=': return lhs <= r; case '>=': return lhs >= r; }
  }

  const FN = {
    SUM: a => nums(a).reduce((s, x) => s + x, 0),
    AVERAGE: a => { const n = nums(a); if (!n.length) throw ERR.div0; return n.reduce((s, x) => s + x, 0) / n.length; },
    MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: a => nums(a).length,
    COUNTA: a => flat(a).filter(v => v !== '' && v != null).length,
    COUNTBLANK: a => flat(a).filter(v => v === '' || v == null).length,
    PRODUCT: a => nums(a).reduce((s, x) => s * x, 1),
    ROUND: a => { const f = 10 ** toNum(a[1] ?? 0); return Math.round(toNum(a[0]) * f) / f; },
    ROUNDUP: a => { const f = 10 ** toNum(a[1] ?? 0); return Math.ceil(toNum(a[0]) * f) / f; },
    ROUNDDOWN: a => { const f = 10 ** toNum(a[1] ?? 0); return Math.floor(toNum(a[0]) * f) / f; },
    INT: a => Math.floor(toNum(a[0])),
    ABS: a => Math.abs(toNum(a[0])),
    SQRT: a => { const n = toNum(a[0]); if (n < 0) throw ERR.val; return Math.sqrt(n); },
    POWER: a => toNum(a[0]) ** toNum(a[1]),
    MOD: a => { const d = toNum(a[1]); if (!d) throw ERR.div0; return toNum(a[0]) % d; },
    PI: () => Math.PI,
    IF: a => toBool(a[0]) ? (a[1] ?? true) : (a[2] ?? false),
    IFERROR: a => isErr(a[0]) ? a[1] : a[0],
    AND: a => flat(a).every(toBool),
    OR: a => flat(a).some(toBool),
    NOT: a => !toBool(a[0]),
    CONCAT: a => flat(a).map(toStr).join(''),
    CONCATENATE: a => flat(a).map(toStr).join(''),
    LEN: a => toStr(a[0]).length,
    UPPER: a => toStr(a[0]).toUpperCase(),
    LOWER: a => toStr(a[0]).toLowerCase(),
    TRIM: a => toStr(a[0]).trim().replace(/\s+/g, ' '),
    LEFT: a => toStr(a[0]).slice(0, toNum(a[1] ?? 1)),
    RIGHT: a => { const s = toStr(a[0]), n = toNum(a[1] ?? 1); return n ? s.slice(-n) : ''; },
    MID: a => toStr(a[0]).substr(toNum(a[1]) - 1, toNum(a[2])),
    TODAY: () => new Date().toLocaleDateString('sk-SK'),
    NOW: () => new Date().toLocaleString('sk-SK'),
    YEAR: () => new Date().getFullYear(),
    SUMIF: a => { const rng = flat(a[0]), sum = a[2] ? flat(a[2]) : rng; return rng.reduce((s, v, i) => matchCrit(v, a[1]) && typeof sum[i] === 'number' ? s + sum[i] : s, 0); },
    COUNTIF: a => flat(a[0]).filter(v => matchCrit(v, a[1])).length,
    AVERAGEIF: a => { const rng = flat(a[0]), src = a[2] ? flat(a[2]) : rng; const v = rng.map((x, i) => matchCrit(x, a[1]) ? src[i] : null).filter(x => typeof x === 'number'); if (!v.length) throw ERR.div0; return v.reduce((s, x) => s + x, 0) / v.length; },
    VLOOKUP: a => {
      const key = a[0], table = a[1], col = toNum(a[2]) - 1, exact = a[3] === undefined ? false : !toBool(a[3]);
      if (!Array.isArray(table) || col < 0 || col >= table[0].length) throw ERR.ref;
      for (const row of table) {
        const v = row[0];
        if (exact || typeof key !== 'number' ? String(v).toLowerCase() === String(key).toLowerCase() : v === key) return row[col];
      }
      throw ERR.na;
    },
  };
  FN.SÚČET = FN.SUM; FN.PRIEMER = FN.AVERAGE; FN.KEĎ = FN.IF; FN.POČET = FN.COUNT; FN.ZAOKRÚHLIŤ = FN.ROUND;

  /* ---- Vyhodnotenie ---- */
  function evaluate(ast, getCell) {
    switch (ast.k) {
      case 'num': case 'str': case 'bool': return ast.v;
      case 'ref': { const v = getCell(ast.v, ast.sheet); return v === '' ? 0 : v; }
      case 'range': {
        const a = parseRef(ast.a), b = parseRef(ast.b);
        const rows = [];
        for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
          const row = [];
          for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) row.push(getCell(makeRef(c, r), ast.sheet));
          rows.push(row);
        }
        return rows;
      }
      case 'neg': return -toNum(evaluate(ast.e, getCell));
      case 'bin': {
        const l = evaluate(ast.l, getCell), r = evaluate(ast.r, getCell);
        switch (ast.o) {
          case '+': return toNum(l) + toNum(r);
          case '-': return toNum(l) - toNum(r);
          case '*': return toNum(l) * toNum(r);
          case '/': { const d = toNum(r); if (d === 0) throw ERR.div0; return toNum(l) / d; }
          case '^': return toNum(l) ** toNum(r);
          case '&': return toStr(l) + toStr(r);
          default: {
            if (isErr(l)) throw l; if (isErr(r)) throw r;
            const L = typeof l === 'string' ? l.toLowerCase() : l, R = typeof r === 'string' ? r.toLowerCase() : r;
            return { '=': L === R, '<>': L !== R, '<': L < R, '>': L > R, '<=': L <= R, '>=': L >= R }[ast.o];
          }
        }
      }
      case 'fn': {
        const f = FN[ast.n];
        if (!f) throw ERR.name;
        const lazy = ast.n === 'IF' || ast.n === 'KEĎ' || ast.n === 'IFERROR';
        if (lazy) {
          const ev = n => { try { return evaluate(n, getCell); } catch (e) { if (isErr(e)) return e; throw e; } };
          if (ast.n === 'IFERROR') return f([ev(ast.args[0]), ast.args[1] ? ev(ast.args[1]) : '']);
          const cond = toBool(ev(ast.args[0]));
          const branch = cond ? ast.args[1] : ast.args[2];
          if (!branch) return cond;
          const v = ev(branch); if (isErr(v)) throw v; return v;
        }
        const args = ast.args.map(a => evaluate(a, getCell));
        const res = f(args);
        if (typeof res === 'number' && !isFinite(res)) throw ERR.val;
        return res;
      }
    }
    throw ERR.val;
  }

  const cache = new Map();
  function compile(src) {
    if (!cache.has(src)) {
      try { cache.set(src, parse(src)); } catch (e) { cache.set(src, isErr(e) ? e : ERR.val); }
    }
    return cache.get(src);
  }

  /* Prepočíta celý zošit: sheets = [{ name, cells: { A1: 'raw' } }] -> [{ A1: hodnota }, ...] */
  function computeWorkbook(sheets) {
    const all = sheets.map(() => ({})), visiting = new Set();
    const byName = {};
    sheets.forEach((s, i) => { byName[String(s.name).toLowerCase()] = i; });
    function getIn(si, ref) {
      const values = all[si];
      if (ref in values) return values[ref];
      const raw = sheets[si].cells[ref];
      if (raw == null || raw === '') return '';
      const key = si + '!' + ref;
      if (visiting.has(key)) throw ERR.cyc;
      let v;
      if (typeof raw === 'string' && raw[0] === '=') {
        visiting.add(key);
        const ast = compile(raw.slice(1));
        const getCell = (r, sheet) => {
          if (sheet === undefined) return getIn(si, r);
          const j = byName[sheet.toLowerCase()];
          if (j === undefined) throw ERR.ref;
          return getIn(j, r);
        };
        try { v = isErr(ast) ? ast : evaluate(ast, getCell); if (Array.isArray(v)) v = v[0][0]; }
        catch (e) { v = isErr(e) ? e : ERR.val; }
        visiting.delete(key);
      } else v = literal(raw);
      values[ref] = v;
      return v;
    }
    sheets.forEach((s, si) => { for (const ref of Object.keys(s.cells)) getIn(si, ref); });
    return all;
  }
  const computeAll = cells => computeWorkbook([{ name: '_', cells }])[0];

  /* Preklad vzorca do tvaru pre Excel (anglické názvy, čiarka ako oddeľovač) */
  const SK_EN = { 'SÚČET': 'SUM', 'PRIEMER': 'AVERAGE', 'KEĎ': 'IF', 'POČET': 'COUNT', 'ZAOKRÚHLIŤ': 'ROUND' };
  function toExcel(formula) {
    return formula.split('"').map((part, i) => i % 2 ? part :
      part.replace(/;/g, ',').replace(/[\p{L}]+(?=\()/gu, w => SK_EN[w.toUpperCase()] || w.toUpperCase())).join('"');
  }

  function literal(raw) {
    const s = String(raw).trim();
    if (/^[+-]?(\d+([.,]\d+)?|[.,]\d+)([eE][+-]?\d+)?$/.test(s)) return Number(s.replace(',', '.'));
    if (/^[+-]?\d+([.,]\d+)?\s?%$/.test(s)) return Number(s.replace('%', '').replace(',', '.')) / 100;
    return raw;
  }

  return { computeAll, computeWorkbook, toExcel, colToNum, numToCol, parseRef, makeRef, isErr, functions: Object.keys(FN) };
})();

if (typeof module !== 'undefined') module.exports = Formula;
