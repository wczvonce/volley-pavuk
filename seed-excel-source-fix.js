(() => {
  "use strict";

  const MAX_SEEDS = 16;
  const input = document.getElementById("seedImageInput");
  const button = document.getElementById("seedUploadBtn");
  const parser = window.SeedExcelImport;
  if (!input || !button || !parser || !window.XLSX) return;

  const originalHandler = input.onchange;

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function isFemaleSheet(name) {
    return /\b(zeny|zena|women|woman|female|damske|damy)\b/.test(normalize(name));
  }

  function isMaleSheet(name) {
    const value = normalize(name);
    return !isFemaleSheet(name) && /\b(muzi|muz|men|male|pani)\b/.test(value);
  }

  function clean(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showMessage(text, className = "") {
    const message = document.getElementById("msg");
    if (!message) return;
    message.textContent = text;
    message.className = `msg ${className}`;
  }

  function extractAuthoritativeMenSeeding(workbook) {
    const names = workbook.SheetNames || [];

    // Zdroj pravdy je hlavná seeding tabuľka označená MUŽI / MEN.
    // Preto ju hľadáme skôr než pomocný hárok pomenovaný iba „Muži“.
    for (const sheetName of names) {
      if (isFemaleSheet(sheetName)) continue;
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
      });
      const teams = parser.parseExplicitMaleBlock(grid);
      if (teams.some(Boolean)) {
        return {
          teams: teams.slice(0, MAX_SEEDS),
          sheetName,
          method: "main-seeding-men-block",
        };
      }
    }

    // Náhradná možnosť pre iný formát: samostatný hárok Muži bez seeding tabuľky.
    for (const sheetName of names.filter(isMaleSheet)) {
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
      });
      const teams = parser.parseTwoPlayerColumns(grid);
      if (teams.length) {
        return {
          teams: teams.slice(0, MAX_SEEDS),
          sheetName,
          method: "male-sheet-fallback",
        };
      }
    }

    throw new Error('V Exceli som nenašiel hlavnú tabuľku „MUŽI / MEN“. Ženské údaje sa nikdy nepoužijú.');
  }

  function renderReview(result) {
    const list = document.getElementById("seedRows");
    const section = document.getElementById("seedReview");
    const preview = document.getElementById("seedPreview");
    const summary = document.getElementById("seedSummary");
    if (!list || !section) throw new Error("Kontrola nasadenia nie je pripravená");

    list.innerHTML = "";
    const teams = Array.from({ length: MAX_SEEDS }, (_, index) => clean(result.teams[index]));

    teams.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = `seed-row${name ? "" : " bye"}`;
      row.innerHTML = `<span class="seed-tag">S${index + 1}</span><input class="seed-input" value="${escapeHtml(name)}" placeholder="BYE"><button class="bye-btn">BYE</button>`;
      const teamInput = row.querySelector("input");
      teamInput.oninput = () => row.classList.toggle("bye", !teamInput.value.trim());
      row.querySelector("button").onclick = () => {
        teamInput.value = "";
        row.classList.add("bye");
      };
      list.append(row);
    });

    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }

    const count = teams.filter(Boolean).length;
    if (summary) {
      summary.textContent = `Hlavné mužské nasadenie z hárku „${result.sheetName}": ${count} dvojíc, ${MAX_SEEDS - count} BYE. Kvalifikácia Q a ženy boli ignorované.`;
    }
    section.classList.remove("hidden");
    showMessage(`Načítané hlavné mužské nasadenie: ${count} dvojíc, ${MAX_SEEDS - count} BYE. Vytváram pavúka…`, "ok");
  }

  input.onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isExcel = /\.xlsx?$/i.test(file.name) || /spreadsheetml|ms-excel/.test(file.type);
    if (!isExcel) return originalHandler?.call(input, event);

    showMessage("Načítavam hlavnú tabuľku MUŽI / MEN z Excelu…");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      renderReview(extractAuthoritativeMenSeeding(workbook));
    } catch (error) {
      console.error(error);
      showMessage(`Chyba: ${error.message}`, "err");
    } finally {
      event.target.value = "";
    }
  };
})();
