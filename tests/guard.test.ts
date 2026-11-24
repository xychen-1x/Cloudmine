import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import ts from "typescript";

const root = process.cwd();
const excluded = new Set(["node_modules", ".git", ".next", ".vercel", "coverage"]);
const analyzed = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const inert = new Set([
  ".json", ".css", ".scss", ".md", ".txt", ".svg", ".png", ".jpg",
  ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".lock",
  ".yml", ".yaml",
]);
const builtins = new Set(builtinModules.flatMap((name) => [name, name.replace(/^node:/, "")]));
const configPath = path.join(root, "tsconfig.json");
const parsedConfig = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: () => undefined,
});
if (!parsedConfig) throw new Error("Unable to parse the root TypeScript configuration.");
const compilerOptions: ts.CompilerOptions = parsedConfig.options;
const scannedFiles = walkForProgram(root);
const guardProgram = ts.createProgram(scannedFiles.filter((file) => analyzed.has(path.extname(file))), compilerOptions);
function walkForProgram(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) walkForProgram(file, out); }
    else if (analyzed.has(path.extname(file))) out.push(file);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symlink: " + path.relative(root, file));
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) walk(file, out);
      continue;
    }
    out.push(file);
  }
  return out;
}

function isTest(file: string): boolean {
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  const inRoute = /(^|\/)(app|pages)(\/|$)/.test(rel);
  return !inRoute && (/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel) || /(^|\/)(__tests__|tests)\//.test(rel));
}

function isAI(file: string): boolean {
  return path.relative(root, file).replaceAll(path.sep, "/").startsWith("src/lib/ai/");
}

function resolve(from: string, specifier: string): string | undefined {
  return ts.resolveModuleName(specifier, from, compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
}

function inspect(): string[] {
  const errors: string[] = [];
  for (const file of walk(root)) {
    const rel = path.relative(root, file).replaceAll(path.sep, "/");
    const ext = path.extname(file);
    const base = path.basename(file);

    if (base === "package.json") {
      try {
        const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
        for (const key of ["imports", "exports", "workspaces"]) {
          if (key in pkg) errors.push(rel + ": forbidden " + key);
        }
        const groups = [
          pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies,
          pkg.peerDependencies, pkg.overrides, pkg.resolutions,
          (pkg.pnpm as { overrides?: unknown } | undefined)?.overrides,
        ];
        for (const group of groups) {
          if (!group || typeof group !== "object") continue;
          for (const [name, value] of Object.entries(group)) {
            if (typeof value === "string" && /^(file:|link:|portal:|workspace:|\.\.?\/|\/)/.test(value)) {
              errors.push(rel + ": path dependency " + name);
            }
          }
        }
      } catch {
        errors.push(rel + ": invalid package json");
      }
      continue;
    }

    if (/^tsconfig.*\.json$/.test(base) || base === "jsconfig.json") {
      const parsed = ts.getParsedCommandLineOfConfigFile(file, {}, {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => errors.push(rel + ": invalid TypeScript config"),
      });
      if (!parsed) errors.push(rel + ": unresolved TypeScript config");
      continue;
    }

    if (analyzed.has(ext)) {
      const source = fs.readFileSync(file, "utf8");
      const sf = guardProgram.getSourceFile(file);
      if (!sf || guardProgram.getSyntacticDiagnostics(sf).length > 0) {
        errors.push(rel + ": parse error");
      }

      if (!isTest(file) && !isAI(file) && /lib[\\/]ai/.test(source)) {
        errors.push(rel + ": literal AI path");
      }
      if (/^next\.config\./.test(base) && /(alias|resolveAlias|webpack)/.test(source)) {
        errors.push(rel + ": Next alias/webpack config forbidden");
      }

      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          const spec = node.moduleSpecifier;
          if (spec && ts.isStringLiteral(spec)) {
            const style = /\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|ico|woff2?|ttf)$/.test(spec.text);
            const target = style ? undefined : resolve(file, spec.text);
            const builtin = builtins.has(spec.text) || builtins.has(spec.text.replace(/^node:/, ""));
            if (!target && !style && !builtin) errors.push(rel + ": unresolved import " + spec.text);
            if (target && path.resolve(target).replaceAll(path.sep, "/").includes("/src/lib/ai/") && !isTest(file) && !isAI(file)) {
              errors.push(rel + ": imports AI layer");
            }
            if (target && isTest(target) && !isTest(file)) errors.push(rel + ": imports test file");
          }
        }

        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const dynamicImport = expression.kind === ts.SyntaxKind.ImportKeyword;
          const requireCall = ts.isIdentifier(expression) && expression.text === "require";
          const propertyCall = ts.isPropertyAccessExpression(expression) &&
            ((ts.isIdentifier(expression.expression) && expression.expression.text === "require" && expression.name.text === "resolve") ||
             (ts.isMetaProperty(expression.expression) && expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword && expression.expression.name.text === "meta" && expression.name.text === "resolve"));
          if ((dynamicImport || requireCall) && (!node.arguments[0] || !ts.isStringLiteral(node.arguments[0])) && !isTest(file)) {
            errors.push(rel + ": non-literal module loading");
          }
          if (propertyCall && !isTest(file)) errors.push(rel + ": dynamic module resolution forbidden");
          if (ts.isIdentifier(expression) && ["eval", "Function", "createRequire"].includes(expression.text) && !isTest(file)) {
            errors.push(rel + ": dynamic code/module loading forbidden");
          }
        }

        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Function" && !isTest(file)) {
          errors.push(rel + ": dynamic code execution");
        }
        if (ts.isStringLiteral(node) && node.text === "use server") errors.push(rel + ": Server Action directive");
        ts.forEachChild(node, visit);
      };
      visit(sf);
      continue;
    }

    if (inert.has(ext) || [".gitignore", ".env.example", ".nvmrc", ".npmrc", "LICENSE"].includes(base) ||
        !ext || base.startsWith(".env.")) continue;
    errors.push(rel + ": unclassified extension");
  }
  return errors;
}

describe("AI boundary guard", () => {
  it("scans the repo with only the documented fixed exclusions", () => {
    expect([...excluded].sort()).toEqual([".git", ".next", ".vercel", "coverage", "node_modules"]);
    expect(inspect()).toEqual([]);
  });

  it("keeps unsupported source formats such as MDX classified as unknown", () => {
    expect(inert.has(".mdx")).toBe(false);
  });

  it("does not exempt scripts or allow a build checker to import AI", () => {
    const checker = path.join(root, "scripts/check-build.mjs");
    expect(fs.existsSync(checker)).toBe(true);
    expect(fs.readFileSync(checker, "utf8")).not.toMatch(/lib[\\/]ai/);
    expect(inspect().filter((error) => error.includes("scripts/"))).toEqual([]);
  });

  it("keeps production server-only markers", () => {
    for (const file of walk(path.join(root, "src/lib/ai")).filter((item) => analyzed.has(path.extname(item)))) {
      expect(fs.readFileSync(file, "utf8")).toContain('import "server-only"');
    }
  });
});
