import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function value(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const scan = value("--scan");
const sentinel = value("--sentinel");
const forbidden = [];
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--forbid-in" && args[index + 1]) forbidden.push(args[++index]);
}

if (!scan || !sentinel || !forbidden.length) {
  throw new Error("Missing required build-check arguments.");
}
if (!fs.existsSync(scan)) throw new Error("Build output directory is missing.");

const scanRoot = fs.realpathSync(scan);

function assertInsideScanRoot(target, linkPath) {
  const relative = path.relative(scanRoot, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(
      "Build output symlink escapes scan root: " +
      path.relative(scanRoot, linkPath) +
      " -> " +
      target
    );
  }
}

// Walk the build output while safely following only symlinks whose real
// targets remain inside .next. Vercel creates internal function aliases
// (for example, route segment .func links) in its Next.js output.
function visitFiles(start, onFile) {
  const visitedDirectories = new Set();
  const visitedFiles = new Set();

  function visitFile(file) {
    const realFile = fs.realpathSync(file);
    assertInsideScanRoot(realFile, file);
    if (visitedFiles.has(realFile)) return;
    visitedFiles.add(realFile);
    onFile(realFile);
  }

  function visitDirectory(directory) {
    const realDirectory = fs.realpathSync(directory);
    assertInsideScanRoot(realDirectory, directory);

    const stats = fs.statSync(realDirectory);
    if (!stats.isDirectory()) throw new Error("Build scan path is not a directory: " + directory);
    if (visitedDirectories.has(realDirectory)) return;
    visitedDirectories.add(realDirectory);

    for (const entry of fs.readdirSync(realDirectory, { withFileTypes: true })) {
      const file = path.join(realDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        let target;
        try {
          target = fs.realpathSync(file);
        } catch {
          throw new Error("Broken symlink in build output: " + path.relative(scanRoot, file));
        }
        assertInsideScanRoot(target, file);

        const targetStats = fs.statSync(target);
        if (targetStats.isDirectory()) visitDirectory(target);
        else if (targetStats.isFile()) visitFile(target);
        else throw new Error("Unsupported symlink target in build output: " + path.relative(scanRoot, file));
      } else if (entry.isDirectory()) {
        visitDirectory(file);
      } else if (entry.isFile()) {
        visitFile(file);
      }
    }
  }

  visitDirectory(start);
}

const sentinelMatches = [];
visitFiles(scanRoot, (file) => {
  if (fs.readFileSync(file).includes(Buffer.from(sentinel))) sentinelMatches.push(file);
});
if (sentinelMatches.length) {
  throw new Error("AI sentinel found in build output: " + sentinelMatches.join(", "));
}

for (const entry of forbidden) {
  const split = entry.indexOf("=");
  if (split < 1) throw new Error("Invalid --forbid-in argument.");

  const directory = entry.slice(0, split);
  const tokens = entry.slice(split + 1).split(",").filter(Boolean);
  if (!fs.existsSync(directory)) continue;

  visitFiles(directory, (file) => {
    const data = fs.readFileSync(file, "utf8");
    for (const token of tokens) {
      if (data.includes(token)) {
        throw new Error("Forbidden environment variable name found in client output.");
      }
    }
  });
}

function readBuildManifest(file) {
  if (!fs.existsSync(file)) return null;
  const realFile = fs.realpathSync(file);
  assertInsideScanRoot(realFile, file);
  return JSON.parse(fs.readFileSync(realFile, "utf8"));
}

const appManifest = readBuildManifest(path.join(scanRoot, "server/app-paths-manifest.json"));
if (appManifest && Object.keys(appManifest).some((route) => /(^|\\/)api(\\/|$)/i.test(route))) {
  throw new Error("API route found in build manifest.");
}

const actionManifest = readBuildManifest(path.join(scanRoot, "server/server-reference-manifest.json"));
if (
  actionManifest &&
  Object.values(actionManifest).some((group) => group && typeof group === "object" && Object.keys(group).length > 0)
) {
  throw new Error("Server Action reference found in build manifest.");
}

console.log("Build boundary check passed. Scanned " + scan + " and client assets under .next, including in-root symlink targets.");
