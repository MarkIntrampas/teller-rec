// background.js — service worker
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseInsertNow = createClient(
  "https://ccgrfcxtlzqurypyfcrs.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZ3JmY3h0bHpxdXJ5cHlmY3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjgyMjUsImV4cCI6MjA5MTIwNDIyNX0.eEbdj3zFUjrYWRXTqj9rx0P6grHTt-Mw_D3SiKvhfUw"
);

const ALARM_NAME = "auto-extract";

// ── Alarm triggered → extract from active tab ─────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const result = await extractNow();
   chrome.runtime.sendMessage({
    action: "alarmResult",
    ...result
  });

    if (!result.ok) {
    console.log("Alarm extraction skipped:", result.error);
  }

});

// ── Messages from popup ───────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startInterval") {
    startAlarm(message.intervalSeconds);
    sendResponse({ ok: true });
  } else if (message.action === "stopInterval") {
    stopAlarm();
    sendResponse({ ok: true });
  } else if (message.action === "extractNow") {
    extractNow().then(sendResponse);
    return true;
  } else if (message.action === "getStatus") {
    getStatus().then(sendResponse);
    return true;
  } else if (message.action === "saveSupabase") {
    chrome.storage.local.set({
      supabaseUrl: message.supabaseUrl,
      supabaseKey: message.supabaseKey,
      tableNames: message.tableNames,
    }, () => sendResponse({ ok: true }));
    return true;
  } else if (message.action === "getSupabase") {
    chrome.storage.local.get(["supabaseUrl", "supabaseKey", "tableNames"], sendResponse);
    return true;
  }
});




async function extractNow() {


  const tabs = await chrome.tabs.query({});

const tellerTab = tabs.find(tab =>
  tab.url === "https://secure.go2ubl.nl/statistics/dataEntryTypeCounter?key=3ba13374-67c7-44b3-b45a-e9e8f61a3315"
);

if (!tellerTab?.id) {
  return { ok: false, error: "No Teller tab" };
}

console.log("Found teller tab:", tellerTab.id, tellerTab.index);


  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "No active tab" };

  try {
    const [result] = await chrome.scripting.executeScript({
       target: { tabId: tellerTab.id },
      func: extractElementsInPage,
    });

    if (result?.result) {
      const data = result.result;
      if(data.pageUrl===String("https://secure.go2ubl.nl/statistics/dataEntryTypeCounter?key=3ba13374-67c7-44b3-b45a-e9e8f61a3315")){
      const text = formatAsText(data);
    await triggerDownload(text, buildFilename(data));
     

    if (await hasRecordForThisHour()) {
    return { ok: false, error: "THERE'S RECORD FOR THIS HOUR" };
}


     const uploadResult = await uploadToSupabase(data);
      await incrementCounter();
      return {
        ok: true,
        summary: { h1: data.h1Count, spans: data.spanCount, tables: data.tableCount },
        upload: uploadResult,
      };
      }else{
          return { ok: false, error: "NOT a Filipijnen Teller" };
      }
    }
    return { ok: false, error: "No data returned" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}



async function uploadToSupabase(data) {

  const lines = [];
  const table1 = [];


  const refId = await createRefId();

  console.log("ID:", refId);

  if (data.tableElements.length === 0) {
    console.log("no tables");
    return;
  }


  for (const table of data.tableElements) {

    console.log(table.tableIndex);

    for (const [rowIndex, row] of table.rows.entries()) {

      const rowStr = row.cells
        .map(c => String(c).padEnd(20).slice(0,20))
        .join(" | ");


      if (table.tableIndex === 1) {

        const cells = rowStr
          .split(" | ")
          .map(c => c.trim());

        table1.push(cells[1]);

        if(table1.length >= 3){
          await Table1(table1, refId);
        }

      }


      if (table.tableIndex === 2 && rowIndex > 0) {

           await  Table2(rowStr, refId);

      }


      if (table.tableIndex === 3 && rowIndex > 0) {

          const cells = rowStr
          .split(" | ")
          .map(c => c.trim());

        await Table3(cells, refId);
        

      }

    }
  }
}

async function Table1(row, id){

  console.log(row);



           const { error } = await supabaseInsertNow
                        .from('SUMMARY_TOP')
                        .insert([
                            {
                                PreprocessToDo:row[0],
                                ValidateToDo:row[1],
                                QualitycheckToDo:row[2],
                                RecordRef: parseInt(id),
                            }
                        ]);

                    if (error) {
                        console.log("error top data upload");
                        throw error;
                    }

}

async function hasRecordForThisHour(){
    const { data, error } = await supabaseInsertNow
  .from('Data_Record_Reference')
  .select('*')
  .order('id', { ascending: false })
  .limit(1)
  .single();  

  return (isPastHour(data.created_at));
  
}




function isPastHour(created_date) {
    const created = new Date(created_date);
    if (isNaN(created.getTime())) return false;

    const timeZone = "Asia/Taipei";

    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false
    });

    const createdParts = fmt.formatToParts(created);
    
    const nowParts = fmt.formatToParts(new Date());

    const get = (parts, type) =>
        parts.find(p => p.type === type)?.value;

    const sameDay =
        get(createdParts, "year") === get(nowParts, "year") &&
        get(createdParts, "month") === get(nowParts, "month") &&
        get(createdParts, "day") === get(nowParts, "day");

    const sameHour =
        get(createdParts, "hour") === get(nowParts, "hour");

    // ❌ invalid only if SAME day AND SAME hour in Taipei
    return (sameDay && sameHour);
}



async function Table2(row2, ref){
 
  const row = row2
  .split(" | ")
  .map(c => c.trim());




 const { error } = await supabaseInsertNow
                        .from('RECORD_DETAILS')
                        .insert([
                            {
                                Num:row[0],
                                Name:row[1],
                                LastHour:row[2],
                                Todo:row[3],
                                Total:row[4],
                                EndOfDayTotal:row[5],
                                InactivityTime:row[6],
                                PauseTime:row[7],
                                RecordRef: parseInt(ref),
                            }
                        ]);

                    if (error) {
                        console.log("error  details data upload: ", error);
                        throw error;
                    }




}


async function Table3(row, id){
  console.log(row);

   const { error } = await supabaseInsertNow
                        .from('Bottom_Record')
                        .insert([
                            {
                                SolutionGroup:row[0],
                                LastHour:row[1],
                                Todo:row[2],
                                Total:row[3],
                                ref: parseInt(id),
                            }
                        ]);

                    if (error) {
                        console.log("error bottom data upload: ", error);
                        throw error;
                    }

}

// ── Supabase Upload ───────────────────────────────────────────
async function createRefId() {
   console.log("upload");

  const { data: insertedRow, error } = await supabaseInsertNow
    .from("Data_Record_Reference")
    .insert([{}])
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return null;
  }

  

  return insertedRow.id;


      /*
      console.log("supabase");
      const cfg = await chrome.storage.local.get(["supabaseUrl", "supabaseKey", "tableNames"]);
      const { supabaseUrl, supabaseKey, tableNames } = cfg;

      if (!supabaseUrl || !supabaseKey) {
        return { skipped: true, reason: "No Supabase credentials configured" };
      }

      const names = tableNames || ["table_1", "table_2", "table_3"];
      // Only take the first 3 tables, ignore the rest
      const tables = data.tableElements.slice(0, 3);

      if (tables.length === 0) {
        return { skipped: true, reason: "No tables found on page" };
      }

      const results = [];

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const targetTable = names[i] || `table_${i + 1}`;

        // Use first row as headers if available, otherwise col_1, col_2 ...
        const firstRow = table.rows[0];
        if (!firstRow || firstRow.cells.length === 0) {
          results.push({ table: targetTable, skipped: true, reason: "Empty table" });
          continue;
        }

        const headers = firstRow.cells.map((h, idx) => {
          const clean = h.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || `col_${idx + 1}`;
          return clean;
        });

        // Data rows (skip header row)
        const dataRows = table.rows.slice(1).map(row => {
          const record = {
            _source_url: data.pageUrl,
            _extracted_at: data.timestamp,
          };
          headers.forEach((h, idx) => {
            record[h] = row.cells[idx] ?? null;
          });
          return record;
        });

        if (dataRows.length === 0) {
          results.push({ table: targetTable, skipped: true, reason: "No data rows (header only)" });
          continue;
        }

        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/${targetTable}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Prefer": "return=minimal",
            },
            body: JSON.stringify(dataRows),
          });

          if (res.ok) {
            results.push({ table: targetTable, ok: true, rows: dataRows.length });
          } else {
            const errText = await res.text();
            results.push({ table: targetTable, ok: false, status: res.status, error: errText });
          }
        } catch (err) {
          results.push({ table: targetTable, ok: false, error: err.message });
        }
      }

      return { results };*/

}

function startAlarm(seconds) {
  chrome.alarms.clear(ALARM_NAME, () => {
    const periodInMinutes = seconds / 60;
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: periodInMinutes,
      periodInMinutes: periodInMinutes,
    });
    chrome.storage.local.set({ running: true, intervalSeconds: seconds });
  });
}

function stopAlarm() {
  chrome.alarms.clear(ALARM_NAME);
  chrome.storage.local.set({ running: false });
}

async function getStatus() {
  return new Promise(resolve => {
    chrome.storage.local.get(["running", "intervalSeconds", "extractionCount"], resolve);
  });
}

async function incrementCounter() {
  const data = await chrome.storage.local.get(["extractionCount"]);
  const count = (data.extractionCount || 0) + 1;
  await chrome.storage.local.set({ extractionCount: count });
}

async function triggerDownload(text, filename) {
  const base64 = btoa(unescape(encodeURIComponent(text)));
  const url = `data:text/plain;base64,${base64}`;
  return new Promise(resolve => {
    chrome.downloads.download({ url, filename, saveAs: false }, resolve);
  });
}

function buildFilename(data) {
  const ts = data.timestamp.replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const host = new URL(data.pageUrl).hostname.replace(/\./g, "_") || "page";
  return `extraction_${host}_${ts}.txt`;
}

function formatAsText(data) {
  const lines = [];
  const divider = "═".repeat(70);
  const thin = "─".repeat(70);

  lines.push(divider);
  lines.push("  PAGE ELEMENT EXTRACTION REPORT");
  lines.push(divider);
  lines.push(`  Extracted : ${data.timestamp}`);
  lines.push(`  Page      : ${data.pageTitle}`);
  lines.push(`  URL       : ${data.pageUrl}`);
  lines.push(`  H1s found : ${data.h1Count}`);
  lines.push(`  Spans     : ${data.spanCount}`);
  lines.push(`  Tables    : ${data.tableCount}`);
  lines.push(divider);
  lines.push("");

  lines.push("▌ H1 ELEMENTS");
  lines.push(thin);
  if (data.h1Elements.length === 0) {
    lines.push("  (none found)");
  } else {
    data.h1Elements.forEach(el => {
      lines.push(`  [${el.index}] ${el.text}`);
      if (el.id) lines.push(`       id="${el.id}"`);
      if (el.classes) lines.push(`       class="${el.classes}"`);
    });
  }
  lines.push("");

  lines.push("▌ SPAN ELEMENTS");
  lines.push(thin);
  if (data.spanElements.length === 0) {
    lines.push("  (none found)");
  } else {
    data.spanElements.forEach(el => {
      lines.push(`  [${el.index}] ${el.text}`);
      if (el.id) lines.push(`       id="${el.id}"`);
      if (el.classes) lines.push(`       class="${el.classes}"`);
    });
  }
  lines.push("");

  lines.push("▌ TABLE ELEMENTS");
  lines.push(thin);
  if (data.tableElements.length === 0) {
    lines.push("  (none found)");
  } else {
    data.tableElements.forEach(table => {
      lines.push(`  TABLE [${table.tableIndex}]  —  ${table.rowCount} rows × ${table.colCount} cols`);
      if (table.id) lines.push(`    id="${table.id}"`);
      if (table.classes) lines.push(`    class="${table.classes}"`);
      lines.push("");
      table.rows.forEach(row => {
        const rowStr = row.cells.map(c => c.padEnd(20).slice(0, 20)).join(" | ");
        lines.push(`    ${String(row.rowIndex).padStart(3)}  ${rowStr}`);
      });
      lines.push("");
    });
  }

  lines.push(divider);
  lines.push("  END OF REPORT");
  lines.push(divider);

  return lines.join("\n");
}

// ── Injected into page ────────────────────────────────────────
function extractElementsInPage() {
  const timestamp = new Date().toISOString();
  const pageUrl = window.location.href;
  const pageTitle = document.title;

  const h1Elements = Array.from(document.querySelectorAll("h1")).map((el, i) => ({
    index: i + 1, text: el.innerText.trim(), id: el.id || null, classes: el.className || null,
  }));

  const spanElements = Array.from(document.querySelectorAll("span")).map((el, i) => ({
    index: i + 1, text: el.innerText.trim().slice(0, 300), id: el.id || null, classes: el.className || null,
  })).filter(s => s.text.length > 0);

  const tableElements = Array.from(document.querySelectorAll("table")).map((table, tIdx) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((row, rIdx) => {
      const cells = Array.from(row.querySelectorAll("th, td")).map(cell => cell.innerText.trim());
      return { rowIndex: rIdx + 1, cells };
    });
    return {
      tableIndex: tIdx + 1, id: table.id || null, classes: table.className || null,
      rowCount: rows.length, colCount: rows[0]?.cells.length || 0, rows,
    };
  });

  return {
    timestamp, pageUrl, pageTitle,
    h1Count: h1Elements.length, spanCount: spanElements.length, tableCount: tableElements.length,
    h1Elements, spanElements, tableElements,
  };
}
