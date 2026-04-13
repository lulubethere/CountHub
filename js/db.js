const { app } = require("electron");
const dotenv = require("dotenv");
const path = require("path");
const { Client } = require("pg");

// 1. .env 파일 경로 설정
// 앱이 패키징(빌드) 되었으면 resources 폴더에서 찾고, 아니면 현재 루트에서 찾습니다.
const isPackaged = app ? app.isPackaged : false;
const envPath = isPackaged
  ? path.join(process.resourcesPath, ".env")
  : path.resolve(process.cwd(), ".env");

// 2. 설정된 경로로 dotenv 로드
dotenv.config({ path: envPath });

// 디버깅용 (빌드 후 터미널이나 로그에서 확인 가능)
console.log("Environment loaded from:", envPath);
console.log(
  "DB Host Check:",
  process.env.SUPABASE_DB_HOST ? "Loaded" : "Not Found",
);

// 3. Supabase PostgreSQL 연결 설정
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST,
  port: parseInt(process.env.SUPABASE_DB_PORT || "5432", 10),
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

let _client = null;
let _connected = false;

/**
 * DB 클라이언트 반환 (싱글톤). 필요 시 새로 생성.
 * @returns {import('pg').Client}
 */
function getClient() {
  if (!_client) {
    _client = new Client(dbConfig);
    _connected = false;
  }
  return _client;
}

/**
 * 연결 테스트. 성공 시 true, 실패 시 에러 throw.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  const client = getClient();
  try {
    if (!_connected) await client.connect();
    _connected = true;
    const res = await client.query("SELECT 1 as ok");
    await client.end();
    _client = null;
    _connected = false;
    return res.rows[0].ok === 1;
  } catch (err) {
    if (_client) {
      try {
        await _client.end();
      } catch (_) {}
      _client = null;
      _connected = false;
    }
    throw err;
  }
}

/**
 * 쿼리 실행 헬퍼 (연결 → 쿼리 → 종료). 짧은 작업용.
 * @param {string} text
 * @param {any[]} [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const client = getClient();
  if (!_connected) {
    await client.connect();
    _connected = true;
  }
  return client.query(text, params);
}

/**
 * DB 연결 종료 (앱 종료 시 등에 호출)
 */
async function close() {
  if (_client) {
    await _client.end();
    _client = null;
    _connected = false;
  }
}

/**
 * 이름으로 사용자 조회 (관리자가 만든 계정인지 확인)
 * @param {string} name
 * @returns {Promise<{ id: number, name: string } | null>}
 */
async function findUserByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const res = await query(
    'SELECT id, username FROM "Users" WHERE username = $1 LIMIT 1',
    [trimmed],
  );
  return res.rows[0] || null;
}

/**
 * CodeMaster에서 parent_code=100(셀러) 목록 조회
 * @returns {Promise<Array<{ code: number|string, name: string }>>}
 */
async function getSellers() {
  const res = await query(
    'SELECT code, name FROM "CodeMaster" WHERE parent_code = 100 ORDER BY sort_order',
    [],
  );
  return res.rows || [];
}

/**
 * CodeMaster에서 parent_code=200(상품구분) 목록 조회
 * @returns {Promise<Array<{ code: number|string, name: string }>>}
 */
async function getProductTypes() {
  const res = await query(
    'SELECT code, name FROM "CodeMaster" WHERE parent_code = 200 ORDER BY sort_order',
    [],
  );
  return res.rows || [];
}

/**
 * CodeMaster에서 parent_code=300(입고센터) 목록 조회
 * @returns {Promise<Array<{ code: number|string, name: string }>>}
 */
async function getCenters() {
  const res = await query(
    'SELECT code, name FROM "CodeMaster" WHERE parent_code = 300 ORDER BY sort_order',
    [],
  );
  return res.rows || [];
}

/**
 * CodeMaster에서 parent_code=400(쇼핑몰) 목록 조회
 * @returns {Promise<Array<{ code: number|string, name: string }>>}
 */
async function getShops() {
  const res = await query(
    'SELECT code, name FROM "CodeMaster" WHERE parent_code = 400 ORDER BY sort_order',
    [],
  );
  return res.rows || [];
}

/**
 * CodeMaster에서 parent_code=600(입고검수파일양식) 목록 조회
 * @returns {Promise<Array<{ code: number|string, name: string }>>}
 */
async function getForm() {
  const res = await query(
    'SELECT code, name FROM "CodeMaster" WHERE parent_code = 600 ORDER BY sort_order',
    [],
  );
  return res.rows || [];
}

/**
 * FormPaper에서 셀러별 양식 조회 (seller_code로 form_code 반환)
 * @param {number|string} sellerCode
 * @returns {Promise<{ seller_code: number|string, form_code: number|string } | null>}
 */
async function getFormBySeller(sellerCode) {
  const res = await query(
    'SELECT seller_code, form_code FROM "FormPaper" WHERE seller_code = $1 LIMIT 1',
    [sellerCode],
  );
  return res.rows[0] || null;
}

/**
 * 셀러별 SellerColumn 매핑 조회 (엑셀 컬럼 매핑)
 * @param {number|string} sellerCode
 * @returns {Promise<Array<{ id: number, seller_code: number, column: string, column_code: number, name: string }>>}
 */
async function getFormColumns(formCode) {
  const res = await query(
    `SELECT S.seller_code, S.column, C.code, C.name
     FROM "SellerColumn" AS S
     INNER JOIN "CodeMaster" AS C ON S.column_code = C.code
     WHERE S.seller_code = $1`,
    [formCode],
  );
  return res.rows || [];
}

// db.js
// 입고검수파일양식 (id = 1)
async function getInboundCheckTemplate() {
  try {
    const res = await query(
      'SELECT excelfile, description FROM "ExcelFiles" WHERE id = 1',
      [],
    );

    if (res.rows && res.rows.length > 0) {
      const fileData = res.rows[0].excelfile;
      const hasBuffer = fileData && Buffer.isBuffer(fileData) && fileData.length > 0;
      if (!hasBuffer) return null;
      return {
        buffer: fileData,
        filename: res.rows[0].description,
      };
    }
    return null;
  } catch (err) {
    console.error("DB 쿼리 중 에러 발생:", err);
    throw err;
  }
}

// 입고파일양식 (id = 2)
async function getInboundExcelTemplate() {
  try {
    const res = await query(
      'SELECT excelfile, description FROM "ExcelFiles" WHERE id = 2',
      [],
    );

    if (res.rows && res.rows.length > 0) {
      const fileData = res.rows[0].excelfile;
      const hasBuffer = fileData && Buffer.isBuffer(fileData) && fileData.length > 0;
      if (!hasBuffer) return null;
      return {
        buffer: fileData,
        filename: res.rows[0].description,
      };
    }
    return null;
  } catch (err) {
    console.error("DB 쿼리 중 에러 발생:", err);
    throw err;
  }
}

/**
 * CodeMaster 목록 조회 (parent_code 기준)
 * @param {number} parentCode
 * @returns {Promise<Array<{ code: number|string, name: string, sort_order: number|null }>>}
 */
async function getCodeMasterList(parentCode) {
  const res = await query(
    'SELECT code, name, sort_order FROM "CodeMaster" WHERE parent_code = $1 ORDER BY sort_order NULLS LAST, code',
    [parentCode],
  );
  return res.rows || [];
}

/**
 * CodeMaster 저장 (신규/수정)
 * @param {number} parentCode
 * @param {string} code
 * @param {string} name
 * @param {number|null} sortOrder
 * @returns {Promise<boolean>}
 */
async function saveCodeMasterItem(parentCode, code, name, sortOrder) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return false;
  if (code) {
    const res = await query(
      'UPDATE "CodeMaster" SET name = $1, sort_order = $2 WHERE code = $3',
      [trimmedName, sortOrder, code],
    );
    return res.rowCount > 0 ? code : false;
  }
  const nextRes = await query(
    'SELECT COALESCE(MAX(code), 0) + 1 AS next_code FROM "CodeMaster" WHERE parent_code = $1',
    [parentCode],
  );
  const nextCode = nextRes.rows?.[0]?.next_code;
  if (!nextCode) return false;
  const insertRes = await query(
    'INSERT INTO "CodeMaster" (code, name, parent_code, sort_order) VALUES ($1, $2, $3, $4)',
    [nextCode, trimmedName, parentCode, sortOrder],
  );
  return insertRes.rowCount > 0 ? nextCode : false;
}

/**
 * CodeMaster 삭제
 * @param {string|number} code
 * @returns {Promise<boolean>}
 */
async function deleteCodeMasterItem(code) {
  if (!code) return false;
  await query("BEGIN");
  try {
    const parentRes = await query(
      'SELECT parent_code FROM "CodeMaster" WHERE code = $1',
      [code],
    );
    const parentCode = parentRes.rows?.[0]?.parent_code ?? null;
    if (Number(parentCode) === 600) {
      await query(
        'DELETE FROM "SellerColumn" WHERE seller_code = $1',
        [code],
      );
    }
    const res = await query(
      'DELETE FROM "CodeMaster" WHERE code = $1',
      [code],
    );
    await query("COMMIT");
    return res.rowCount > 0;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

/**
 * CodeMaster 정렬 순서 저장
 * @param {number} parentCode
 * @param {Array<string|number>} orderedCodes
 * @returns {Promise<boolean>}
 */
async function updateCodeMasterOrder(parentCode, orderedCodes) {
  if (!parentCode || !Array.isArray(orderedCodes)) return false;
  await query("BEGIN");
  try {
    for (let i = 0; i < orderedCodes.length; i++) {
      await query(
        'UPDATE "CodeMaster" SET sort_order = $1 WHERE code = $2 AND parent_code = $3',
        [i + 1, orderedCodes[i], parentCode],
      );
    }
    await query("COMMIT");
    return true;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

/**
 * 컬럼 코드 맵 조회
 * @param {string[]} names
 * @returns {Promise<Map<string, number>>}
 */
async function getColumnCodeMap(names) {
  const res = await query(
    'SELECT code, name FROM "CodeMaster" WHERE parent_code = 500 AND name = ANY($1)',
    [names],
  );
  const map = new Map();
  (res.rows || []).forEach((row) => {
    map.set(row.name, row.code);
  });
  return map;
}

/**
 * 양식지 컬럼 설정 저장
 * @param {number|string} formCode
 * @param {{ sku?: string, name?: string, expiry?: string, lot?: string, qty?: string }} columnMap
 * @returns {Promise<boolean>}
 */
async function updateFormColumns(formCode, columnMap) {
  const codeNum = Number(formCode);
  if (!Number.isFinite(codeNum)) return false;
  const names = ["SKU", "상품명", "유통기한", "로트", "수량"];
  const nameToValue = {
    "SKU": columnMap.sku,
    "상품명": columnMap.name,
    "유통기한": columnMap.expiry,
    "로트": columnMap.lot,
    "수량": columnMap.qty,
  };
  const codeMap = await getColumnCodeMap(names);
  const columnCodes = names.map((n) => codeMap.get(n)).filter(Boolean);
  await query("BEGIN");
  try {
    const nextIdRes = await query(
      'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM "SellerColumn"',
      [],
    );
    let nextId = Number(nextIdRes.rows?.[0]?.next_id || 1);
    await query(
      'DELETE FROM "SellerColumn" WHERE seller_code = $1',
      [codeNum],
    );
    for (const name of names) {
      const columnCode = codeMap.get(name);
      const raw = nameToValue[name];
      const value = raw === undefined || raw === null ? null : String(raw).trim() || null;
      if (!columnCode) continue;
      await query(
        'INSERT INTO "SellerColumn" (id, seller_code, column_code, "column") VALUES ($1, $2, $3, $4)',
        [nextId, codeNum, columnCode, value],
      );
      nextId += 1;
    }
    await query("COMMIT");
    return true;
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }
}

/**
 * ExcelFiles 테이블의 기본 템플릿 업데이트
 * @param {number} id
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
async function updateExcelTemplate(id, buffer, filename) {
  if (!id || !buffer) return false;
  const res = await query(
    'UPDATE "ExcelFiles" SET excelfile = $1, description = $2 WHERE id = $3',
    [buffer, filename || "", id],
  );
  return res.rowCount > 0;
}

/**
 * ExcelFiles 기본 템플릿 삭제 (파일/설명 초기화)
 * @param {number} id
 * @returns {Promise<boolean>}
 */
async function deleteExcelTemplate(id) {
  if (!id) return false;
  const res = await query(
    'UPDATE "ExcelFiles" SET excelfile = NULL, description = NULL WHERE id = $1',
    [id],
  );
  return res.rowCount > 0;
}

module.exports = {
  getClient,
  testConnection,
  query,
  close,
  findUserByName,
  getSellers,
  getProductTypes,
  getCenters,
  getShops,
  getForm,
  getCodeMasterList,
  saveCodeMasterItem,
  deleteCodeMasterItem,
  updateCodeMasterOrder,
  updateFormColumns,
  getColumnCodeMap,
  getFormBySeller,
  getFormColumns,
  getInboundCheckTemplate,
  getInboundExcelTemplate,
  updateExcelTemplate,
  deleteExcelTemplate,
};

