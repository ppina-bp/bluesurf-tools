import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import toml from "smol-toml";

export async function readTomlFile(filePath) {
  const text = await readFile(filePath, "utf8");
  return toml.parse(text);
}

export async function writeTomlFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${toml.stringify(data).trimEnd()}\n`, "utf8");
}