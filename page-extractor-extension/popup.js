// popup.js

const slider = document.getElementById("intervalSlider");
const display = document.getElementById("intervalDisplay");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnNow = document.getElementById("btnNow");
const btnSave = document.getElementById("btnSave");
const statusDot = document.getElementById("statusDot");
const toast = document.getElementById("toast");

const statH1 = document.getElementById("statH1");
const statSpan = document.getElementById("statSpan");
const statTable = document.getElementById("statTable");
const statTotal = document.getElementById("statTotal");

const sbUrl = document.getElementById("sbUrl");
const sbKey = document.getElementById("sbKey");
const tbName1 = document.getElementById("tbName1");
const tbName2 = document.getElementById("tbName2");
const tbName3 = document.getElementById("tbName3");

const uploadStatus = document.getElementById("uploadStatus");
const uploadRows = document.getElementById("uploadRows");

let toastTimer;

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("panel" + capitalise(tab.dataset.tab)).classList.add("active");
  });
});

function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Utility ───────────────────────────────────────────────────
function formatSeconds(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60 > 0 ? (s % 60) + "s" : ""}`.trim();
  return `${Math.floor(s / 3600)}h`;
}

function showToast(msg, type = "success") {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function setRunningUI(running) {
  statusDot.classList.toggle("active", running);
  btnStart.style.display = running ? "none" : "flex";
  btnStop.style.display = running ? "flex" : "none";
}

function updatePresetHighlight(val) {
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.val) === val);
  });
}

function renderUploadStatus(upload) {
  if (!upload || upload.skipped) {
    uploadStatus.style.display = "none";
    return;
  }
  uploadStatus.style.display = "block";
  uploadRows.innerHTML = "";
  (upload.results || []).forEach(r => {
    const div = document.createElement("div");
    div.className = "sb-row";
    const label = document.createElement("span");
    label.className = "sb-row-label";
    label.textContent = r.table;
    const val = document.createElement("span");
    val.className = "sb-row-val";
    if (r.skipped) {
      val.className += " skip";
      val.textContent = `— ${r.reason}`;
    } else if (r.ok) {
      val.className += " ok";
      val.textContent = `✓ ${r.rows} row${r.rows !== 1 ? "s" : ""} inserted`;
    } else {
      val.className += " fail";
      val.textContent = `✗ ${r.status || "error"}`;
      div.title = r.error || "";
    }
    div.appendChild(label);
    div.appendChild(val);
    uploadRows.appendChild(div);
  });
}

// ── Slider ────────────────────────────────────────────────────
slider.addEventListener("input", () => {
  const val = parseInt(slider.value);
  display.textContent = formatSeconds(val);
  updatePresetHighlight(val);
});

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const val = parseInt(btn.dataset.val);
    slider.value = val;
    display.textContent = formatSeconds(val);
    updatePresetHighlight(val);
  });
});

// ── Start / Stop ──────────────────────────────────────────────
btnStart.addEventListener("click", () => {
  const secs = parseInt(slider.value);
  chrome.runtime.sendMessage({ action: "startInterval", intervalSeconds: secs }, () => {
    setRunningUI(true);
    showToast(`✓ Auto-extract every ${formatSeconds(secs)}`);
  });
});

btnStop.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stopInterval" }, () => {
    setRunningUI(false);
    showToast("Stopped", "error");
  });
});

// ── Extract Now ───────────────────────────────────────────────
btnNow.addEventListener("click", () => {
  btnNow.disabled = true;
  btnNow.textContent = "Extracting…";

  chrome.runtime.sendMessage({ action: "extractNow" }, (res) => {
    btnNow.disabled = false;
    btnNow.textContent = "↓ Extract Now";

    if (res?.ok) {
      const s = res.summary;
      statH1.textContent = s.h1;
      statSpan.textContent = s.spans;
      statTable.textContent = s.tables;
      renderUploadStatus(res.upload);
      refreshTotal();

      const uploadMsg = res.upload?.results
        ? ` · ${res.upload.results.filter(r => r.ok).length}/${res.upload.results.length} tables uploaded`
        : "";
      showToast(`✓ ${s.h1} H1s · ${s.spans} spans · ${s.tables} tables${uploadMsg}`);
    } else {
      showToast(res?.error || "Extraction failed", "error");
    }
  });
});

// ── Save Supabase settings ────────────────────────────────────
btnSave.addEventListener("click", () => {
  const url = sbUrl.value.trim().replace(/\/$/, "");
  const key = sbKey.value.trim();
  const tableNames = [
    tbName1.value.trim() || "table_1",
    tbName2.value.trim() || "table_2",
    tbName3.value.trim() || "table_3",
  ];

  if (!url || !key) {
    showToast("URL and Key are required", "error");
    return;
  }

  chrome.runtime.sendMessage({ action: "saveSupabase", supabaseUrl: url, supabaseKey: key, tableNames }, (res) => {
    if (res?.ok) showToast("✓ Supabase settings saved");
  });
});

// ── Init ──────────────────────────────────────────────────────
chrome.runtime.sendMessage({ action: "getStatus" }, (status) => {
  if (!status) return;
  if (status.running) {
    setRunningUI(true);
    const secs = status.intervalSeconds || 30;
    slider.value = secs;
    display.textContent = formatSeconds(secs);
    updatePresetHighlight(secs);
  }
  statTotal.textContent = status.extractionCount || 0;
});

chrome.runtime.sendMessage({ action: "getSupabase" }, (cfg) => {
  if (!cfg) return;
  if (cfg.supabaseUrl) sbUrl.value = cfg.supabaseUrl;
  if (cfg.supabaseKey) sbKey.value = cfg.supabaseKey;
  if (cfg.tableNames) {
    tbName1.value = cfg.tableNames[0] || "";
    tbName2.value = cfg.tableNames[1] || "";
    tbName3.value = cfg.tableNames[2] || "";
  }
});

function refreshTotal() {
  chrome.storage.local.get(["extractionCount"], (data) => {
    statTotal.textContent = data.extractionCount || 0;
  });
}
