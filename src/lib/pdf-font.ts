import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FONT_PATH = join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");

let fontBytes: Promise<Buffer> | undefined;

export function getPdfFontBytes(): Promise<Buffer> {
  fontBytes ??= readFile(FONT_PATH);
  return fontBytes;
}
