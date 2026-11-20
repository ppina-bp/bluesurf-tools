/** Deep-merge plain objects; right-hand keys win. Arrays replace, not concat. */
export function deepMerge(base, override) {
  if (!override || typeof override !== "object") return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = structuredClone(value);
    }
  }
  return out;
}

export function getConfigValue(config, dotKey) {
  return dotKey.split(".").reduce((node, key) => (node == null ? undefined : node[key]), config);
}