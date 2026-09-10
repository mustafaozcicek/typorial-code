import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptDirectory, "..", "typorial-master-glyphs-clean.json");
const outputPath = join(scriptDirectory, "glyphs.generated.js");
const glyphs = JSON.parse(await readFile(sourcePath, "utf8"));

for (const [character, variants] of Object.entries(glyphs)) {
  for (const span of [1, 2, 3]) {
    const rows = variants[span];
    if (!Array.isArray(rows) || rows.length !== span * 9) {
      throw new Error(`${JSON.stringify(character)} has an invalid ${span}-cell variant`);
    }
    if (rows.some((row) => !/^[01]{9}$/.test(row))) {
      throw new Error(`${JSON.stringify(character)} contains an invalid pixel row`);
    }
  }
}

const banner =
  "// Generated from ../typorial-master-glyphs-clean.json. Run `node script/generate-glyphs.mjs` after editing the JSON.\n";
await writeFile(
  outputPath,
  `${banner}window.TYPORIAL_GLYPHS = ${JSON.stringify(glyphs, null, 2)};\n`,
);

console.log(`Generated ${Object.keys(glyphs).length} glyphs in ${outputPath}`);
