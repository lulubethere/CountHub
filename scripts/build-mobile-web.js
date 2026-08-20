const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(projectRoot, "mobile-web");
const defaultApiBaseUrl = String(process.env.MOBILE_DEFAULT_API_BASE_URL || "").trim();

const filesToCopy = [
  {
    from: path.join(projectRoot, "html", "06 mobile-item-location.html"),
    to: path.join(outputRoot, "index.html"),
    transform(content) {
      return content
        .replace(/\.\.\/style\//g, "./style/")
        .replace(/\.\.\/js\//g, "./js/");
    },
  },
  {
    from: path.join(projectRoot, "scripts", "mobile-runtime-config.template.js"),
    to: path.join(outputRoot, "js", "mobile-runtime-config.js"),
    transform(content) {
      return content.replace("__MOBILE_DEFAULT_API_BASE_URL__", JSON.stringify(defaultApiBaseUrl));
    },
  },
  {
    from: path.join(projectRoot, "style", "common-style.css"),
    to: path.join(outputRoot, "style", "common-style.css"),
  },
  {
    from: path.join(projectRoot, "style", "mobile-item-location.css"),
    to: path.join(outputRoot, "style", "mobile-item-location.css"),
  },
  {
    from: path.join(projectRoot, "js", "mobile-item-location.js"),
    to: path.join(outputRoot, "js", "mobile-item-location.js"),
  },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile({ from, to, transform }) {
  ensureDir(path.dirname(to));
  if (transform) {
    const content = fs.readFileSync(from, "utf8");
    fs.writeFileSync(to, transform(content), "utf8");
    return;
  }
  fs.copyFileSync(from, to);
}

function buildMobileWeb() {
  fs.rmSync(outputRoot, { recursive: true, force: true });
  ensureDir(outputRoot);

  filesToCopy.forEach(copyFile);
  console.log(`[mobile-web] built at ${outputRoot}`);
}

buildMobileWeb();
