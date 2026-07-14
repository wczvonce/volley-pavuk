(() => {
  "use strict";

  const MAX_SEEDS = 16;
  const FEMALE_WORDS = /\b(zeny|zena|women|woman|female|damske|damy)\b/;
  const MALE_WORDS = /\b(muzi|muz|men|male|pani)\b/;

  const $ = (id) => document.getElementById(id);

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cleanName(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function isFemaleLabel(value) {
    return FEMALE_WORDS.test(normalize(value));
  }

  function isMaleLabel(value) {
    const text = normalize(value);
    return !FEMALE_WORDS.test(text) && MALE_WORDS.test(text);
  }

  function joinPlayer(firstName, surname) {
    return [cleanName(firstName), cleanName(surname)].filter(Boolean).join(" ").trim();
  }

  function joinTeam(player1, player2) {
    const a = cleanName(player1);
    const b = cleanName(player2);
    return a && b ? `${a} / ${b}` : "";
  }

  function findAll(row, predicate) {
    const indexes = [];
    row.forEach((cell, index) => {
      if (predicate(normalize(cell), cell)) indexes.push(index);
    });
    return indexes;
  }

  function parseTwoPlayerColumns(grid) {
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex] || [];
      const firstNameCols = findAll(row, (text) => /^(meno|first name|name)$/.test(text));
      const surnameCols = findAll(row, (text) => /^(priezvisko|surname|last name)$/.test(text));
      if (firstNameCols.length < 2 || surnameCols.length < 2) continue;

      const columns = {
        first1: firstNameCols[0],
        surname1: surnameCols.find((col) => col > firstNameCols[0] && col < firstNameCols[1]) ?? surnameCols[0],
        first2: firstNameCols[1],
        surname2: surnameCols.find((col) => col > firstNameCols[1]) ?? surnameCols[1],
      };
      const teams = [];
      for (let i = rowIndex + 1; i < grid.length && teams.length < MAX_SEEDS; i++) {
        const data = grid[i] || [];
        const player1 = joinPlayer(data[columns.first1], data[columns.surname1]);
        const player2 = joinPlayer(data[columns.first2], data[columns.surname2]);
        const team = joinTeam(player1, player2);
        if (team) teams.push(team);
      }
      if (teams.length) return teams;
    }
    return [];
  }

  function isMalePlayerOneHeader(text) {
    return /^(hrac( c| cislo)? 1|player( no)? 1|player one)$/.test(text);
  }

  function isMalePlayerTwoHeader(text) {
    return /^(hrac( c| cislo)? 2|player( no)? 2|player two)$/.test(text);
  }

  function parseExplicitMaleBlock(grid) {
    let maleMarker = null;
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex] || [];
      for (let col = 0; col < row.length; col++) {
        if (isMaleLabel(row[col])) {
          maleMarker = { row: rowIndex, col };
          break;
        }
      }
      if (maleMarker) break;
    }
    if (!maleMarker) return [];

    for (let rowIndex = maleMarker.row; rowIndex < Math.min(grid.length, maleMarker.row + 12); rowIndex++) {
      const row = grid[rowIndex] || [];
      const normalized = row.map(normalize);
      const player1Col = normalized.findIndex((text, col) => col >= Math.max(0, maleMarker.col - 1) && isMalePlayerOneHeader(text));
      const player2Col = normalized.findIndex((text, col) => col > player1Col && isMalePlayerTwoHeader(text));
      if (player1Col < 0 || player2Col < 0) continue;

      let seedCol = -1;
      for (let col = player1Col - 1; col >= Math.max(0, maleMarker.col - 2); col--) {
        if (/^(#|c|cislo|seed|poradie)$/.test(normalized[col])) {
          seedCol = col;
          break;
        }
      }
      if (seedCol < 0) seedCol = Math.max(0, player1Col - 1);

      const teams = [];
      for (let i = rowIndex + 1; i < grid.length && teams.length < MAX_SEEDS; i++) {
        const data = grid[i] || [];
        const seedText = cleanName(data[seedCol]);
        if (!/^\d+$/.test(seedText)) continue; // Q1, reserves and notes are never main-draw seeds.
        const seed = Number(seedText);
        if (seed < 1 || seed > MAX_SEEDS) continue;
        const team = joinTeam(data[player1Col], data[player2Col]);
        if (team) teams[seed - 1] = team;
      }
      if (teams.some(Boolean)) return teams;
    }
    return [];
  }

  function extractMaleTeams(workbook) {
    const sheetNames = workbook.SheetNames || [];
    const maleSheets = sheetNames.filter((name) => isMaleLabel(name));

    for (const sheetName of maleSheets) {
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
      const teams = parseTwoPlayerColumns(grid);
      if (teams.length) return { teams: teams.slice(0, MAX_SEEDS), sheetName, method: "male-sheet" };

      const blockTeams = parseExplicitMaleBlock(grid);
      if (blockTeams.some(Boolean)) return { teams: blockTeams.slice(0, MAX_SEEDS), sheetName, method: "male-block" };
    }

    // A combined sheet is accepted only when it contains an explicit MUŽI/MEN marker.
    // Sheets named Ženy/Women are always skipped and are never used as a fallback.
    for (const sheetName of sheetNames) {
      if (isFemaleLabel(sheetName)) continue;
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
      const teams = parseExplicitMaleBlock(grid);
      if (teams.some(Boolean)) return { teams: teams.slice(0, MAX_SEEDS), sheetName, method: "combined-male-block" };
    }

    throw new Error('V Exceli som nenašiel mužské nasadenie. Použi hárok „Muži“ alebo tabuľku označenú „MUŽI / MEN“. Hárok Ženy sa zámerne ignoruje.');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showMessage(text, className = "") {
    const message = $("msg");
    message.textContent = text;
    message.className = `msg ${className}`;
  }

  function showExcelReview(result) {
    const list = $("seedRows");
    const section = $("seedReview");
    const preview = $("seedPreview");
    const summary = $("seedSummary");
    if (!list || !section) throw new Error("Kontrola nasadenia nie je pripravená");

    list.innerHTML = "";
    const names = Array.from({ length: MAX_SEEDS }, (_, index) => cleanName(result.teams[index]));
    names.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = `seed-row${name ? "" : " bye"}`;
      row.innerHTML = `<span class="seed-tag">S${index + 1}</span><input class="seed-input" value="${escapeHtml(name)}" placeholder="BYE"><button class="bye-btn">BYE</button>`;
      const input = row.querySelector("input");
      input.oninput = () => row.classList.toggle("bye", !input.value.trim());
      row.querySelector("button").onclick = () => {
        input.value = "";
        row.classList.add("bye");
      };
      list.append(row);
    });

    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
    if (summary) {
      const count = names.filter(Boolean).length;
      summary.textContent = `Excel: hárok „${result.sheetName}“. Načítaných ${count} mužských dvojíc, ${MAX_SEEDS - count} BYE. Ženské hárky boli ignorované.`;
    }
    section.classList.remove("hidden");
  }

  async function handleExcelSeeding(file) {
    if (!window.XLSX) throw new Error("Knižnica XLSX sa nenačítala");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const result = extractMaleTeams(workbook);
    showExcelReview(result);
    const count = result.teams.filter(Boolean).length;
    showMessage(`Mužské nasadenie načítané: ${count} dvojíc. Skontroluj ho a potvrď vytvorenie pavúka.`, "ok");
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
      if (!isExcel) {
        const preview = $("seedPreview");
        if (preview) preview.hidden = false;
        return originalImageHandler?.call(input, event);
      }

      showMessage("Načítavam mužské nasadenie z Excelu…");
      try {
        await handleExcelSeeding(file);
      } catch (error) {
        console.error(error);
        showMessage(`Chyba: ${error.message}`, "err");
      } finally {
        event.target.value = "";
      }
    };
  }

  window.SeedExcelImport = { extractMaleTeams, parseTwoPlayerColumns, parseExplicitMaleBlock };
  install();
})();
