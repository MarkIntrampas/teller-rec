// content.js — injected into every page
// Listens for extraction requests from background/popup

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extract") {
    const result = extractElements();
    sendResponse(result);
  }
  return true; // keep channel open for async
});

function extractElements() {
  const timestamp = new Date().toISOString();
  const pageUrl = window.location.href;
  const pageTitle = document.title;

  // ── H1 elements ──────────────────────────────────────────────
  const h1Elements = Array.from(document.querySelectorAll("h1")).map((el, i) => ({
    index: i + 1,
    text: el.innerText.trim(),
    id: el.id || null,
    classes: el.className || null,
  }));

  // ── SPAN elements ─────────────────────────────────────────────
  const spanElements = Array.from(document.querySelectorAll("span")).map((el, i) => ({
    index: i + 1,
    text: el.innerText.trim().slice(0, 300), // cap long spans
    id: el.id || null,
    classes: el.className || null,
  })).filter(s => s.text.length > 0); // skip empty spans

  // ── TABLE elements ────────────────────────────────────────────
  const tableElements = Array.from(document.querySelectorAll("table")).map((table, tIdx) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((row, rIdx) => {
      const cells = Array.from(row.querySelectorAll("th, td")).map(cell => cell.innerText.trim());
      return { rowIndex: rIdx + 1, cells };
    });
    return {
      tableIndex: tIdx + 1,
      id: table.id || null,
      classes: table.className || null,
      rowCount: rows.length,
      colCount: rows[0]?.cells.length || 0,
      rows,
    };
  });

  return {
    timestamp,
    pageUrl,
    pageTitle,
    h1Count: h1Elements.length,
    spanCount: spanElements.length,
    tableCount: tableElements.length,
    h1Elements,
    spanElements,
    tableElements,
  };
}
