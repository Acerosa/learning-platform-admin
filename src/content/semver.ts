const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function isSemver(value: string) {
  return SEMVER.test(value);
}

export function parseSemver(value: string): [number, number, number] {
  const match = SEMVER.exec(value);
  if (!match) {
    throw new Error(`'${value}' is not a semantic version of the form 0.1.0.`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(left: string, right: string) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function bumpPatch(value: string) {
  const [major, minor, patch] = parseSemver(value);
  return `${major}.${minor}.${patch + 1}`;
}
