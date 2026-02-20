const { Client } = require('pg');

// Supabase PostgreSQL 연결 설정
// 비밀번호는 환경변수 SUPABASE_DB_PASSWORD 사용 권장 (보안)
const dbConfig = {
  host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-south-1.pooler.supabase.com',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  user: process.env.SUPABASE_DB_USER || 'postgres.eaavbsmphazwbqtlkycm',
  password: process.env.SUPABASE_DB_PASSWORD || 'lulujy973164',
  ssl: { rejectUnauthorized: false }
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
    const res = await client.query('SELECT 1 as ok');
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
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const res = await query(
    'SELECT id, username FROM "Users" WHERE username = $1 LIMIT 1',
    [trimmed]
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
    []
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
    []
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
    []
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
    []
  );
  return res.rows || [];
}

/**
 * 셀러별 SellerColumn 매핑 조회 (엑셀 컬럼 매핑)
 * @param {number|string} sellerCode
 * @returns {Promise<Array<{ id: number, seller_code: number, column: string, column_code: number, name: string }>>}
 */
async function getSellerColumns(sellerCode) {
  const res = await query(
    `SELECT A.id, A.seller_code, A.column, A.column_code, B.name
     FROM "SellerColumn" AS A
     INNER JOIN "CodeMaster" AS B ON A.column_code = B.code
     WHERE A.seller_code = $1`,
    [sellerCode]
  );
  return res.rows || [];
}

// db.js
// 입고검수파일양식 (id = 1)
async function getInboundCheckTemplate() {
  try {
    const res = await query(
      'SELECT excelfile, description FROM "ExcelFiles" WHERE id = 1',
      []
    );

    if (res.rows && res.rows.length > 0) {
      const fileData = res.rows[0].excelfile;
      
      return {
        buffer: fileData,
        filename: res.rows[0].description
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
      []
    );

    if (res.rows && res.rows.length > 0) {
      const fileData = res.rows[0].excelfile;
      
      return {
        buffer: fileData,
        filename: res.rows[0].description
      };
    }
    return null;
  } catch (err) {
    console.error("DB 쿼리 중 에러 발생:", err);
    throw err;
  }
}

module.exports = {
  dbConfig,
  getClient,
  testConnection,
  query,
  close,
  findUserByName,
  getSellers,
  getProductTypes,
  getCenters,
  getShops,
  getSellerColumns,
  getInboundCheckTemplate,
  getInboundExcelTemplate,
};
