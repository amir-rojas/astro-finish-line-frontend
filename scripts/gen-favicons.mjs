// Genera el set de favicons de Finish Line a partir del logo de marca.
//   node scripts/gen-favicons.mjs
//
// El logo completo (1600x1449) incluye el texto "LINE SPORTING EVENTS", ilegible
// a tamaño favicon. Recortamos solo la MARCA (montañas + corredor + cinta FINISH)
// y la montamos sobre un cuadro navy de marca para asegurar contraste en cualquier
// pestaña (clara u oscura), coherente con el lenguaje visual del sitio.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = `${ROOT}src/assets/images/logo.png`;
const OUT = `${ROOT}public`;
const NAVY = { r: 14, g: 28, b: 48, alpha: 1 }; // --fl-navy #0e1c30

// Caja de la marca dentro del logo original (sin el texto inferior).
const MARK = { left: 270, top: 185, width: 1085, height: 585 };

// Master 512: marca escalada al ~84% sobre cuadro navy.
const master = await sharp(SRC)
  .extract(MARK)
  .resize(432, 432, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 40, bottom: 40, left: 40, right: 40, background: NAVY })
  .png()
  .toBuffer();

async function png(size, name) {
  const buf = await sharp(master).resize(size, size).png().toBuffer();
  await writeFile(`${OUT}/${name}`, buf);
  return buf;
}

// ICO (envuelve un PNG de 48x48) para la petición legacy /favicon.ico.
function pngToIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuffer.length, 8); // image size
  entry.writeUInt32LE(22, 12); // offset (6 + 16)
  return Buffer.concat([header, entry, pngBuffer]);
}

await png(180, 'apple-touch-icon.png');
await png(32, 'favicon-32.png');
await png(16, 'favicon-16.png');

const ico48 = await sharp(master).resize(48, 48).png().toBuffer();
await writeFile(`${OUT}/favicon.ico`, pngToIco(ico48, 48));

console.log('favicons generados en public/: favicon.ico, favicon-16.png, favicon-32.png, apple-touch-icon.png');
