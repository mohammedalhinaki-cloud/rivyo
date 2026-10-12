#!/usr/bin/env node
/**
 * توليد الأيقونات وشاشات البداية من icon-source.png (بلا أي اعتماديات خارجية).
 * المخرجات:
 *   - public/icons/icon-192.png + icon-512.png      (أيقونات الويب/PWA)
 *   - android/.../mipmap-<الكثافة>/ic_launcher.png   (الأيقونة العادية + الدائرية)
 *   - android/.../mipmap-<الكثافة>/ic_launcher_foreground.png (أيقونة تكيّفية بطبقة أمامية شفافة)
 *   - android/.../drawable-<الاتجاه>/splash.png      (شاشة البداية بكل الاتجاهات)
 *   - android/.../values/ic_launcher_background.xml (لون خلفية الأيقونة التكيّفية)
 *
 * التشغيل: node scripts/make-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resDir = join(root, "android", "app", "src", "main", "res");

/* ------------------------------ PNG قراءة/كتابة ------------------------------ */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) throw new Error("الملف ليس PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      if (data[8] !== 8) throw new Error("عمق البتات غير مدعوم");
      if (![2, 6].includes(colorType)) throw new Error(`نوع ألوان غير مدعوم: ${colorType}`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let cursor = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      switch (filter) {
        case 1:
          line[x] = (line[x] + left) & 0xff;
          break;
        case 2:
          line[x] = (line[x] + up) & 0xff;
          break;
        case 3:
          line[x] = (line[x] + ((left + up) >> 1)) & 0xff;
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          line[x] = (line[x] + predictor) & 0xff;
          break;
        }
        default:
          break;
      }
    }
    line.copy(pixels, y * stride);
    previous = line;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    rgba[index * 4] = pixels[index * channels];
    rgba[index * 4 + 1] = pixels[index * channels + 1];
    rgba[index * 4 + 2] = pixels[index * channels + 2];
    rgba[index * 4 + 3] = channels === 4 ? pixels[index * channels + 3] : 255;
  }
  return { width, height, data: rgba };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------ معالجة الصور ------------------------------ */

/** قص مربع مركزي. */
function centerSquare(image) {
  const size = Math.min(image.width, image.height);
  const offsetX = Math.floor((image.width - size) / 2);
  const offsetY = Math.floor((image.height - size) / 2);
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    image.data.copy(data, y * size * 4, ((y + offsetY) * image.width + offsetX) * 4, ((y + offsetY) * image.width + offsetX + size) * 4);
  }
  return { width: size, height: size, data };
}

/**
 * إعادة أخذ عيّنات (box filter) مع الحفاظ على الشفافية الصحيحة.
 * عند `canvas` أكبر من المحتوى يُرسم المحتوى في الوسط على خلفية `background`.
 */
function resize(image, targetWidth, targetHeight, options = {}) {
  const { background = null, scale = 1 } = options;
  const contentSize = Math.round(Math.min(targetWidth, targetHeight) * scale);
  const content = boxResize(image, contentSize, contentSize);
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  const offsetX = Math.floor((targetWidth - contentSize) / 2);
  const offsetY = Math.floor((targetHeight - contentSize) / 2);

  if (background) {
    for (let index = 0; index < targetWidth * targetHeight; index += 1) {
      out[index * 4] = background[0];
      out[index * 4 + 1] = background[1];
      out[index * 4 + 2] = background[2];
      out[index * 4 + 3] = background[3] ?? 255;
    }
  }

  for (let y = 0; y < contentSize; y += 1) {
    for (let x = 0; x < contentSize; x += 1) {
      const source = (y * contentSize + x) * 4;
      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (targetX < 0 || targetY < 0 || targetX >= targetWidth || targetY >= targetHeight) continue;
      const target = (targetY * targetWidth + targetX) * 4;
      const alpha = content.data[source + 3] / 255;
      if (alpha === 1 || !background) {
        content.data.copy(out, target, source, source + 4);
      } else {
        // مزج بسيط فوق الخلفية
        out[target] = Math.round(content.data[source] * alpha + out[target] * (1 - alpha));
        out[target + 1] = Math.round(content.data[source + 1] * alpha + out[target + 1] * (1 - alpha));
        out[target + 2] = Math.round(content.data[source + 2] * alpha + out[target + 2] * (1 - alpha));
        out[target + 3] = 255;
      }
    }
  }
  return { width: targetWidth, height: targetHeight, data: out };
}

function boxResize(image, targetWidth, targetHeight) {
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  const scaleX = image.width / targetWidth;
  const scaleY = image.height / targetHeight;
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY0 = Math.floor(y * scaleY);
    const sourceY1 = Math.min(image.height, Math.max(sourceY0 + 1, Math.ceil((y + 1) * scaleY)));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX0 = Math.floor(x * scaleX);
      const sourceX1 = Math.min(image.width, Math.max(sourceX0 + 1, Math.ceil((x + 1) * scaleX)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = sourceY0; sy < sourceY1; sy += 1) {
        for (let sx = sourceX0; sx < sourceX1; sx += 1) {
          const index = (sy * image.width + sx) * 4;
          const alpha = image.data[index + 3] / 255;
          r += image.data[index] * alpha;
          g += image.data[index + 1] * alpha;
          b += image.data[index + 2] * alpha;
          a += alpha;
          count += 1;
        }
      }
      const target = (y * targetWidth + x) * 4;
      if (a > 0) {
        out[target] = Math.round(r / a);
        out[target + 1] = Math.round(g / a);
        out[target + 2] = Math.round(b / a);
        out[target + 3] = Math.round((a / count) * 255);
      }
    }
  }
  return { width: targetWidth, height: targetHeight, data: out };
}

/** قناع دائري بحافة ناعمة (للأيقونة الدائرية). */
function applyCircleMask(image) {
  const out = Buffer.from(image.data);
  const radius = image.width / 2;
  const center = radius;
  const feather = Math.max(1, radius * 0.012);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      const index = (y * image.width + x) * 4;
      if (distance > radius) {
        out[index + 3] = 0;
      } else if (distance > radius - feather) {
        out[index + 3] = Math.round(out[index + 3] * ((radius - distance) / feather));
      }
    }
  }
  return { width: image.width, height: image.height, data: out };
}

function pixelAt(image, x, y) {
  const index = (y * image.width + x) * 4;
  return [image.data[index], image.data[index + 1], image.data[index + 2], image.data[index + 3]];
}

function write(filePath, image) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, encodePng(image));
  console.log(`✓ ${filePath.replace(`${root}/`, "")} (${image.width}×${image.height})`);
}

/* --------------------------------- التنفيذ --------------------------------- */

const source = centerSquare(decodePng(readFileSync(join(root, "icon-source.png"))));
const background = pixelAt(source, 6, 6); // لون خلفية الأيقونة التكيّفية = لون الحد الخارجي

/* 1) أيقونات الويب */
for (const size of [192, 512]) {
  write(join(root, "public", "icons", `icon-${size}.png`), resize(source, size, size));
}

/* 2) أيقونات أندرويد */
const LAUNCHER_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};
const FOREGROUND_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

for (const [density, size] of Object.entries(LAUNCHER_SIZES)) {
  const dir = join(resDir, `mipmap-${density}`);
  write(join(dir, "ic_launcher.png"), resize(source, size, size));
  write(join(dir, "ic_launcher_round.png"), applyCircleMask(resize(source, size, size)));
  // الطبقة الأمامية للأيقونة التكيّفية: 66% من المساحة (منطقة آمنة) على خلفية شفافة
  write(join(dir, "ic_launcher_foreground.png"), resize(source, FOREGROUND_SIZES[density], FOREGROUND_SIZES[density], { scale: 2 / 3 }));
}

writeFileSync(
  join(resDir, "values", "ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#${background
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}</color>\n</resources>\n`,
  "utf8",
);
console.log(`✓ values/ic_launcher_background.xml (لون #${background.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()})`);

/* 3) شاشات البداية */
const SPLASH = {
  drawable: [480, 320],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};

for (const [folder, [width, height]] of Object.entries(SPLASH)) {
  write(join(resDir, folder, "splash.png"), resize(source, width, height, { background, scale: 0.34 }));
}

console.log("\n✅ تم توليد كل الأيقونات وشاشات البداية.");
