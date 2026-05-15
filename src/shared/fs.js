import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function readText(path, fallback = null) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function readJson(path, fallback = null) {
  const text = await readText(path, null);
  if (text === null) return fallback;
  return JSON.parse(text);
}

export async function writeText(path, text) {
  await ensureDir(dirname(path));
  await writeFile(path, text, "utf8");
}

export async function writeJsonAtomic(path, value) {
  const target = resolve(path);
  const tmp = `${target}.tmp`;
  await ensureDir(dirname(target));
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, target);
}
