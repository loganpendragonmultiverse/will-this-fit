export const project = {
  title: "Will This Fit?",
  tagline: "Measure once. Compare every rectangular orientation.",
  intro:
    "Save a shelf, drawer or appliance space and compare an item with all six orientations. This checks rectangular dimensions only, not doors, stairs or a moving path.",
  fields: [
    ["name", "Plan name", "text", "Hall shelf"],
    ["unit", "Units", "unit", "cm"],
    ["sw", "Space width", "number", 90],
    ["sh", "Space height", "number", 40],
    ["sd", "Space depth", "number", 35],
    ["iw", "Item width", "number", 32],
    ["ih", "Item height", "number", 25],
    ["id", "Item depth", "number", 38],
    ["tolerance", "Required clearance on each axis", "number", 1],
  ],
  scope:
    "Saved rectangular space and item dimensions, six orientations, remaining clearance diagrams, printable comparison and portable backups.",
  slug: "will-this-fit",
};

export function number(
  value,
  label,
  { zero = false, max = 1000000, integer = false } = {},
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < (zero ? 0 : 0.001) ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(
      `${label} must be ${integer ? "a whole number " : ""}between ${zero ? 0 : integer ? 1 : 0.001} and ${max}.`,
    );
  return value;
}
export function validate(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan))
    throw new Error("Each plan must be an object.");
  const expected = project.fields.map((f) => f[0]);
  if (
    Object.keys(plan).length !== expected.length ||
    Object.keys(plan).some((k) => !expected.includes(k))
  )
    throw new Error("Plan fields do not match this tool.");
  const out = {};
  for (const [key, label, type] of project.fields) {
    const value = plan[key];
    if (type === "text") {
      if (typeof value !== "string" || !value.trim() || value.length > 120)
        throw new Error(`${label} must contain 1–120 characters.`);
      out[key] = value.trim();
    } else if (type === "unit") {
      if (!["cm", "mm", "in"].includes(value))
        throw new Error("Choose cm, mm or inches.");
      out[key] = value;
    } else
      out[key] = number(value, label, {
        zero: [
          "gapx",
          "gapy",
          "hookx",
          "hooky",
          "overlap",
          "tolerance",
        ].includes(key),
        max: type === "integer" ? 10 : 1000000,
        integer: type === "integer",
      });
  }
  calculate(out);
  return out;
}
export function parseBackup(text) {
  if (typeof text !== "string" || text.length > 1000000)
    throw new Error("Backup exceeds the 1 MB text limit.");
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    throw new Error("This is not valid JSON.");
  }
  if (
    !b ||
    b.tool !== project.slug ||
    b.version !== 1 ||
    !Array.isArray(b.plans) ||
    b.plans.length > 100 ||
    Object.keys(b).some((k) => !["tool", "version", "plans"].includes(k))
  )
    throw new Error(
      "Choose a version 1 backup from this tool with at most 100 plans.",
    );
  return b.plans.map(validate);
}
export function backup(plans) {
  return JSON.stringify(
    { tool: project.slug, version: 1, plans: plans.map(validate) },
    null,
    2,
  );
}
export function atLeast(a, b) {
  return a + Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 8 >= b;
}
export function round(value) {
  return Math.round(value * 1000) / 1000;
}

export function calculate(p) {
  const permutations = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ],
    dims = [p.iw, p.ih, p.id],
    labels = ["width", "height", "depth"];
  return permutations.map((order) => {
    const item = order.map((i) => dims[i]);
    const raw = [p.sw, p.sh, p.sd].map((d, i) => d - item[i]),
      clear = raw.map(round);
    return {
      label: order.map((i) => labels[i]).join(" × "),
      item,
      clear,
      fit: raw.every((d, i) =>
        atLeast([p.sw, p.sh, p.sd][i], item[i] + p.tolerance),
      ),
    };
  });
}
