# Page Element Extractor — Chrome Extension

Automatically extracts **H1 headings**, **SPAN elements**, and **TABLE data**
from any web page, saving each extraction as a downloadable `.txt` file.

---

## Installation (Chrome / Edge / Brave)

1. Open your browser and go to: `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `page-extractor-extension` folder
5. The extension icon (⛏) will appear in your toolbar

---

## How to Use

### Auto-Extract (Interval Mode)
1. Click the extension icon to open the popup
2. Use the **slider** or **preset buttons** to choose an interval (10s → 1hr)
3. Click **▶ Start Auto-Extract**
4. The status dot turns green and pulses — extractions fire automatically
5. Each extraction downloads a `.txt` file to your default Downloads folder
6. Click **■ Stop** to halt

### Manual Extract
- Click **↓ Extract Now** at any time to trigger an immediate extraction
- A summary shows how many H1s, Spans, and Tables were found

---

## Output File Format

Files are named:  
`extraction_<hostname>_<YYYY-MM-DD>_<HH-MM-SS>.txt`

Each file contains:
- Page URL and title
- Timestamp of extraction
- All **H1** elements (text content, id, classes)
- All non-empty **SPAN** elements (first 300 chars each)
- All **TABLE** elements (full row/cell data, formatted as columns)

---

## Permissions Used

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab's content |
| `scripting` | Inject the extraction script into pages |
| `downloads` | Save `.txt` files to your Downloads folder |
| `storage` | Persist interval settings and extraction count |
| `alarms` | Fire extractions on a reliable timer (even when popup is closed) |

---

## Notes

- Extraction continues **even when the popup is closed** — the background
  service worker handles the alarm
- The interval counter persists across browser sessions
- Very large pages with thousands of spans may produce large text files
