import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      const base = context.parentURL ? new URL(specifier, context.parentURL) : null;
      for (const extension of [".tsx", ".ts"]) {
        if (base && existsSync(fileURLToPath(new URL(`${specifier}${extension}`, context.parentURL)))) {
          return nextResolve(`${specifier}${extension}`, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    const source = readFileSync(new URL(url), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: url,
    }).outputText;
    return {
      format: "module",
      source: output,
      shortCircuit: true,
    };
  },
});
