const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");
const db = require("./db.js");

const DEFAULT_PORT = Number(process.env.MOBILE_API_PORT || 3100);
const DEFAULT_HOST = process.env.MOBILE_API_HOST || "0.0.0.0";
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MOBILE_HTML_PATH = path.join(PROJECT_ROOT, "html", "06 mobile-item-location.html");
const STATIC_ROOTS = {
  "/js/": path.join(PROJECT_ROOT, "js"),
  "/style/": path.join(PROJECT_ROOT, "style"),
};
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sendEmpty(res, statusCode = 204) {
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

function normalizeItemLocationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    productName: row.product_name,
    groupName: row.group_name || "",
    location: row.location,
    note: row.note || "",
    workerName: row.worker_name || "",
    isMissing: !!row.is_missing,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeGroupRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("요청 본문이 너무 큽니다."));
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("JSON 형식이 올바르지 않습니다."));
      }
    });

    req.on("error", reject);
  });
}

function getServerAddresses(port) {
  const networkMap = os.networkInterfaces();
  const addresses = [];

  Object.entries(networkMap).forEach(([name, items]) => {
    (items || []).forEach((item) => {
      const family =
        typeof item.family === "string" ? item.family : item.family === 4 ? "IPv4" : "";
      if (!item || item.internal || family !== "IPv4" || !item.address) return;

      addresses.push({
        label: name,
        ip: item.address,
        url: `http://${item.address}:${port}`,
        mobileUrl: `http://${item.address}:${port}/mobile`,
      });
    });
  });

  return addresses.sort((a, b) => a.ip.localeCompare(b.ip, "en"));
}

function sendHtml(res, filePath) {
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[".html"],
  });
  res.end(content);
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendStaticFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
  });
  res.end(content);
}

function resolveStaticFile(pathname) {
  const prefix = Object.keys(STATIC_ROOTS).find((item) => pathname.startsWith(item));
  if (!prefix) return null;

  const rootDir = STATIC_ROOTS[prefix];
  const relativePath = pathname.slice(prefix.length).replace(/\//g, path.sep);
  const filePath = path.normalize(path.join(rootDir, relativePath));

  if (!filePath.startsWith(rootDir)) {
    return null;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  return filePath;
}

async function routeRequest(req, res) {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: "잘못된 요청입니다." });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const { pathname, searchParams } = url;
  const method = String(req.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    sendEmpty(res);
    return;
  }

  if (method === "GET" && pathname === "/") {
    sendRedirect(res, "/mobile");
    return;
  }

  if (method === "GET" && pathname === "/mobile") {
    sendHtml(res, MOBILE_HTML_PATH);
    return;
  }

  if (method === "GET") {
    const staticFilePath = resolveStaticFile(pathname);
    if (staticFilePath) {
      sendStaticFile(res, staticFilePath);
      return;
    }
  }

  if (method === "GET" && pathname === "/api/mobile/health") {
    sendJson(res, 200, {
      ok: true,
      service: "counthub-mobile-api",
      date: "2026-08-20",
    });
    return;
  }

  if (method === "GET" && pathname === "/api/mobile/server-info") {
    const hostHeader = String(req.headers.host || "");
    const requestPort = Number(hostHeader.split(":").pop()) || DEFAULT_PORT;
    sendJson(res, 200, {
      ok: true,
      port: requestPort,
      localhostUrl: `http://localhost:${requestPort}`,
      mobileUrl: `http://localhost:${requestPort}/mobile`,
      addresses: getServerAddresses(requestPort),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/mobile/login") {
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    if (!name) {
      sendJson(res, 400, { ok: false, error: "이름을 입력해주세요." });
      return;
    }

    const user = await db.findUserByName(name);
    if (!user) {
      sendJson(res, 404, { ok: false, error: "등록된 이름이 아닙니다." });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      user: {
        id: user.id,
        name: user.username,
      },
    });
    return;
  }

  if (method === "GET" && pathname === "/api/mobile/item-locations") {
    const keyword = String(searchParams.get("keyword") || "").trim();
    const rows = await db.searchItemLocations({ keyword });
    sendJson(res, 200, {
      ok: true,
      data: rows.map(normalizeItemLocationRow),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/mobile/item-locations") {
    const body = await readJsonBody(req);
    const payload = {
      productName: String(body.productName || "").trim(),
      groupName: String(body.groupName || "").trim(),
      location: String(body.location || "").trim(),
      note: String(body.note || "").trim(),
      workerName: String(body.workerName || "").trim(),
    };

    if (!payload.productName || !payload.groupName || !payload.location) {
      sendJson(res, 400, { ok: false, error: "품명, 그룹, 위치를 모두 입력해주세요." });
      return;
    }

    const duplicate = await db.findDuplicateItemLocation(
      payload.productName,
      payload.location,
      null,
    );
    if (duplicate && !body.allowDuplicate) {
      sendJson(res, 409, {
        ok: false,
        duplicate: true,
        error: "이미 존재하지만 등록하시겠습니까?",
      });
      return;
    }

    const saved = await db.saveItemLocation(payload);
    if (!saved) {
      sendJson(res, 400, { ok: false, error: "저장에 실패했습니다." });
      return;
    }

    sendJson(res, 201, { ok: true, data: normalizeItemLocationRow(saved) });
    return;
  }

  if (method === "PUT" && /^\/api\/mobile\/item-locations\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").pop());
    const body = await readJsonBody(req);
    const payload = {
      id,
      productName: String(body.productName || "").trim(),
      groupName: String(body.groupName || "").trim(),
      location: String(body.location || "").trim(),
      note: String(body.note || "").trim(),
      workerName: String(body.workerName || "").trim(),
    };

    if (!payload.productName || !payload.groupName || !payload.location) {
      sendJson(res, 400, { ok: false, error: "품명, 그룹, 위치를 모두 입력해주세요." });
      return;
    }

    const duplicate = await db.findDuplicateItemLocation(
      payload.productName,
      payload.location,
      payload.id,
    );
    if (duplicate && !body.allowDuplicate) {
      sendJson(res, 409, {
        ok: false,
        duplicate: true,
        error: "이미 존재하지만 등록하시겠습니까?",
      });
      return;
    }

    const saved = await db.saveItemLocation(payload);
    if (!saved) {
      sendJson(res, 404, { ok: false, error: "수정할 데이터를 찾지 못했습니다." });
      return;
    }

    sendJson(res, 200, { ok: true, data: normalizeItemLocationRow(saved) });
    return;
  }

  if (method === "PATCH" && /^\/api\/mobile\/item-locations\/\d+\/missing$/.test(pathname)) {
    const segments = pathname.split("/");
    const id = Number(segments[segments.length - 2]);
    const body = await readJsonBody(req);
    const updated = await db.markItemLocationMissing(id, !!body.isMissing);
    if (!updated) {
      sendJson(res, 404, { ok: false, error: "상태를 변경할 데이터를 찾지 못했습니다." });
      return;
    }

    sendJson(res, 200, { ok: true, data: normalizeItemLocationRow(updated) });
    return;
  }

  if (method === "DELETE" && /^\/api\/mobile\/item-locations\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").pop());
    const deleted = await db.deleteItemLocation(id);
    if (!deleted) {
      sendJson(res, 404, { ok: false, error: "삭제할 데이터를 찾지 못했습니다." });
      return;
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/api/mobile/item-location-groups") {
    const groups = await db.getItemLocationGroups();
    sendJson(res, 200, {
      ok: true,
      data: groups.map(normalizeGroupRow),
    });
    return;
  }

  if (method === "POST" && pathname === "/api/mobile/item-location-groups") {
    const body = await readJsonBody(req);
    const result = await db.addItemLocationGroup(body.name);
    if (!result?.row && !result?.duplicate) {
      sendJson(res, 400, { ok: false, error: "그룹명을 입력해주세요." });
      return;
    }
    if (result.duplicate) {
      sendJson(res, 409, {
        ok: false,
        duplicate: true,
        error: "이미 등록된 그룹입니다.",
        data: normalizeGroupRow(result.row),
      });
      return;
    }

    sendJson(res, 201, {
      ok: true,
      data: normalizeGroupRow(result.row),
    });
    return;
  }

  if (method === "DELETE" && pathname.startsWith("/api/mobile/item-location-groups/")) {
    const name = decodeURIComponent(pathname.split("/").pop() || "");
    const deleted = await db.deleteItemLocationGroup(name);
    if (!deleted) {
      sendJson(res, 404, { ok: false, error: "삭제할 그룹을 찾지 못했습니다." });
      return;
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, error: "지원하지 않는 경로입니다." });
}

function createMobileApiServer() {
  return http.createServer(async (req, res) => {
    try {
      await routeRequest(req, res);
    } catch (error) {
      console.error("[mobile-api]", error);
      sendJson(res, 500, {
        ok: false,
        error: error?.message || "서버 오류가 발생했습니다.",
      });
    }
  });
}

function startMobileApiServer(port = DEFAULT_PORT, host = DEFAULT_HOST) {
  const server = createMobileApiServer();
  server.listen(port, host, () => {
    const addresses = getServerAddresses(port);
    console.log(`[CountHub Mobile API] http://${host}:${port}`);
    console.log(`[CountHub Mobile Web] http://${host}:${port}/mobile`);
    addresses.forEach((address) => {
      console.log(`[CountHub Mobile Web] ${address.mobileUrl}`);
    });
  });
  return server;
}

if (require.main === module) {
  startMobileApiServer();
}

module.exports = {
  createMobileApiServer,
  startMobileApiServer,
};
