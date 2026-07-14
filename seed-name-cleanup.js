(() => {
  "use strict";

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cleanPlayerName(player) {
    const text = String(player ?? "").replace(/\s+/g, " ").trim();
    if (!text) return text;

    const words = text.split(" ");
    if (words.length % 2 === 0) {
      const half = words.length / 2;
      const first = words.slice(0, half).join(" ");
      const second = words.slice(half).join(" ");
      if (normalize(first) === normalize(second)) return first;
    }
    return text;
  }

  function cleanTeamName(team) {
    if (typeof team !== "string" || !team.includes("/")) return team;
    return team.split("/").map(cleanPlayerName).join(" / ");
  }

  function cleanImportedTeams() {
    if (typeof TEAMS !== "object" || !TEAMS) return;
    Object.keys(TEAMS).forEach((seed) => {
      TEAMS[seed] = cleanTeamName(TEAMS[seed]);
    });
  }

  const originalRender = window.render;
  if (typeof originalRender === "function") {
    window.render = function (...args) {
      cleanImportedTeams();
      return originalRender.apply(this, args);
    };
  }

  window.SeedNameCleanup = { cleanPlayerName, cleanTeamName, cleanImportedTeams };
})();
