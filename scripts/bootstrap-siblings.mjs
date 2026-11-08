import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "siblings.json"), "utf8"));
const mode = process.argv[2] ?? "";

function fail(message) {
  console.error(`bootstrap: ${message}`);
  process.exit(1);
}

function parseVersion(value) {
  const numbers = String(value).replace(/^v/, "").split(".").map((part) => Number(part));
  if (numbers.length < 3 || numbers.some((part) => !Number.isInteger(part))) {
    fail(`invalid Node version "${value}"`);
  }
  return numbers;
}

function versionAtLeast(current, minimum) {
  const left = parseVersion(current);
  const right = parseVersion(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function assertNode() {
  if (!versionAtLeast(process.versions.node, manifest.minimumNode)) {
    fail(`Node ${process.versions.node} is below ${manifest.minimumNode}. Use Node ${manifest.node}.`);
  }
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readPackage(directory) {
  const path = resolve(directory, "package.json");
  if (!existsSync(path)) fail(`${directory} has no package.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`${path} is not valid JSON. The checkout was left unchanged.`);
  }
}

function siblingPath(repository) {
  return resolve(root, "..", repository.directory);
}

function isGitCheckout(directory) {
  try {
    git(["rev-parse", "--is-inside-work-tree"], directory);
    return true;
  } catch {
    return false;
  }
}

function isEmpty(directory) {
  return readdirSync(directory).length === 0;
}

function checkoutState(directory) {
  return {
    commit: git(["rev-parse", "HEAD"], directory),
    tree: git(["rev-parse", "HEAD^{tree}"], directory),
    dirty: git(["status", "--porcelain", "--untracked-files=all"], directory).length > 0,
  };
}

function matches(repository, directory) {
  const pkg = readPackage(directory);
  const state = checkoutState(directory);
  if (pkg.name !== repository.package) {
    return { ok: false, state, reason: `package name is ${pkg.name}, expected ${repository.package}` };
  }
  if (pkg.version !== repository.version) {
    return { ok: false, state, reason: `package version is ${pkg.version}, expected ${repository.version}` };
  }
  if (state.commit === repository.commit) {
    return { ok: true, state, how: `commit ${repository.commit}` };
  }
  if (state.tree === repository.tree) {
    return { ok: true, state, how: `tree ${repository.tree} (same content as ${repository.ref})` };
  }
  return {
    ok: false,
    state,
    reason: `commit ${state.commit} does not match ${repository.ref} (${repository.commit})`,
  };
}

function rejectMismatch(repository, directory, result) {
  const preservation = result.state.dirty
    ? "It has uncommitted work and was left unchanged."
    : "It was left unchanged.";
  fail(
    `${directory} is not ${repository.package} ${repository.version} (${repository.ref}). ${result.reason}. ${preservation}`,
  );
}

function cloneRepository(repository, directory) {
  const args = ["clone", "--depth", "1", "--branch", repository.ref, repository.url];
  if (existsSync(directory)) args.push(".");
  else args.push(directory);
  execFileSync("git", args, {
    cwd: existsSync(directory) ? directory : root,
    stdio: "inherit",
  });
}

function ensureRepository(repository) {
  const directory = siblingPath(repository);
  if (!existsSync(directory)) {
    cloneRepository(repository, directory);
    const created = matches(repository, directory);
    if (!created.ok) {
      fail(`cloned ${repository.url} at ${repository.ref}, but ${created.reason}`);
    }
    console.log(`${repository.directory}: cloned ${repository.ref} (${created.state.commit})`);
    return;
  }
  if (!isGitCheckout(directory)) {
    if (isEmpty(directory)) {
      cloneRepository(repository, directory);
      const created = matches(repository, directory);
      if (!created.ok) fail(`cloned ${repository.url} at ${repository.ref}, but ${created.reason}`);
      console.log(`${repository.directory}: cloned ${repository.ref} (${created.state.commit})`);
      return;
    }
    fail(`${directory} exists and is not a Git checkout. It was left unchanged.`);
  }
  const current = matches(repository, directory);
  if (!current.ok) rejectMismatch(repository, directory, current);
  console.log(`${repository.directory}: reusing existing checkout at ${repository.ref} via ${current.how}`);
}

function checkRepositories() {
  for (const repository of manifest.repositories) {
    const directory = siblingPath(repository);
    if (!existsSync(directory)) fail(`${directory} is missing`);
    if (!isGitCheckout(directory)) fail(`${directory} is not a Git checkout`);
    const current = matches(repository, directory);
    if (!current.ok) rejectMismatch(repository, directory, current);
    console.log(`${repository.directory}: ${repository.ref} via ${current.how}`);
  }
}

function writeGithubOutput() {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) fail("GITHUB_OUTPUT is not set");
  const lines = [`node_version=${manifest.node}`];
  for (const repository of manifest.repositories) {
    lines.push(`${repository.id}_repository=${repository.repository}`);
    lines.push(`${repository.id}_ref=${repository.ref}`);
  }
  appendFileSync(file, `${lines.join("\n")}\n`);
}

for (const repository of manifest.repositories) {
  for (const field of ["id", "package", "version", "directory", "repository", "url", "ref", "commit", "tree"]) {
    if (!repository[field]) fail(`siblings.json entry is missing ${field}`);
  }
}
if (!manifest.node || !manifest.minimumNode) fail("siblings.json is missing Node versions");

if (mode === "--github-output") {
  writeGithubOutput();
} else if (mode === "--check") {
  checkRepositories();
} else if (mode === "") {
  assertNode();
  for (const repository of manifest.repositories) ensureRepository(repository);
} else {
  fail(`unknown argument "${mode}"`);
}
