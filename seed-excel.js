(() => {
  "use strict";

  const DRAW_SIZE = 16;
  const BASE_MODEL = {
    1:{A:"S1",B:"S16"},2:{A:"S9",B:"S8"},3:{A:"S5",B:"S12"},4:{A:"S13",B:"S4"},
    5:{A:"S3",B:"S14"},6:{A:"S11",B:"S6"},7:{A:"S7",B:"S10"},8:{A:"S15",B:"S2"},
    9:{A:{W:1},B:{W:2}},10:{A:{W:3},B:{W:4}},11:{A:{W:5},B:{W:6}},12:{A:{W:7},B:{W:8}},
    13:{A:{L:1},B:{L:2}},14:{A:{L:3},B:{L:4}},15:{A:{L:5},B:{L:6}},16:{A:{L:7},B:{L:8}},
    17:{A:{W:13},B:{L:12}},18:{A:{W:14},B:{L:11}},19:{A:{W:15},B:{L:10}},20:{A:{W:16},B:{L:9}},
    21:{A:{W:9},B:{W:10}},22:{A:{W:11},B:{W:12}},23:{A:{W:17},B:{W:18}},24:{A:{W:19},B:{W:20}},
    25:{A:{W:24},B:{L:22}},26:{A:{W:23},B:{L:21}},27:{A:{W:21},B:{W:25}},28:{A:{W:22},B:{W:26}},
    29:{A:{L:27},B:{L:28}},30:{A:{W:27},B:{W:28}}
  };

  const $ = (id) => typeof document === "undefined" ? null : document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function fold(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function normalize(value) {
    return fold(value).replace(/[^a-z0-9]+/g, " ").trim();
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function isMaleMarker(value) {
    const text = normalize(value);
    return /(^| )muzi( |$)/.test(text) || /(^| )men( |$)/.test(text) || text === "male";
  }

  function isPlayerOneHeader(value) {
    return /^(hrac( c| cislo)? 1|player( no| number)? 1|player one)$/.test(normalize(value));
  }

  function isPlayerTwoHeader(value) {
    return /^(hrac( c| cislo)? 2|player( no| number)? 2|player two)$/.test(normalize(value));
  }

  function isSeedHeader(value) {
    const raw = clean(value);
    return raw === "#" || /^(c|cislo|seed|poradie|rank)$/.test(normalize(value));
  }

  function isPointsHeader(value) {
    return /^(body|bodov|points?|pts)$/.test(normalize(value));
  }

  function isTotalHeader(value) {
    return /^(spolu|total|sum)$/.test(normalize(value));
  }

  function joinCells(row, start, end) {
    return (row || [])
      .slice(Math.max(0, start), Math.max(start, end))
      .map(clean)
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  function toNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = clean(value).replace(/\s/g, "").replace(",", ".");
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function isWithdrawnRow(row) {
    const text = normalize((row || []).map(clean).filter(Boolean).join(" "));
    return /odhlasen|odstupen|withdraw|deregister|scratched/.test(text);
  }

  function parseDirectCode(value) {
    const text = clean(value);
    if (!/^\d+(?:[.,]0+)?$/.test(text)) return null;
    const number = Number(text.replace(",", "."));
    return Number.isInteger(number) ? number : null;
  }

  function parseQualifierCode(value) {
    const match = clean(value).match(/^Q\s*(\d+)\s*\**\s*$/i);
    return match ? Number(match[1]) : null;
  }

  function isReserveCode(value) {
    return /^(res\.?|reserve|nahradnik|nahradnici)$/i.test(clean(value));
  }

  function putUnique(map, key, entry, label, warnings) {
    const previous = map.get(key);
    if (!previous) {
      map.set(key, entry);
      return;
    }
    if (normalize(previous.name) === normalize(entry.name)) {
      warnings.push(`${label} ${key} je v tabuľke uvedený duplicitne; identický druhý riadok bol ignorovaný.`);
      return;
    }
    throw new Error(`${label} ${key} je uvedený dvakrát: „${previous.name}“ a „${entry.name}“. Skontroluj odhlásenie alebo prečíslovanie.`);
  }

  function sequentialEntries(map, prefix) {
    if (!map.size) return [];
    const max = Math.max(...map.keys());
    const entries = [];
    const missing = [];
    for (let index = 1; index <= max; index++) {
      const entry = map.get(index);
      if (!entry) missing.push(`${prefix}${index}`);
      entries.push(entry || null);
    }
    if (missing.length) throw new Error(`V nasadení chýbajú aktívne riadky: ${missing.join(", ")}. Po odhlásení musia byť ostatné dvojice prečíslované.`);
    return entries;
  }

  function locateMenTable(grid) {
    for (let markerRow = 0; markerRow < grid.length; markerRow++) {
      const row = grid[markerRow] || [];
      const markerCols = [];
      row.forEach((value, col) => { if (isMaleMarker(value)) markerCols.push(col); });
      for (const markerCol of markerCols) {
        for (let headerRow = markerRow; headerRow < Math.min(grid.length, markerRow + 12); headerRow++) {
          const header = grid[headerRow] || [];
          const player1Col = header.findIndex((value, col) => col >= Math.max(0, markerCol - 3) && isPlayerOneHeader(value));
          const player2Col = header.findIndex((value, col) => col > player1Col && isPlayerTwoHeader(value));
          if (player1Col < 0 || player2Col < 0) continue;

          let seedCol = -1;
          for (let col = player1Col - 1; col >= Math.max(0, markerCol - 4); col--) {
            if (isSeedHeader(header[col])) { seedCol = col; break; }
          }
          if (seedCol < 0) seedCol = Math.max(0, player1Col - 1);

          let player1PointsCol = -1;
          for (let col = player1Col + 1; col < player2Col; col++) {
            if (isPointsHeader(header[col])) { player1PointsCol = col; break; }
          }
          const player1End = player1PointsCol >= 0 ? player1PointsCol : player2Col;

          let player2PointsCol = -1;
          let totalCol = -1;
          for (let col = player2Col + 1; col < Math.min(header.length, player2Col + 8); col++) {
            if (player2PointsCol < 0 && isPointsHeader(header[col])) player2PointsCol = col;
            if (totalCol < 0 && isTotalHeader(header[col])) totalCol = col;
          }
          const player2End = player2PointsCol >= 0 ? player2PointsCol : (totalCol >= 0 ? totalCol : player2Col + 2);

          return {
            markerRow, markerCol, headerRow, seedCol,
            player1Col, player1End, player1PointsCol,
            player2Col, player2End, player2PointsCol, totalCol,
          };
        }
      }
    }
    return null;
  }

  function parseMenSeedingGrid(sheetName, grid) {
    const columns = locateMenTable(grid);
    if (!columns) return null;

    const directMap = new Map();
    const qualificationMap = new Map();
    const declaredQualification = new Set();
    const reserves = [];
    const warnings = [];

    for (let rowIndex = columns.headerRow + 1; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex] || [];
      const code = clean(row[columns.seedCol]);
      if (!code) continue;

      const directSeed = parseDirectCode(code);
      const qualifierSeed = parseQualifierCode(code);
      const reserve = isReserveCode(code);
      if (directSeed === null && qualifierSeed === null && !reserve) continue;

      if (isWithdrawnRow(row)) {
        warnings.push(`Riadok ${rowIndex + 1} (${code}) bol označený ako odhlásenie a bol vynechaný.`);
        continue;
      }

      const player1 = joinCells(row, columns.player1Col, columns.player1End);
      const player2 = joinCells(row, columns.player2Col, columns.player2End);
      const name = player1 && player2 ? `${player1} / ${player2}` : "";
      const p1Points = columns.player1PointsCol >= 0 ? toNumber(row[columns.player1PointsCol]) : null;
      const p2Points = columns.player2PointsCol >= 0 ? toNumber(row[columns.player2PointsCol]) : null;
      const totalPoints = columns.totalCol >= 0 ? toNumber(row[columns.totalCol]) : null;
      const points = totalPoints ?? ((p1Points ?? 0) + (p2Points ?? 0));
      const note = (row || []).map(clean).filter(Boolean).join(" | ");
      const entry = { name, points, row: rowIndex + 1, code, note };

      if (directSeed !== null) {
        if (directSeed < 1 || directSeed > DRAW_SIZE || !name) continue;
        putUnique(directMap, directSeed, entry, "Nasadenie", warnings);
      } else if (qualifierSeed !== null) {
        declaredQualification.add(qualifierSeed);
        if (name) putUnique(qualificationMap, qualifierSeed, entry, "Kvalifikačné nasadenie Q", warnings);
      } else if (reserve && name) {
        reserves.push(entry);
      }
    }

    const directEntries = sequentialEntries(directMap, "");
    const qualificationEntries = sequentialEntries(qualificationMap, "Q");
    const declaredQualificationSlots = declaredQualification.size ? Math.max(...declaredQualification) : 0;

    if (!directEntries.length) return null;

    const allNames = new Map();
    for (const entry of directEntries.concat(qualificationEntries, reserves)) {
      if (!entry || !entry.name) continue;
      const key = normalize(entry.name);
      if (allNames.has(key)) warnings.push(`Dvojica „${entry.name}“ sa v mužskej tabuľke nachádza viackrát.`);
      else allNames.set(key, entry.code);
    }

    return {
      sheetName,
      directEntries,
      qualificationEntries,
      directTeams: directEntries.map(entry => entry.name),
      qualificationTeams: qualificationEntries.map(entry => entry.name),
      declaredQualificationSlots,
      reserves,
      warnings,
      columns,
    };
  }

  function expandRange(start, end, target) {
    const a = Number(start), b = Number(end);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    for (let value = Math.min(a, b); value <= Math.max(a, b); value++) target.add(value);
  }

  function menInstructionSegment(value) {
    const text = fold(value);
    const menStart = Math.max(text.indexOf("kategoria muzi"), text.indexOf("category men"));
    if (menStart >= 0) {
      const tail = text.slice(menStart);
      const stops = [tail.indexOf("kategoria zeny"), tail.indexOf("category women")].filter(index => index > 0);
      return stops.length ? tail.slice(0, Math.min(...stops)) : tail;
    }
    return text;
  }

  function qualificationCountFromInstruction(value) {
    const original = fold(value);
    if (!/(postup|advance|winner|vitaz)/.test(original)) return null;

    const suffixRange = original.match(/vitazi?\s+zapasov?\s*(?:c\.?\s*)?(\d+)\s*\.?\s*[-–—]\s*(\d+)\s+u\s+muzov/);
    if (suffixRange) return Math.abs(Number(suffixRange[2]) - Number(suffixRange[1])) + 1;

    const segment = menInstructionSegment(value);
    const explicitlyMen = /kategoria muzi|category men|\bu muzov\b|\bmen\b/.test(segment);

    if (/vitazi\s+skupin|winners?\s+of\s+groups?/.test(segment)) {
      const groupPart = segment.match(/(?:vitazi\s+skupin|winners?\s+of\s+groups?)([^.;\n]{0,80})/);
      const groupList = (groupPart?.[1] || "").split(/a\s+jeden|and\s+one/)[0];
      const groups = new Set(groupList.match(/\b[a-h]\b/g) || []);
      let count = groups.size;
      if (/jeden\s+najlepsi|one\s+best/.test(segment)) count += 1;
      if (count > 0) return count;
    }

    if (!explicitlyMen && /zeny|women/.test(segment)) return null;
    if (!/(zapas|game|match)/.test(segment)) return null;

    const numbers = new Set();
    let match;
    const ranges = /(?:zapas(?:ov|u|y)?|games?|matches?)[^;\n]{0,120}?(\d+)\s*\.?\s*[-–—]\s*(\d+)/g;
    while ((match = ranges.exec(segment))) expandRange(match[1], match[2], numbers);

    let matchPart = segment.slice(Math.max(0, segment.search(/zapas|game|match/)));
    matchPart = matchPart.replace(/z\s+\d+\.?\s*miesta/g, "");
    for (const token of matchPart.match(/\b\d+\b/g) || []) numbers.add(Number(token));

    return numbers.size || null;
  }

  function advancementTableCounts(grid) {
    const counts = [];
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex] || [];
      if (!row.some(value => /postupujuci|advanced to the main draw/.test(normalize(value)))) continue;
      const seeds = new Set();
      let blankStreak = 0;
      for (let next = rowIndex + 1; next < Math.min(grid.length, rowIndex + 30); next++) {
        const nextRow = grid[next] || [];
        const nonempty = nextRow.map(clean).filter(Boolean);
        if (!nonempty.length) {
          blankStreak++;
          if (blankStreak >= 3 && seeds.size) break;
          continue;
        }
        blankStreak = 0;
        for (const value of nextRow) {
          const q = parseQualifierCode(value);
          if (q !== null) seeds.add(q);
        }
      }
      if (seeds.size) counts.push(seeds.size);
    }
    return counts;
  }

  function inferQualificationPlanFromGrids(grids, parsed) {
    const missingSlots = Math.max(0, DRAW_SIZE - parsed.directTeams.length);
    const qualificationCapacity = Math.max(parsed.qualificationTeams.length, parsed.declaredQualificationSlots);
    const candidates = [];

    for (const { sheetName, grid } of grids) {
      for (const row of grid) {
        for (const value of row || []) {
          if (typeof value !== "string" || !value.trim()) continue;
          const count = qualificationCountFromInstruction(value);
          if (count) candidates.push({ count, source: `pokyn v hárku „${sheetName}“`, confidence: 3 });
        }
      }
      for (const count of advancementTableCounts(grid)) {
        candidates.push({ count, source: `tabuľka postupujúcich v hárku „${sheetName}“`, confidence: 2 });
      }
    }

    const valid = candidates.filter(candidate =>
      candidate.count > 0 && candidate.count <= missingSlots &&
      (qualificationCapacity === 0 || candidate.count <= qualificationCapacity)
    );

    if (valid.length) {
      valid.sort((a, b) => b.confidence - a.confidence || b.count - a.count);
      return { count: valid[0].count, source: valid[0].source, explicit: true, candidates: valid };
    }

    if (parsed.qualificationTeams.length === 0 && parsed.declaredQualificationSlots > 0 && parsed.declaredQualificationSlots <= missingSlots) {
      return {
        count: parsed.declaredQualificationSlots,
        source: "prázdne sloty Q1–Qn v tabuľke hlavnej súťaže",
        explicit: true,
        candidates: [],
      };
    }

    return { count: null, source: "dopĺňanie do kapacity 16", explicit: false, candidates: [] };
  }

  function buildMainDraw(parsed, qualificationPlan = { count: null, source: "dopĺňanie do kapacity 16", explicit: false }) {
    const directCount = parsed.directTeams.length;
    const qualificationCount = parsed.qualificationTeams.length;
    const registeredCount = directCount + qualificationCount;

    if (directCount > DRAW_SIZE) throw new Error(`Priamo nasadených dvojíc je ${directCount}, ale pavúk má iba ${DRAW_SIZE} miest.`);
    if (directCount === 0) throw new Error("V mužskej časti nie sú žiadne priamo nasadené dvojice.");

    const missingSlots = DRAW_SIZE - directCount;
    let qualifierSlots = 0;
    let byeCount = 0;
    let slots = parsed.directTeams.slice();

    if (qualificationCount > 0 && registeredCount <= DRAW_SIZE) {
      slots.push(...parsed.qualificationTeams.slice(0, missingSlots));
      byeCount = DRAW_SIZE - slots.length;
    } else if (missingSlots > 0 && (qualificationCount > 0 || parsed.declaredQualificationSlots > 0)) {
      const fallback = qualificationCount > 0 ? Math.min(missingSlots, qualificationCount) : Math.min(missingSlots, parsed.declaredQualificationSlots);
      qualifierSlots = qualificationPlan.count ?? fallback;
      qualifierSlots = Math.max(0, Math.min(qualifierSlots, missingSlots));
      if (qualificationCount > 0) qualifierSlots = Math.min(qualifierSlots, qualificationCount);
      else if (parsed.declaredQualificationSlots > 0) qualifierSlots = Math.min(qualifierSlots, parsed.declaredQualificationSlots);

      for (let index = 1; index <= qualifierSlots; index++) {
        slots.push(`Postupujúci z kvalifikácie ${index}`);
      }
      byeCount = DRAW_SIZE - slots.length;
    } else {
      byeCount = missingSlots;
    }

    while (slots.length < DRAW_SIZE) slots.push("");
    if (slots.length > DRAW_SIZE) slots = slots.slice(0, DRAW_SIZE);

    return {
      ...parsed,
      slots,
      directCount,
      qualificationCount,
      registeredCount,
      qualifierSlots,
      byeCount,
      qualificationPlan,
    };
  }

  function workbookGrids(workbook) {
    return (workbook.SheetNames || []).map(sheetName => ({
      sheetName,
      grid: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" }),
    }));
  }

  function extractMenSeeding(workbook) {
    const grids = workbookGrids(workbook);
    for (const { sheetName, grid } of grids) {
      const parsed = parseMenSeedingGrid(sheetName, grid);
      if (!parsed) continue;
      const qualificationPlan = inferQualificationPlanFromGrids(grids, parsed);
      return { parsed, qualificationPlan };
    }
    throw new Error('V Exceli som nenašiel hlavnú tabuľku označenú „MUŽI / MEN“. Pomocné hárky pomenované iba Muži/Ženy sa nepoužívajú.');
  }

  function replaceSeedWithBye(seed) {
    for (let matchId = 1; matchId <= 8; matchId++) {
      if (M[matchId].A === seed) M[matchId].A = BYE;
      if (M[matchId].B === seed) M[matchId].B = BYE;
    }
  }

  function applyMainDraw(draw) {
    M = clone(BASE_MODEL);

    for (let index = 0; index < DRAW_SIZE; index++) {
      const seed = `S${index + 1}`;
      const name = draw.slots[index] || "";
      TEAMS[seed] = name || "BYE";
      if (!name) replaceSeedWithBye(seed);
    }

    WIN = {};
    WINCTX = {};
    MY_SEED = "S1";
    try { localStorage.setItem("pavuk_my_seed", MY_SEED); } catch {}

    $("seedReview")?.classList.add("hidden");
    prune();
    render();

    const skipped = draw.warnings.length ? ` Upozornenia: ${draw.warnings.join(" ")}` : "";
    if (draw.qualifierSlots > 0) {
      showMessage(
        `Pavúk vytvorený: ${draw.directCount} priamo nasadených, ${draw.qualifierSlots} miest pre postupujúcich z kvalifikácie, ` +
        `${draw.byeCount} BYE. V kvalifikácii je ${draw.qualificationCount} aktívnych dvojíc, rezervy: ${draw.reserves.length}. ` +
        `Počet postupujúcich: ${draw.qualificationPlan.source}.${skipped}`,
        "ok"
      );
    } else {
      showMessage(`Pavúk vytvorený: ${DRAW_SIZE - draw.byeCount} dvojíc, ${draw.byeCount} BYE.${skipped}`, "ok");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showMessage(text, className = "") {
    const message = $("msg");
    if (!message) return;
    message.textContent = text;
    message.className = `msg ${className}`;
  }

  async function handleExcel(file) {
    if (!window.XLSX) throw new Error("Knižnica XLSX sa nenačítala");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const { parsed, qualificationPlan } = extractMenSeeding(workbook);
    const draw = buildMainDraw(parsed, qualificationPlan);
    applyMainDraw(draw);
    return draw;
  }

  function install() {
    const button = $("seedUploadBtn");
    const input = $("seedImageInput");
    if (!button || !input) return;

    button.textContent = "📥 Upload nasadenie";
    input.accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/*";
    input.removeAttribute("capture");

    const originalImageHandler = input.onchange;
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const isExcel = /\.xlsx?$/i.test(file.name) || /spreadsheetml|ms-excel/.test(file.type);
      if (!isExcel) return originalImageHandler?.call(input, event);

      showMessage("Načítavam mužské nasadenie, kvalifikáciu a BYE z Excelu…");
      try {
        await handleExcel(file);
      } catch (error) {
        console.error(error);
        showMessage(`Chyba: ${error.message}`, "err");
      } finally {
        event.target.value = "";
      }
    };
  }

  const api = {
    DRAW_SIZE,
    BASE_MODEL,
    locateMenTable,
    parseMenSeedingGrid,
    qualificationCountFromInstruction,
    advancementTableCounts,
    inferQualificationPlanFromGrids,
    buildMainDraw,
    extractMenSeeding,
    handleExcel,
  };

  if (typeof window !== "undefined") window.SeedExcelImport = api;
  install();
})();
