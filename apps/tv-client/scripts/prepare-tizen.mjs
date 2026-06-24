import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const tizenDir = path.join(root, "build", "tizen");
const packagePath = path.join(root, "build", "tvsys-display.wgt");

if (!fs.existsSync(distDir)) {
  throw new Error("TV client dist directory is missing. Run pnpm build first.");
}

fs.rmSync(tizenDir, { recursive: true, force: true });
fs.mkdirSync(tizenDir, { recursive: true });
fs.cpSync(distDir, tizenDir, { recursive: true });
fs.copyFileSync(path.join(root, "tizen", "config.xml"), path.join(tizenDir, "config.xml"));

fs.rmSync(packagePath, { force: true });
const zip = spawnSync("zip", ["-qr", packagePath, "."], {
  cwd: tizenDir,
  stdio: "inherit"
});

if (zip.status !== 0) {
  throw new Error("Could not create .wgt archive with zip.");
}

console.log(`Prepared ${packagePath}`);
