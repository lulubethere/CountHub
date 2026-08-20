const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const shell = require("electron").shell;
const { execFile } = require("child_process");
const { pathToFileURL } = require("url");
const db = require("./db.js");
const fs = require("fs");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");
const XlsxPopulate = require("xlsx-populate");

let mainWindow;
const DATE_LABELS = ["입고예정일", "출고예정일"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildStatementRowsHtml(rows) {
  const body = rows
    .map(
      (row, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.sku)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.expiry)}</td>
          <td>${escapeHtml(row.lot)}</td>
          <td>${escapeHtml(row.barcode)}</td>
          <td>${escapeHtml(row.qty)}</td>
          <td>${escapeHtml(row.box)}</td>
        </tr>`,
    )
    .join("");

  return `
    <table class="statement-table">
      <thead>
        <tr>
          <th>No</th>
          <th>SKU</th>
          <th>상품명</th>
          <th>유통기한</th>
          <th>LOT</th>
          <th>바코드</th>
          <th>수량</th>
          <th>박스</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function buildStatementMetaHtml(meta) {
  return `
    <div class="meta-grid">
      <div><span class="meta-label">셀러</span><span class="meta-value">${escapeHtml(meta.sellerName)}</span></div>
      <div><span class="meta-label">쇼핑몰</span><span class="meta-value">${escapeHtml(meta.shopName)}</span></div>
      <div><span class="meta-label">출고예정일</span><span class="meta-value">${escapeHtml(meta.dateValue)}</span></div>
      <div><span class="meta-label">입고지명</span><span class="meta-value">${escapeHtml(meta.inboundPlaceName)}</span></div>
      <div><span class="meta-label">주소</span><span class="meta-value">${escapeHtml(meta.inboundAddress)}</span></div>
      <div><span class="meta-label">담당자명</span><span class="meta-value">${escapeHtml(meta.inboundManager)}</span></div>
      <div><span class="meta-label">전화번호</span><span class="meta-value">${escapeHtml(meta.inboundPhone)}</span></div>
    </div>`;
}

function buildStatementPreviewHtml(previewPages, title) {
  const pagesHtml = previewPages
    .map((page, index) => {
      const metaHtml = buildStatementMetaHtml(page.meta);
      const tableHtml = buildStatementRowsHtml(page.rows);
      const repeatedSection =
        page.templateType === "h"
          ? `<div class="repeat-block">${metaHtml}${tableHtml}</div>`
          : "";

      return `
        <section class="page">
          <div class="page-title">${escapeHtml(title)} - ${index + 1} / ${previewPages.length}</div>
          <div class="sheet-badge">${page.templateType.toUpperCase()} Sheet Preview</div>
          ${metaHtml}
          ${tableHtml}
          ${repeatedSection}
        </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { margin: 0; font-family: Arial, sans-serif; background: #eef2f7; color: #111827; }
    .toolbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; background: rgba(255,255,255,0.95); border-bottom: 1px solid #dbe2ea; }
    .toolbar button { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; font-weight: 700; }
    .toolbar button.primary { background: #111827; color: #fff; border-color: #111827; }
    .preview-wrap { padding: 18px; display: flex; flex-direction: column; gap: 18px; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12); padding: 12mm; box-sizing: border-box; }
    .page-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
    .sheet-badge { display: inline-block; margin-bottom: 12px; padding: 4px 10px; border-radius: 999px; background: #fff7ed; color: #c2410c; font-size: 12px; font-weight: 700; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-bottom: 14px; }
    .meta-grid div { display: flex; gap: 8px; font-size: 12px; line-height: 1.5; }
    .meta-label { min-width: 70px; font-weight: 700; color: #4b5563; }
    .meta-value { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; }
    .statement-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
    .statement-table th, .statement-table td { border: 1px solid #1f2937; padding: 5px 6px; vertical-align: middle; word-break: break-word; }
    .statement-table th { background: #f3f4f6; }
    .repeat-block { margin-top: 18px; padding-top: 18px; border-top: 2px dashed #cbd5e1; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .preview-wrap { padding: 0; gap: 0; }
      .page { box-shadow: none; margin: 0; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.close()">닫기</button>
    <button class="primary" onclick="window.print()">인쇄</button>
  </div>
  <div class="preview-wrap">${pagesHtml}</div>
</body>
</html>`;
}

function openStatementPreviewWindow(previewPages, title) {
  if (!previewPages || !previewPages.length) return null;
  const previewWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
    },
  });
  previewWindow.loadURL(
    `data:text/html;charset=UTF-8,${encodeURIComponent(
      buildStatementPreviewHtml(previewPages, title),
    )}`,
  );
  return previewWindow;
}

function exportExcelToPdf(xlsxPath, pdfPath) {
  const scriptPath = path.join(app.getPath("temp"), "counthub-export-pdf.ps1");
  const script = `
param([string]$xlsxPath, [string]$pdfPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$excel = $null
$workbook = $null

try {
  $xlsxPath = [System.IO.Path]::GetFullPath($xlsxPath)
  $pdfPath = [System.IO.Path]::GetFullPath($pdfPath)

  if (-not (Test-Path -LiteralPath $xlsxPath)) {
    throw "입력 파일을 찾을 수 없습니다: $xlsxPath"
  }

  Start-Sleep -Milliseconds 300

  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $workbook = $excel.Workbooks.Open($xlsxPath, 0, $true)
  $xlTypePdf = 0
  $workbook.ExportAsFixedFormat($xlTypePdf, $pdfPath)
}
finally {
  if ($workbook -ne $null) {
    $workbook.Close($false) | Out-Null
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
  }
  if ($excel -ne $null) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`;

  fs.writeFileSync(scriptPath, script, "utf8");

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        xlsxPath,
        pdfPath,
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        timeout: 120000,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = String(stderr || stdout || error.message || "").trim();
          reject(
            new Error(
              detail ||
                "Excel PDF 변환에 실패했습니다. Microsoft Excel 설치 여부를 확인해주세요.",
            ),
          );
          return;
        }

        resolve(pdfPath);
      },
    );
  });
}

function openPdfPreviewWindow(pdfPath, title) {
  const previewWindow = new BrowserWindow({
    width: 1400,
    height: 980,
    autoHideMenuBar: true,
    title,
    webPreferences: {
      contextIsolation: true,
      plugins: true,
    },
  });

  previewWindow.loadURL(pathToFileURL(pdfPath).toString());
  return previewWindow;
}

function isBusyFileError(error) {
  const code = String(error?.code || "").toUpperCase();
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

function buildIndexedFilePath(targetPath, index) {
  const ext = path.extname(targetPath);
  const baseName = path.basename(targetPath, ext);
  const dirName = path.dirname(targetPath);
  return path.join(dirName, `${baseName} (${index})${ext}`);
}

function writeBufferToAvailablePath(buffer, targetPath, maxAttempts = 30) {
  let lastError = null;

  for (let index = 0; index <= maxAttempts; index += 1) {
    const candidatePath =
      index === 0 ? targetPath : buildIndexedFilePath(targetPath, index);

    try {
      fs.writeFileSync(candidatePath, Buffer.from(buffer));
      return candidatePath;
    } catch (error) {
      lastError = error;
      if (!isBusyFileError(error)) throw error;
    }
  }

  throw lastError || new Error("엑셀 양식을 저장하지 못했습니다.");
}

async function buildItemLocationTemplateBuffer(groups = []) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("품목위치등록");
  worksheet.addRow(["품명", "그룹", "위치", "메모"]);
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns = [
    { width: 28 },
    { width: 18 },
    { width: 22 },
    { width: 28 },
  ];
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const normalizedGroups = Array.from(
    new Set(
      (groups || [])
        .map((group) => String(group || "").trim())
        .filter(Boolean),
    ),
  );

  if (normalizedGroups.length) {
    const hiddenSheet = workbook.addWorksheet("__groups");
    normalizedGroups.forEach((group, index) => {
      hiddenSheet.getCell(`A${index + 1}`).value = group;
    });
    hiddenSheet.state = "veryHidden";

    for (let rowIndex = 2; rowIndex <= 500; rowIndex += 1) {
      worksheet.getCell(`B${rowIndex}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`'__groups'!$A$1:$A$${normalizedGroups.length}`],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "그룹 선택 오류",
        error: "등록된 그룹만 선택할 수 있습니다.",
        promptTitle: "그룹 선택",
        prompt: "드롭다운에서 등록된 그룹을 선택해주세요.",
        showInputMessage: true,
      };
    }
  }

  return workbook.xlsx.writeBuffer();
}

async function ensureItemLocationTemplateStored(groups = []) {
  const buffer = await buildItemLocationTemplateBuffer(groups);
  await db.saveItemLocationExcelTemplate(
    Buffer.from(buffer),
    "품목위치_다중등록_양식.xlsx",
  );
  return db.getItemLocationExcelTemplate();
}

async function readItemLocationBulkExcel(filePath) {
  if (!filePath) {
    throw new Error("엑셀 파일 경로가 없습니다.");
  }

  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xls") {
    const tempXls = XLSX.readFile(filePath);
    const buffer = XLSX.write(tempXls, { type: "buffer", bookType: "xlsx" });
    await workbook.xlsx.load(buffer);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("엑셀 시트를 찾지 못했습니다.");
  }

  const headerRow = sheet.getRow(1);
  const headers = [];
  for (let i = 1; i <= 4; i += 1) {
    headers.push(String(headerRow.getCell(i).value || "").trim());
  }
  if (headers.join("|") !== "품명|그룹|위치|메모") {
    throw new Error("양식 첫 행은 품명, 그룹, 위치, 메모 순서여야 합니다.");
  }

  const rows = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const productName = String(row.getCell(1).text || "").trim();
    const groupName = String(row.getCell(2).text || "").trim();
    const location = String(row.getCell(3).text || "").trim();
    const note = String(row.getCell(4).text || "").trim();
    if (!productName && !groupName && !location && !note) continue;
    rows.push({
      rowNumber,
      productName,
      groupName,
      location,
      note,
    });
  }

  return rows;
}

async function buildItemLocationBulkPreview(filePath, workerName, groups = []) {
  const rows = await readItemLocationBulkExcel(filePath);
  if (!rows.length) {
    return { ok: false, error: "등록할 데이터가 없습니다." };
  }

  const allowedGroups = new Set(
    (groups || [])
      .map((group) => String(group || "").trim())
      .filter(Boolean),
  );
  const duplicateRowSet = new Set();
  const summaryMap = new Map();
  const rowKeyMap = new Map();

  for (const row of rows) {
    if (!row.productName || !row.groupName || !row.location) {
      return {
        ok: false,
        error: `${row.rowNumber}행의 품명, 그룹, 위치를 확인해주세요.`,
      };
    }

    if (allowedGroups.size && !allowedGroups.has(row.groupName)) {
      return {
        ok: false,
        error: `${row.rowNumber}행의 그룹이 등록된 목록에 없습니다.`,
      };
    }

    const rowKey = `${row.productName}__${row.location}`;
    const existingRowNumbers = rowKeyMap.get(rowKey) || [];
    if (existingRowNumbers.length) {
      existingRowNumbers.forEach((rowNumber) => duplicateRowSet.add(rowNumber));
      duplicateRowSet.add(row.rowNumber);
    }
    existingRowNumbers.push(row.rowNumber);
    rowKeyMap.set(rowKey, existingRowNumbers);

    const duplicate = await db.findDuplicateItemLocation(
      row.productName,
      row.location,
      null,
    );
    if (duplicate) duplicateRowSet.add(row.rowNumber);

    const summaryKey = `${row.groupName}__${row.productName}`;
    const current = summaryMap.get(summaryKey) || {
      groupName: row.groupName,
      productName: row.productName,
      count: 0,
      isDuplicate: false,
    };
    current.count += 1;
    if (duplicate || existingRowNumbers.length > 1) current.isDuplicate = true;
    summaryMap.set(summaryKey, current);
  }

  const duplicateRows = Array.from(duplicateRowSet).sort((a, b) => a - b);

  return {
    ok: true,
    rows: rows.map((row) => ({
      productName: row.productName,
      groupName: row.groupName,
      location: row.location,
      note: row.note,
      workerName,
    })),
    duplicateRows,
    summary: Array.from(summaryMap.values()),
  };
}

async function saveWorkbookOrThrowBusy(workbook, targetPath) {
  try {
    await workbook.toFileAsync(targetPath);
    return targetPath;
  } catch (error) {
    if (!isBusyFileError(error)) throw error;
    throw new Error(
      "같은 이름의 엑셀 파일이 현재 열려 있습니다. 파일을 닫은 뒤 다시 저장해주세요.",
    );
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 785,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile("html/02 login.html");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- IPC 핸들러 (DB 목록 로직) ---
ipcMain.handle("login", async (_, name) => {
  try {
    const user = await db.findUserByName(name);
    if (!user) return { ok: false, error: "등록된 이름이 아닙니다." };
    return { ok: true, user: { id: user.id, name: user.username } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("get-sellers", async () => {
  try {
    return { ok: true, data: await db.getSellers() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-product-types", async () => {
  try {
    return { ok: true, data: await db.getProductTypes() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-centers", async () => {
  try {
    return { ok: true, data: await db.getCenters() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-inbound-centers", async () => {
  try {
    return { ok: true, data: await db.getInboundCenters() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle("get-inbound-center-detail", async (_, id) => {
  try {
    const data = await db.getInboundCenterDetail(id);
    return data ? { ok: true, data } : { ok: false, error: "입고지 정보를 찾을 수 없습니다." };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle("get-shops", async () => {
  try {
    return { ok: true, data: await db.getShops() };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-form", async () => {
  try {
    return { ok: true, data: await db.getForm() };
  } catch (e) {
    return { ok: false };
  }
});

ipcMain.handle("get-code-master-list", async (_, payload) => {
  try {
    const parentCode = Number(payload?.parentCode);
    if (!parentCode) return { ok: false, error: "parent_code가 없습니다." };
    return { ok: true, data: await db.getCodeMasterList(parentCode) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("save-code-master-item", async (_, payload) => {
  try {
    const parentCode = Number(payload?.parentCode);
    const code = payload?.code;
    const name = payload?.name;
    const sortOrder =
      payload?.sortOrder === null || payload?.sortOrder === undefined
        ? null
        : Number(payload.sortOrder);
    const savedCode = await db.saveCodeMasterItem(parentCode, code, name, sortOrder);
    return savedCode ? { ok: true, code: savedCode } : { ok: false, error: "저장 실패" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("delete-code-master-item", async (_, payload) => {
  try {
    const code = payload?.code;
    const ok = await db.deleteCodeMasterItem(code);
    return ok ? { ok: true } : { ok: false, error: "삭제 실패" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("update-code-master-order", async (_, payload) => {
  try {
    const parentCode = Number(payload?.parentCode);
    const orderedCodes = payload?.orderedCodes || [];
    const ok = await db.updateCodeMasterOrder(parentCode, orderedCodes);
    return ok ? { ok: true } : { ok: false, error: "정렬 저장 실패" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("save-form-columns", async (_, payload) => {
  try {
    const formCode = payload?.formCode;
    const columnMap = payload?.columnMap || {};
    const ok = await db.updateFormColumns(formCode, columnMap);
    return ok ? { ok: true } : { ok: false, error: "저장 실패" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("save-seller-form-link", async (_, payload) => {
  try {
    const sellerCode = payload?.sellerCode;
    const formCode = payload?.formCode ?? null;
    const ok = await db.saveFormLink(sellerCode, formCode);
    return ok ? { ok: true } : { ok: false, error: "저장 실패" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle("get-form-by-seller", async (_, sellerCode) => {
  try {
    return { ok: true, data: await db.getFormBySeller(sellerCode) };
  } catch (e) {
    return { ok: false };
  }
});
ipcMain.handle("get-form-columns", async (_, code) => {
  try {
    return { ok: true, data: await db.getFormColumns(code) };
  } catch (e) {
    return { ok: false };
  }
});

ipcMain.handle("search-item-locations", async (_, payload) => {
  try {
    const data = await db.searchItemLocations({
      keyword: payload?.keyword,
      location: payload?.location,
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("save-item-location", async (_, payload) => {
  try {
    const data = payload || {};
    const duplicate = await db.findDuplicateItemLocation(
      String(data.productName || "").trim(),
      String(data.location || "").trim(),
      data.id ? Number(data.id) : null,
    );
    if (duplicate && !data.allowDuplicate) {
      return {
        ok: false,
        duplicate: true,
        error: "이미 존재하지만 등록하시겠습니까?",
      };
    }
    const saved = await db.saveItemLocation(data);
    if (!saved) {
      return { ok: false, error: "품명, 그룹, 위치를 모두 입력해주세요." };
    }
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("save-item-locations-bulk", async (_, payload) => {
  try {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const allowDuplicate = !!payload?.allowDuplicate;
    if (!rows.length) {
      return { ok: false, error: "등록할 데이터가 없습니다." };
    }

    const duplicateRows = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const productName = String(row.productName || "").trim();
      const groupName = String(row.groupName || "").trim();
      const location = String(row.location || "").trim();
      if (!productName || !groupName || !location) {
        return {
          ok: false,
          error: `${i + 1}번째 행에 필수값(품명, 그룹, 위치)이 비어 있습니다.`,
        };
      }

      const duplicate = await db.findDuplicateItemLocation(productName, location, null);
      if (duplicate) duplicateRows.push(i + 1);
    }

    if (duplicateRows.length && !allowDuplicate) {
      return {
        ok: false,
        duplicate: true,
        duplicateCount: duplicateRows.length,
        duplicateRows,
        error: `중복 데이터 ${duplicateRows.length}건이 있습니다. 계속 등록하시겠습니까?`,
      };
    }

    let savedCount = 0;
    for (const row of rows) {
      const saved = await db.saveItemLocation(row);
      if (!saved) {
        return { ok: false, error: "다중등록 저장 중 오류가 발생했습니다." };
      }
      savedCount += 1;
    }

    return { ok: true, count: savedCount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("download-item-location-template", async (_, payload) => {
  try {
    const template = await ensureItemLocationTemplateStored(payload?.groups || []);
    if (!template?.template_file) {
      return { ok: false, error: "양식을 준비하지 못했습니다." };
    }

    const defaultFileName = template.filename || "품목위치_다중등록_양식.xlsx";
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "품목 위치 다중등록 양식 저장",
      defaultPath: path.join(app.getPath("downloads"), defaultFileName),
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, error: "작업이 취소되었습니다." };
    }

    const savedPath = writeBufferToAvailablePath(template.template_file, filePath);
    return { ok: true, path: savedPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("open-item-location-template", async (_, payload) => {
  try {
    const template = await ensureItemLocationTemplateStored(payload?.groups || []);
    if (!template?.template_file) {
      return { ok: false, error: "양식을 준비하지 못했습니다." };
    }

    const defaultFileName = template.filename || "품목위치_다중등록_양식.xlsx";
    const targetPath = path.join(app.getPath("downloads"), defaultFileName);
    const savedPath = writeBufferToAvailablePath(template.template_file, targetPath);
    const openError = await shell.openPath(savedPath);
    if (openError) {
      return { ok: false, error: openError };
    }
    return { ok: true, path: savedPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("sync-item-location-template-groups", async (_, payload) => {
  try {
    await ensureItemLocationTemplateStored(payload?.groups || []);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("preview-item-location-bulk-excel", async (_, payload) => {
  try {
    return await buildItemLocationBulkPreview(
      payload?.path,
      String(payload?.workerName || "").trim(),
      payload?.groups || [],
    );
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("process-item-location-bulk-excel", async (_, payload) => {
  try {
    const filePath = payload?.path;
    const workerName = String(payload?.workerName || "").trim();
    const allowDuplicate = !!payload?.allowDuplicate;
    const preview = await buildItemLocationBulkPreview(
      filePath,
      workerName,
      payload?.groups || [],
    );
    if (!preview?.ok) return preview;
    const rows = preview.rows || [];
    const duplicateRows = preview.duplicateRows || [];

    if (duplicateRows.length && !allowDuplicate) {
      return {
        ok: false,
        duplicate: true,
        duplicateRows,
        error: `중복 데이터 ${duplicateRows.length}건이 있습니다. 계속 등록하시겠습니까?`,
      };
    }

    let savedCount = 0;
    for (const row of rows) {
      const saved = await db.saveItemLocation(row);
      if (!saved) {
        return { ok: false, error: "다중등록 저장 중 오류가 발생했습니다." };
      }
      savedCount += 1;
    }

    return { ok: true, count: savedCount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("delete-item-location", async (_, payload) => {
  try {
    const ok = await db.deleteItemLocation(payload?.id);
    return ok ? { ok: true } : { ok: false, error: "삭제할 데이터를 찾지 못했습니다." };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("mark-item-location-missing", async (_, payload) => {
  try {
    const data = await db.markItemLocationMissing(payload?.id, payload?.isMissing);
    return data ? { ok: true, data } : { ok: false, error: "대상을 찾지 못했습니다." };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("select-excel-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
  });
  return result.canceled
    ? { ok: false }
    : { ok: true, path: result.filePaths[0] };
});

ipcMain.handle("update-default-template", async (_, payload) => {
  try {
    const filePath = payload?.path;
    const templateType = payload?.templateType;
    if (!filePath) return { ok: false, error: "파일 경로가 없습니다." };

    const id = templateType === "verify" ? 1 : templateType === "inbound" ? 2 : null;
    if (!id) return { ok: false, error: "알 수 없는 템플릿 유형입니다." };

    const ext = path.extname(filePath).toLowerCase();
    let buffer;
    if (ext === ".xls") {
      const tempXls = XLSX.readFile(filePath);
      buffer = XLSX.write(tempXls, { type: "buffer", bookType: "xlsx" });
    } else {
      buffer = fs.readFileSync(filePath);
    }

    const originalName = path.basename(filePath);
    const storedName = originalName.replace(/\.(xls|xlsx)$/i, "");

    const updated = await db.updateExcelTemplate(id, buffer, storedName);
    if (!updated) return { ok: false, error: "DB 업데이트 실패" };
    return { ok: true, filename: storedName };
  } catch (err) {
    console.error("기본양식 업데이트 에러:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("delete-default-template", async (_, payload) => {
  try {
    const templateType = payload?.templateType;
    const id = templateType === "verify" ? 1 : templateType === "inbound" ? 2 : null;
    if (!id) return { ok: false, error: "알 수 없는 템플릿 유형입니다." };

    const deleted = await db.deleteExcelTemplate(id);
    if (!deleted) return { ok: false, error: "DB 업데이트 실패" };
    return { ok: true };
  } catch (err) {
    console.error("기본양식 삭제 에러:", err);
    return { ok: false, error: err.message };
  }
});

// [추가] DB에서 양식을 가져오는 핸들러
ipcMain.handle("load-verify-template", async () => {
  try {
    const buffer = await db.getVerifyTemplate();
    if (!buffer) return { ok: false, error: "등록된 양식이 없습니다." };

    // 이 buffer를 직접 넘기기보다, process 시점에서 사용하거나
    // 임시 파일로 저장 후 경로를 반환할 수 있습니다.
    return { ok: true, data: buffer };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 입고검수파일양식 체크 (id = 1)
ipcMain.handle("check-default-template", async () => {
  try {
    const templateData = await db.getInboundCheckTemplate();
    if (templateData && templateData.buffer) {
      console.log(`기본 양식 확인됨`);
      return { ok: true, filename: templateData.filename };
    }
    return { ok: false, error: "등록된 양식이 없습니다." };
  } catch (err) {
    console.error("양식 체크 중 에러:", err);
    return { ok: false, error: err.message };
  }
});

// 입고파일양식 체크 (id = 2)
ipcMain.handle("check-inbound-template", async () => {
  try {
    const templateData = await db.getInboundExcelTemplate();
    if (templateData && templateData.buffer) {
      console.log(`입고파일 양식 확인됨`);
      return { ok: true, filename: templateData.filename };
    }
    return { ok: false, error: "등록된 양식이 없습니다." };
  } catch (err) {
    console.error("입고파일 양식 체크 중 에러:", err);
    return { ok: false, error: err.message };
  }
});

// ... 상단 선언부 및 DB 핸들러 동일 ...
ipcMain.handle("process-verify-file", async (_, payload) => {
  try {
    const {
      verifyPath,
      sellerPath,
      sellerName,
      shopName,
      releaseCenter,
      dateValue,
      columnMap,
    } = payload;

    const verifyWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    async function loadWorkbook(workbook, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".xls") {
        const tempXls = XLSX.readFile(filePath);
        const buffer = XLSX.write(tempXls, {
          type: "buffer",
          bookType: "xlsx",
        });
        await workbook.xlsx.load(buffer);
      } else {
        await workbook.xlsx.readFile(filePath);
      }
    }

    function getCellValue(cell) {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText)
          return cell.value.richText.map((t) => t.text).join("");
      }
      return cell.value;
    }

    function formatBarcodeRichText(value, baseFont = {}) {
      const barcode = String(value || "");
      if (!barcode) return "";

      const splitIndex = Math.max(0, barcode.length - 4);
      const head = barcode.slice(0, splitIndex);
      const tail = barcode.slice(splitIndex);
      const richText = [];
      const baseSize =
        typeof baseFont.size === "number" ? baseFont.size : undefined;

      if (head) richText.push({ text: head });
      if (tail) {
        richText.push({
          text: tail,
          font: {
            ...baseFont,
            bold: true,
            ...(baseSize ? { size: baseSize + 1 } : {}),
          },
        });
      }

      return { richText };
    }

    // 1️⃣ 파일 로드
    if (verifyPath && verifyPath !== "") {
      await loadWorkbook(verifyWorkbook, verifyPath);
    } else {
      const templateData = await db.getInboundCheckTemplate();
      await verifyWorkbook.xlsx.load(templateData.buffer);
    }

    await loadWorkbook(sellerWorkbook, sellerPath);
    const verifySheet = verifyWorkbook.worksheets[0];
    const sellerSheet = sellerWorkbook.worksheets[0];

    // 2️⃣ 양식 파일 헤더 위치 및 공통 셀 찾기
    let targetCols = {
      plt: null,
      sku: null,
      name: null,
      barcode: null,
      lot: null,
      expiry: null,
      qty: null,
    };

    const centerLabels = ["입고센터", "출고센터"];
    let commonCells = { seller: null, shop: null, date: null };
    let startDataRow = 3;

    verifySheet.eachRow((row, rowNum) => {
      row.eachCell((cell) => {
        const val = String(getCellValue(cell))
          .toUpperCase()
          .replace(/\s+/g, "");

        if (val.includes("PLT")) targetCols.plt = cell.col;
        if (val.includes("SKU")) targetCols.sku = cell.col;
        if (val.includes("상품명")) targetCols.name = cell.col;
        if (val.includes("바코드")) targetCols.barcode = cell.col;
        if (val.includes("LOT")) targetCols.lot = cell.col;
        if (val.includes("유통기한")) targetCols.expiry = cell.col;
        if (val.includes("수량")) targetCols.qty = cell.col;
        if (val.includes("셀러")) commonCells.seller = cell.address;
        if (val.includes("쇼핑몰")) commonCells.shop = cell.address;
        if (DATE_LABELS.includes(val.trim())) commonCells.date = cell.address;
        if (centerLabels.includes(val.trim())) commonCells.releaseCenter = cell.address;
      });
      if (targetCols.name && startDataRow === 3) startDataRow = rowNum + 1;
    });

    // 3️⃣ 셀러 파일에서 추출과 동시에 합산 (메모리 최적화)

    const aggregated = {};
    let sellerBarcodeCol = null;
    let sellerPltCol = null;

    // 셀러 파일 헤더 탐색

    sellerSheet.getRow(1).eachCell((cell) => {
      const val = String(getCellValue(cell)).replace(/\s+/g, "");

      if (val.includes("바코드")) sellerBarcodeCol = cell.col;
      if (val.includes("PLT") || val.includes("plt") || val.includes("팔레트NO")) sellerPltCol = cell.col;
    });

for (let i = 2; i <= sellerSheet.rowCount; i++) {
  const row = sellerSheet.getRow(i);
  const name = getCellValue(row.getCell(columnMap.productName));

  if (!name || String(name).trim() === "") continue;

  // 값이 없을 경우를 대비해 || "" (또는 빈 문자열) 처리를 강화합니다.
  const plt = sellerPltCol ? getCellValue(row.getCell(sellerPltCol)) : "";
  
  // columnMap에 해당 키가 없거나 셀 값이 없을 경우 빈 문자열 반환
  const sku = columnMap.sku ? (getCellValue(row.getCell(columnMap.sku)) || "") : "";
  const lot = columnMap.lot ? (getCellValue(row.getCell(columnMap.lot)) || "") : "";
  const expiry = columnMap.expiry ? (getCellValue(row.getCell(columnMap.expiry)) || "") : "";
  
  const qty = Number(getCellValue(row.getCell(columnMap.qty))) || 0;

  let barcode = sellerBarcodeCol
    ? String(getCellValue(row.getCell(sellerBarcodeCol)))
    : "";

  // ✅ 핵심: 값이 없어도 파이프(|) 기호는 유지되어 고유 키가 생성됩니다.
  const key = `${plt}|${sku}|${name}|${lot}|${expiry}`;

  if (!aggregated[key]) {
    aggregated[key] = { plt, sku, name, barcode, lot, expiry, qty };
  } else {
    aggregated[key].qty += qty;
  }
}

    // [중요] aggregated 객체를 배열로 변환
    const finalRows = Object.values(aggregated);

    // 2️⃣ 데이터 정제 함수
    const checkInput = (val) => {
      // '선택'이거나 공백이면 빈값 처리

      if (!val || String(val).trim() === "" || String(val).trim() === "선택")
        return "";

      return String(val).trim();
    };

    const finalSeller = checkInput(sellerName);
    const finalShop = checkInput(shopName);
    const finalRelease = checkInput(releaseCenter); // UI 입력값
    const finalDate = dateValue && dateValue.trim() !== "" ? dateValue : "";

    // 4️⃣ 양식 시트 작업

    // (1) 공통 정보 입력
    if (commonCells.seller)
      verifySheet.getCell(commonCells.seller).value = finalSeller;

    if (commonCells.shop)
      verifySheet.getCell(commonCells.shop).value = finalShop;

    if (commonCells.date)
      verifySheet.getCell(commonCells.date).value = finalDate;

    // [핵심] UI에서 입력한 '출고센터' 명칭을 엑셀의 '출고센터' 셀 위치에 입력

    if (commonCells.releaseCenter) {
      verifySheet.getCell(commonCells.releaseCenter).value = finalRelease;
    }

    // (2) 기존 데이터 영역 초기화 (메모리 효율적 방식)

    const currentLastRow = verifySheet.actualRowCount;

    for (
      let i = startDataRow;
      i <= Math.max(currentLastRow, startDataRow + 500);
      i++
    ) {
      const row = verifySheet.getRow(i);
      row.values = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {};
      });
    }

    // [추가] 헤더 행에서 마지막으로 데이터가 있는 열 찾기
    let lastHeaderCol = 1;
    const headerRow = verifySheet.getRow(startDataRow - 1); // 데이터 시작행 바로 위가 헤더행

    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.col > lastHeaderCol) lastHeaderCol = cell.col;
    });

    // (3) 데이터 입력 및 테두리 설정

    finalRows.forEach((data, idx) => {
      const r = startDataRow + idx;
      const row = verifySheet.getRow(r);

      row.height = 20;

// targetCols(양식의 헤더 위치)가 존재할 때만 값을 넣음
  if (targetCols.plt) row.getCell(targetCols.plt).value = data.plt || "";
  if (targetCols.sku) row.getCell(targetCols.sku).value = data.sku || "";
  if (targetCols.name) row.getCell(targetCols.name).value = data.name || "";
  if (targetCols.barcode) {
    const barcodeCell = row.getCell(targetCols.barcode);
    barcodeCell.value = formatBarcodeRichText(data.barcode, barcodeCell.font || {});
  }
  if (targetCols.lot) row.getCell(targetCols.lot).value = data.lot || "";
  if (targetCols.expiry) row.getCell(targetCols.expiry).value = data.expiry || "";
  if (targetCols.qty) row.getCell(targetCols.qty).value = data.qty || 0;

      // [수정된 테두리 로직] A열(1)부터 헤더 끝 열(lastHeaderCol)까지 전체 테두리
      for (let colIdx = 1; colIdx <= lastHeaderCol; colIdx++) {
        row.getCell(colIdx).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    });

    // 5️⃣ 최종 파일 저장
    // [추가] 오늘 날짜 생성 (YYYY-MM-DD 형식)
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // 2. '입력값'이 있을때만 체크 함수 (유효하지 않으면 null 반환)
    const getSafe = (val) => {
      const v = checkInput(val);
      return v ? v.replace(/[\/\\:*?"<>|]/g, "_") : null;
    };

    // 3. 각 항목 유효성 검사
    const safeDate =
      dateValue && dateValue.trim() !== ""
        ? dateValue.replace(/[\/\\:*?"<>|]/g, "-")
        : formattedToday;

    const safeSeller = getSafe(sellerName);
    const safeShop = getSafe(shopName);

    // 예: "마녀공장 Qoo10 입고검수지 2026-02-25 용인센터 .xlsx"

    const nameParts = [
      getSafe(sellerName),
      getSafe(shopName),
      "입고검수지",
      safeDate,
      getSafe(releaseCenter),
    ].filter((p) => p !== null);

    const defaultFileName = `${nameParts.join(" ")}.xlsx`;
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "검수 완료 파일 저장",

      defaultPath: path.join(app.getPath("downloads"), defaultFileName),

      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, error: "작업이 취소되었습니다." };
    }

    await verifyWorkbook.xlsx.writeFile(filePath);

    return { ok: true, path: filePath };
  } catch (err) {
    console.error(err);

    return { ok: false, error: `작업 중 오류: ${err.message}` };
  }
});

ipcMain.handle("process-inbound-file", async (_, payload) => {
  try {
    const {
      templatePath, // 사용자가 선택한 양식 경로 (없을 수 있음)
      sellerPath,
      centerData,
      columnMap = {},
    } = payload;

    const templateWorkbook = new ExcelJS.Workbook();
    const sellerWorkbook = new ExcelJS.Workbook();

    // [내부 보조 함수] 셀 값 추출
    const getCellValue = (cell) => {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText)
          return cell.value.richText.map((t) => t.text).join("");
      }
      return cell.value;
    };

    // [내부 보조 함수] 엑셀 로드
    const loadExcel = async (wb, p, isTemplate = false) => {
      if (!p && isTemplate) {
        const templateData = await db.getInboundExcelTemplate();
        if (!templateData || !templateData.buffer)
          throw new Error("등록된 양식이 없습니다.");
        await wb.xlsx.load(Buffer.from(templateData.buffer));
        return;
      }
      const ext = path.extname(p).toLowerCase();
      if (ext === ".xls") {
        const tempXls = XLSX.readFile(p);
        const buffer = XLSX.write(tempXls, {
          type: "buffer",
          bookType: "xlsx",
        });
        await wb.xlsx.load(buffer);
      } else {
        await wb.xlsx.readFile(p);
      }
    };

    // 1️⃣ 파일 로드
    await loadExcel(templateWorkbook, templatePath, true);
    await loadExcel(sellerWorkbook, sellerPath);

    const targetSheet = templateWorkbook.worksheets[0];
    const sellerSheet = sellerWorkbook.worksheets[0];

    // 2️⃣ "선택" 데이터 및 날짜 처리 로직 (파일명용)
    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const getValidValue = (val) => {
      if (!val || String(val).trim() === "" || String(val).trim() === "선택")
        return null;
      return String(val)
        .trim()
        .replace(/[\/\\:*?"<>|]/g, "_");
    };

    const normalizeHeader = (val) =>
      String(val || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");

    const mapHeaderCell = (headerText, map, colNumber) => {
      if (!map.sku && headerText.includes("SKU")) map.sku = colNumber;
      if (
        !map.name &&
        (headerText.includes("상품명") || headerText.includes("품목명"))
      ) {
        map.name = colNumber;
      }
      if (
        !map.expiry &&
        (headerText.includes("유통기한") || headerText.includes("유효일자"))
      ) {
        map.expiry = colNumber;
      }
      if (
        !map.lot &&
        (headerText.includes("LOT") || headerText.includes("로트"))
      ) {
        map.lot = colNumber;
      }
      if (
        !map.qty &&
        (headerText.includes("입고예정수량") ||
          headerText.includes("예정수량") ||
          headerText.includes("수량") ||
          headerText.includes("QTY") ||
          headerText.includes("QUANTITY"))
      ) {
        map.qty = colNumber;
      }
    };

    const findProductHeader = (sheet, minScore = 2) => {
      let best = null;

      sheet.eachRow((row, rowNum) => {
        const cols = {
          sku: null,
          expiry: null,
          lot: null,
          qty: null,
          name: null,
        };

        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          mapHeaderCell(normalizeHeader(getCellValue(cell)), cols, colNumber);
        });

        const score = Object.values(cols).filter(Boolean).length;
        if (score < minScore || !cols.name) return;
        if (!best || score > best.score) {
          best = { rowNum, cols, score };
        }
      });

      return best;
    };

    const safeDate =
      centerData.dateValue && centerData.dateValue.trim() !== ""
        ? centerData.dateValue.replace(/[\/\\:*?"<>|]/g, "-")
        : formattedToday;
    const safeSeller = getValidValue(
      centerData.sellerName || centerData.seller,
    );
    const safeShop = getValidValue(centerData.shopName);

    // 3️⃣ 양식 헤더 위치 및 끝 열 찾기
    const headerRow = targetSheet.getRow(1);
    let colMap = {
      seller: null,
      inbound: null,
      type: null,
      date: null,
      shop: null,
    };
    let lastHeaderCol = 11; // 기본값 K열

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = String(getCellValue(cell)).replace(/\s+/g, "");
      if (val.includes("셀러")) colMap.seller = colNumber;
      if (val.includes("입고센터")) colMap.inbound = colNumber;
      if (val.includes("상품구분")) colMap.type = colNumber;
      if (DATE_LABELS.includes(val.trim())) colMap.date = colNumber;
      if (val.includes("쇼핑몰")) colMap.shop = colNumber;

      if (colNumber > lastHeaderCol) lastHeaderCol = colNumber;
    });

    // [추가] 입고파일 양식 내 상품 헤더 행 찾기
    const inboundHeader = findProductHeader(targetSheet, 2);
    if (!inboundHeader) {
      throw new Error("입고파일 양식에서 상품명 헤더 행을 찾을 수 없습니다.");
    }

    const inboundCols = inboundHeader.cols;
    const dataStartRow = inboundHeader.rowNum + 1;
    const inboundHeaderRow = targetSheet.getRow(inboundHeader.rowNum);
    inboundHeaderRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > lastHeaderCol) lastHeaderCol = colNumber;
    });

    // 셀러 파일은 화면에서 입력한 열 문자 기준으로 읽는다.
    const sourceCols = {
      sku: columnMap.sku || null,
      productName: columnMap.productName || null,
      expiry: columnMap.expiry || null,
      lot: columnMap.lot || null,
      qty: columnMap.qty || null,
    };
    const sellerDataStartRow = 2;

    if (!sourceCols.productName || !sourceCols.qty) {
      throw new Error(
        "입고예정엑셀파일의 상품명/수량 열 문자를 확인해주세요.",
      );
    }

    // 4️⃣ 데이터 추출 및 합산 (메모리 최적화: 추출과 동시에 매핑 준비)
    const startRow = dataStartRow;
    const checkSelect = (val) => (val === "선택" ? "" : val);
    const currentLastRow = targetSheet.actualRowCount;

    for (
      let i = startRow;
      i <= Math.max(currentLastRow, startRow + 500);
      i++
    ) {
      const row = targetSheet.getRow(i);
      row.values = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {};
      });
    }

    let nextTargetRow = startRow;
    let writtenRowCount = 0;
    for (let i = sellerDataStartRow; i <= sellerSheet.rowCount; i++) {
      const sRow = sellerSheet.getRow(i);
      const name = getCellValue(sRow.getCell(sourceCols.productName));
      const qty = getCellValue(sRow.getCell(sourceCols.qty));

      if (!name || String(name).trim() === "") continue;
      if (qty === undefined || qty === null || String(qty).trim() === "") continue;

      const targetRowNum = nextTargetRow;
      nextTargetRow += 1;
      writtenRowCount += 1;
      const tRow = targetSheet.getRow(targetRowNum);

      // 값이 있을 때만 타겟 셀에 넣어주는 함수
      const safeMap = (targetCol, sourceColKey) => {
        if (sourceColKey) {
          const val = getCellValue(sRow.getCell(sourceColKey));
          if (val !== undefined && val !== null && val !== "") {
            tRow.getCell(targetCol).value = val;
          }
        }
      };

      // 사용 예시
      if (inboundCols.sku) safeMap(inboundCols.sku, sourceCols.sku);
      if (inboundCols.expiry) safeMap(inboundCols.expiry, sourceCols.expiry);
      if (inboundCols.lot) safeMap(inboundCols.lot, sourceCols.lot);
      if (inboundCols.qty)
        tRow.getCell(inboundCols.qty).value = getCellValue(
          sRow.getCell(sourceCols.qty),
        );
      if (inboundCols.name) tRow.getCell(inboundCols.name).value = name;

      // 부가 정보 매핑 (찾은 헤더 기준)
      if (colMap.seller)
        tRow.getCell(colMap.seller).value = checkSelect(centerData.sellerName);
      if (colMap.inbound)
        tRow.getCell(colMap.inbound).value = checkSelect(
          centerData.inboundCenter,
        );
      if (colMap.type)
        tRow.getCell(colMap.type).value = checkSelect(centerData.productType);
      if (colMap.shop)
        tRow.getCell(colMap.shop).value = checkSelect(centerData.shopName);
      if (colMap.date)
        tRow.getCell(colMap.date).value = centerData.dateValue || "";

      // 테두리 적용 (A열부터 마지막 헤더열까지)
      for (let c = 1; c <= lastHeaderCol; c++) {
        tRow.getCell(c).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    if (writtenRowCount === 0) {
      throw new Error(
        "입고예정엑셀파일에서 복사할 상품 데이터를 찾지 못했습니다. 상품명/수량 열 또는 헤더 행을 확인해주세요.",
      );
    }

    // 5️⃣ 상품명(헤더 기준) 역순 정리
    const nameColForCleanup = inboundCols.name || 4;
    for (let i = targetSheet.rowCount; i >= startRow; i--) {
      const nameVal = getCellValue(
        targetSheet.getRow(i).getCell(nameColForCleanup),
      );
      if (!nameVal || String(nameVal).trim() === "") {
        targetSheet.spliceRows(i, 1);
      }
    }

    // 6️⃣ 저장 대화상자 (요청하신 파일명 형식 적용)
    const nameParts = [safeSeller, safeShop, "입고파일", safeDate].filter(
      (p) => p !== null,
    );
    const defaultFileName = `${nameParts.join(" ")}.xlsx`;

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "입고파일 저장",
      defaultPath: path.join(app.getPath("downloads"), defaultFileName),
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath)
      return { ok: false, error: "작업이 취소되었습니다." };

    await templateWorkbook.xlsx.writeFile(filePath);

    // Workbook 인스턴스 해제 보조
    templateWorkbook.worksheets.forEach((ws) =>
      templateWorkbook.removeWorksheet(ws.id),
    );
    sellerWorkbook.worksheets.forEach((ws) =>
      sellerWorkbook.removeWorksheet(ws.id),
    );

    return { ok: true, path: filePath };
  } catch (err) {
    console.error("입고파일 작업 에러:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("process-statement-file", async (_, payload) => {
  try {
    const {
      sellerPath,
      sellerName,
      shopName,
      dateValue,
      pltQty,
      outboundPlaceName,
      outboundAddress,
      outboundManager,
      outboundPhone,
      inboundPlaceName,
      inboundAddress,
      inboundManager,
      inboundPhone,
      columnMap = {},
    } = payload || {};

    if (!sellerPath) {
      return { ok: false, error: "출고 예정 파일 경로가 없습니다." };
    }

    const templateData = await db.getStatementExcelTemplate();
    if (!templateData?.buffer) {
      return { ok: false, error: "거래명세서 양식(id=3)이 등록되어 있지 않습니다." };
    }

    const loadWorkbook = async (workbook, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".xls") {
        const tempXls = XLSX.readFile(filePath);
        const buffer = XLSX.write(tempXls, {
          type: "buffer",
          bookType: "xlsx",
        });
        await workbook.xlsx.load(buffer);
      } else {
        await workbook.xlsx.readFile(filePath);
      }
    };

    const getCellValue = (cell) => {
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value !== null) {
        if (cell.value.result !== undefined) return cell.value.result;
        if (cell.value.richText) {
          return cell.value.richText.map((t) => t.text).join("");
        }
      }
      return cell.value;
    };

    const sourceWorkbook = new ExcelJS.Workbook();
    await loadWorkbook(sourceWorkbook, sellerPath);
    const sourceSheet = sourceWorkbook.worksheets[0];

    if (!columnMap.productName || !columnMap.qty) {
      return { ok: false, error: "상품명과 출고예정수량 열을 확인해주세요." };
    }

    let sourceBarcodeCol = null;
    let sourceBoxCol = null;

    sourceSheet.getRow(1).eachCell((cell) => {
      const value = String(getCellValue(cell)).replace(/\s+/g, "");
      if (value.includes("바코드")) sourceBarcodeCol = cell.col;
      if (value.includes("박스")) sourceBoxCol = cell.col;
    });

    const statementRows = [];
    for (let rowNumber = 2; rowNumber <= sourceSheet.rowCount; rowNumber++) {
      const row = sourceSheet.getRow(rowNumber);
      const name = getCellValue(row.getCell(columnMap.productName));
      if (!name || String(name).trim() === "") continue;

      statementRows.push({
        sku: columnMap.sku ? getCellValue(row.getCell(columnMap.sku)) : "",
        name: getCellValue(row.getCell(columnMap.productName)),
        expiry: columnMap.expiry ? getCellValue(row.getCell(columnMap.expiry)) : "",
        lot: columnMap.lot ? getCellValue(row.getCell(columnMap.lot)) : "",
        barcode: sourceBarcodeCol ? getCellValue(row.getCell(sourceBarcodeCol)) : "",
        qty: columnMap.qty ? getCellValue(row.getCell(columnMap.qty)) : "",
        box: sourceBoxCol ? getCellValue(row.getCell(sourceBoxCol)) : "",
      });
    }

    if (!statementRows.length) {
      return { ok: false, error: "출고 예정 파일에서 상품 데이터를 찾지 못했습니다." };
    }

    const statementWorkbook = await XlsxPopulate.fromDataAsync(
      Buffer.from(templateData.buffer),
    );

    const hSheet = statementWorkbook.sheet("h");
    const fSheet = statementWorkbook.sheet("f");
    if (!hSheet || !fSheet) {
      return { ok: false, error: "거래명세서 양식에 h 또는 f 시트가 없습니다." };
    }

    const statementMeta = {
      sellerName: sellerName || "",
      shopName: shopName || "",
      dateValue: dateValue || "",
      pltQty: pltQty || "",
      outboundPlaceName: outboundPlaceName || "",
      outboundAddress: outboundAddress || "",
      outboundManager: outboundManager || "",
      outboundPhone: outboundPhone || "",
      inboundPlaceName: inboundPlaceName || "",
      inboundAddress: inboundAddress || "",
      inboundManager: inboundManager || "",
      inboundPhone: inboundPhone || "",
    };

    const formatPltLabel = (value) => {
      const normalized = String(value ?? "").trim();
      if (!normalized) return "";
      return normalized.toUpperCase().endsWith("PLT")
        ? normalized
        : `${normalized}PLT`;
    };

    const fillStatementSheet = (sheet, rows, maxRows) => {
      sheet.cell("G2").value(statementMeta.sellerName);
      sheet.cell("H2").value(statementMeta.shopName);
      sheet.cell("I2").value(formatPltLabel(statementMeta.pltQty));
      sheet.cell("B2").value(statementMeta.dateValue);
      sheet.cell("C4").value(statementMeta.outboundPlaceName);
      sheet.cell("C5").value(statementMeta.outboundAddress);
      sheet.cell("C6").value(statementMeta.outboundManager);
      sheet.cell("C7").value(statementMeta.outboundPhone);
      sheet.cell("G4").value(statementMeta.inboundPlaceName);
      sheet.cell("G5").value(statementMeta.inboundAddress);
      sheet.cell("G6").value(statementMeta.inboundManager);
      sheet.cell("G7").value(statementMeta.inboundPhone);

      for (let i = 0; i < maxRows; i++) {
        const rowNumber = 10 + i;
        sheet.cell(`C${rowNumber}`).value("");
        sheet.cell(`D${rowNumber}`).value("");
        sheet.cell(`E${rowNumber}`).value("");
        sheet.cell(`F${rowNumber}`).value("");
        sheet.cell(`G${rowNumber}`).value("");
        sheet.cell(`H${rowNumber}`).value("");
        sheet.cell(`I${rowNumber}`).value("");
      }

      rows.slice(0, maxRows).forEach((row, index) => {
        const targetRow = 10 + index;
        sheet.cell(`C${targetRow}`).value(row.sku ?? "");
        sheet.cell(`D${targetRow}`).value(row.name ?? "");
        sheet.cell(`E${targetRow}`).value(row.expiry ?? "");
        sheet.cell(`F${targetRow}`).value(row.lot ?? "");
        sheet.cell(`G${targetRow}`).value(row.barcode ?? "");
        sheet.cell(`H${targetRow}`).value(row.qty ?? "");
        sheet.cell(`I${targetRow}`).value(row.box ?? "");
      });
    };

    const copyHSection = (sheet) => {
      for (let sourceRow = 2; sourceRow <= 22; sourceRow++) {
        const targetRow = sourceRow + 23;

        for (let col = 2; col <= 9; col++) {
          const sourceCell = sheet.cell(sourceRow, col);
          const targetCell = sheet.cell(targetRow, col);
          targetCell.value(sourceCell.value());
        }
      }
    };

    const toNumericValue = (value) => {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
      }

      const normalized = String(value ?? "")
        .replace(/,/g, "")
        .trim();
      if (!normalized) return 0;

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const applyFTemplateBounds = (sourceSheet, targetSheet) => {
      const sourceColumnJ = sourceSheet.column("J");
      const targetColumnJ = targetSheet.column("J");
      const columnWidth = sourceColumnJ.width();
      if (typeof columnWidth === "number") {
        targetColumnJ.width(columnWidth);
      }
      targetColumnJ.hidden(sourceColumnJ.hidden());

      const sourceRow43 = sourceSheet.row(43);
      const targetRow43 = targetSheet.row(43);
      const rowHeight = sourceRow43.height();
      if (typeof rowHeight === "number") {
        targetRow43.height(rowHeight);
      }
      targetRow43.hidden(sourceRow43.hidden());

      targetSheet.cell("J43").value("");
      targetSheet.definedName(
        "_xlnm.Print_Area",
        targetSheet.range("A1:J43"),
      );
    };

    const applyFPageMeta = (sheet, pageIndex, totalPages, totalQty, totalBox) => {
      sheet.cell("B42").value(totalPages > 1 ? `${pageIndex}/${totalPages}` : "");
      sheet.cell("H38").value(totalQty);
      sheet.cell("I38").value(totalBox);
    };

    const chunkRows = (rows, size) => {
      const chunks = [];
      for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
      }
      return chunks;
    };

    const previewPages = [];
    const totalCount = statementRows.length;

    if (totalCount <= 8) {
      fillStatementSheet(hSheet, statementRows, 8);
      copyHSection(hSheet);
      statementWorkbook.deleteSheet(fSheet);
      previewPages.push({
        templateType: "h",
        meta: statementMeta,
        rows: statementRows,
      });
    } else {
      const chunks = chunkRows(statementRows, 28);
      const fTemplateClone = statementWorkbook.cloneSheet(fSheet, "__f_template__");
      const totalQty = statementRows.reduce(
        (sum, row) => sum + toNumericValue(row.qty),
        0,
      );
      const totalBox = statementRows.reduce(
        (sum, row) => sum + toNumericValue(row.box),
        0,
      );

      fillStatementSheet(fSheet, chunks[0], 28);
      applyFTemplateBounds(fTemplateClone, fSheet);
      applyFPageMeta(fSheet, 1, chunks.length, totalQty, totalBox);
      previewPages.push({
        templateType: "f",
        meta: statementMeta,
        rows: chunks[0],
      });

      for (let i = 1; i < chunks.length; i++) {
        const cloned = statementWorkbook.cloneSheet(
          fTemplateClone,
          `f_${i + 1}`,
        );
        fillStatementSheet(cloned, chunks[i], 28);
        applyFTemplateBounds(fTemplateClone, cloned);
        applyFPageMeta(cloned, i + 1, chunks.length, totalQty, totalBox);
        previewPages.push({
          templateType: "f",
          meta: statementMeta,
          rows: chunks[i],
        });
      }

      statementWorkbook.deleteSheet(fTemplateClone);
      statementWorkbook.deleteSheet(hSheet);
    }

    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const safe = (value) =>
      String(value || "")
        .trim()
        .replace(/[\/\\:*?"<>|]/g, "_");

    const filenameParts = [
      safe(sellerName),
      safe(shopName),
      "거래명세서",
      safe(dateValue) || formattedToday,
      safe(inboundPlaceName),
    ].filter(Boolean);

    const defaultFileName = `${filenameParts.join(" ")}.xlsx`;
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "거래명세서 저장",
      defaultPath: path.join(app.getPath("downloads"), defaultFileName),
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath) {
      return { ok: false, error: "작업이 취소되었습니다." };
    }

    const savedPath = await saveWorkbookOrThrowBusy(statementWorkbook, filePath);

    const pdfPath = savedPath.replace(/\.(xlsx|xls)$/i, ".pdf");
    let warning = null;

    try {
      await exportExcelToPdf(savedPath, pdfPath);
      openPdfPreviewWindow(pdfPath, "거래명세서 PDF 미리보기");
    } catch (pdfError) {
      console.error(pdfError);
      warning = `거래명세서는 저장되었지만 PDF 미리보기를 열지 못했습니다. ${pdfError.message}`;
    }

    return { ok: true, path: savedPath, pdfPath, warning };
  } catch (err) {
    console.error(err);
    return { ok: false, error: `거래명세서 작업 중 오류: ${err.message}` };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

