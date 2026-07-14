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

  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function isMaleMarker(value) {
    const text = normalize(value);
    return /\bmuzi\b/.test(text) || /\bmen\b/.test(text) || /^male$/.test(text);
  }

  function isPlayerOneHeader(value) {
    return /^(hrac( c| cislo)? 1|player( no| number)? 1|player one)$/.test(normalize(value));
  }

  function isPlayerTwoHeader(value) {
    return /^(hrac( c| cislo)? 2|player( no| number)? 2|player two)$/.test(normalize(value));
  }

  function isSeedHeader(value) {
    return /^(#|c|cislo|seed|poradie|rank)$/.test(normalize(value));
  }

  function teamName(player1, player2) {
    const a = clean(player1);
    const b = clean(player2);
    return a && b ? `${a} / ${b}` : "";
  }

  function compactSequential(values, label) {
    let last = -1;
    values.forEach((value, index) => { if (value) last = index; });
    if (last < 0) return [];
    const out = values.slice(0, last + 1);
    const missing = [];
    out.forEach((value, index) => { if (!value) missing.push(`${label}${index + 1}`); });
    if (missing.length) throw new Error(`V nasadení chýbajú riadky: ${missing.join(", ")}`);
    return out;
  }

  function parseMenSeedingSheet(sheetName, worksheet) {
    const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" });

    for (let markerRow = 0; markerRow < grid.length; markerRow++) {
      const markerCol = (grid[markerRow] || []).findIndex(isMaleMarker);
      if (markerCol < 0) continue;

      for (let headerRow = markerRow; headerRow < Math.min(grid.length, markerRow + 10); headerRow++) {
        const row = grid[headerRow] || [];
        const player1Col = row.findIndex((value, col) => col >= Math.max(0, markerCol - 2) && isPlayerOneHeader(value));
        const player2Col = row.findIndex((value, col) => col > player1Col && isPlayerTwoHeader(value));
        if (player1Col < 0 || player2Col < 0) continue;

        let seedCol = -1;
        for (let col = player1Col - 1; col >= Math.max(0, markerCol - 3); col--) {
          if (isSeedHeader(row[col])) {
            seedCol = col;
            break;
          }
        }
        if (seedCol < 0) seedCol = Math.max(0, player1Col - 1);

        const direct = [];
        const qualification = [];
        const reserves = [];

        for (let dataRow = headerRow + 1; dataRow < grid.length; dataRow++) {
          const data = grid[dataRow] || [];
          const code = clean(data[seedCol]);
          if (!code) continue;

          const name = teamName(data[player1Col], data[player2Col]);
          if (!name) continue;

          if (/^\d+$/.test(code)) {
            const seed = Number(code);
            if (seed >= 1 && seed <= DRAW_SIZE) direct[seed - 1] = name;
            continue;
          }

          const qualifier = code.match(/^Q\s*(\d+)$/i);
          if (qualifier) {
            qualification[Number(qualifier[1]) - 1] = name;
            continue;
          }

          if (/^(res\.?|reserve)$/i.test(code)) reserves.push(name);
        }

        const directTeams = compactSequential(direct, "");
        const qualificationTeams = compactSequential(qualification, "Q");
        if (!directTeams.length) continue;

        return {
          sheetName,
          directTeams,
          qualificationTeams,
          reserves,
        };
      }
    }

    return null;
  }

  function extractMenSeeding(workbook) {
    for (const sheetName of workbook.SheetNames || []) {
      const parsed = parseMenSeedingSheet(sheetName, workbook.Sheets[sheetName]);
      if (parsed) return parsed;
    }
    throw new Error('V Exceli som nenašiel hlavnú tabuľku označenú „MUŽI / MEN“. Pomocné hárky Muži/Ženy sa nepoužívajú.');
  }

  function buildMainDraw(parsed) {
    const directCount = parsed.directTeams.length;
    const qualificationCount = parsed.qualificationTeams.length;
    const registeredCount = directCount + qualificationCount;

    if (directCount > DRAW_SIZE) throw new Error(`Priamo nasadených dvojíc je ${directCount}, ale pavúk má iba ${DRAW_SIZE} miest.`);
    if (registeredCount === 0) throw new Error("V mužskej časti nie sú žiadne dvojice.");

    let slots;
    let qualifierSlots = 0;
    let byeCount = 0;

    if (registeredCount <= DRAW_SIZE) {
      // Ak je celkovo najviac 16 prihlásených dvojíc, kvalifikácia nie je potrebná.
      // Všetky dvojice idú do hlavnej súťaže a až neobsadené miesta sú BYE.
      slots = parsed.directTeams.concat(parsed.qualificationTeams).slice(0, DRAW_SIZE);
      byeCount = DRAW_SIZE - slots.length;
      while (slots.length < DRAW_SIZE) slots.push("");
    } else {
      // Pri viac než 16 prihlásených ostávajú číselné riadky priamo v hlavnej súťaži.
      // Zvyšok 16-členného pavúka doplnia postupujúci z kvalifikácie, nie BYE.
      qualifierSlots = DRAW_SIZE - directCount;
      if (qualifierSlots <= 0) throw new Error("Hlavná súťaž je už plná a kvalifikácia nemá voľné postupové miesta.");
      slots = parsed.directTeams.slice();
      for (let i = 1; i <= qualifierSlots; i++) slots.push(`Postupujúci z kvalifikácie ${i}`);
    }

    return {
      ...parsed,
      slots,
      directCount,
      qualificationCount,
      registeredCount,
      qualifierSlots,
      byeCount,
    };
  }

  function replaceSeedWithBye(seed) {
    for (let matchId = 1; matchId <= 8; matchId++) {
      if (M[matchId].A === seed) M[matchId].A = BYE;
      if (M[matchId].B === seed) M[matchId].B = BYE;
    }
  }

  function applyMainDraw(draw) {
    M = clone(BASE_MODEL);

    draw.slots.forEach((name, index) => {
      const seed = `S${index + 1}`;
      TEAMS[seed] = name || "BYE";
      if (!name) replaceSeedWithBye(seed);
    });

    WIN = {};
    WINCTX = {};
    MY_SEED = "S1";
    try { localStorage.setItem("pavuk_my_seed", MY_SEED); } catch {}

    $("seedReview")?.classList.add("hidden");
    prune();
    render();

    if (draw.qualifierSlots > 0) {
      showMessage(
        `Pavúk vytvorený: ${draw.directCount} priamo nasadených dvojíc + ${draw.qualifierSlots} miest pre postupujúcich z kvalifikácie. ` +
        `V kvalifikácii je ${draw.qualificationCount} dvojíc, rezervy: ${draw.reserves.length}, BYE: 0.`,
        "ok"
      );
    } else {
      showMessage(`Pavúk vytvorený: ${draw.registeredCount} dvojíc, ${draw.byeCount} BYE.`, "ok");
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
    const parsed = extractMenSeeding(workbook);
    const draw = buildMainDraw(parsed);
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

      showMessage("Načítavam mužské nasadenie a kvalifikáciu z Excelu…");
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

  window.SeedExcelImport = { parseMenSeedingSheet, extractMenSeeding, buildMainDraw, handleExcel };
  install();
})();
