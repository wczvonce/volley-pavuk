(() => {
  "use strict";

  const input = document.getElementById("seedImageInput");
  const rows = document.getElementById("seedRows");
  const createButton = document.getElementById("seedCreate");
  if (!input || !rows || !createButton) return;

  let pendingExcel = false;
  let creating = false;

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    pendingExcel = !!file && (/\.xlsx?$/i.test(file.name) || /spreadsheetml|ms-excel/.test(file.type));
    creating = false;
  });

  new MutationObserver(() => {
    if (!pendingExcel || creating) return;
    const importedRows = rows.querySelectorAll(".seed-row");
    if (importedRows.length !== 16) return;

    creating = true;
    setTimeout(() => {
      pendingExcel = false;
      createButton.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }).observe(rows, { childList: true });
})();
