import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sourceRoot = process.argv[2];
if (!sourceRoot || !existsSync(sourceRoot)) {
  throw new Error('Pasá la ruta de la carpeta FOTO PRODUCTO SEGMENTADO.');
}

const families = [
  { folder: 'FAMILIA MERMELADAS', slug: 'mermeladas' },
  { folder: 'FAMILIA MERMELADAS LIGHT', slug: 'mermeladas-light' },
  { folder: 'FAMILIA MERMELADAS Y BATATA ZERO', slug: 'mermeladas-zero' },
  { folder: 'FAMILIA TRADICIONAL', slug: 'tradicional' },
  { folder: 'FAMILIA ADEREZOS', slug: 'aderezos' },
  { folder: 'FAMILIA JUGOS', slug: 'jugos' },
  { folder: 'FAMILIA GRANOS', slug: 'granos' },
  { folder: 'FAMILIA REPOSTERIA', slug: 'reposteria' },
  { folder: 'FAMILIA SALUDABLES', slug: 'saludables' },
  { folder: 'FAMILIA SNACKS', slug: 'snacks' },
  { folder: 'FAMILIA NAVIDEÑA', slug: 'navidena' },
  { folder: 'FAMILIA ZERO', slug: 'zero' },
];

const outputRoot = path.resolve('public/images/imagenes');
const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const cleanName = (value) =>
  value
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bmemelada\b/gi, 'mermelada')
    .replace(/\blght\b/gi, 'light')
    .replace(/repsotero/gi, 'repostero');

const titleCase = (value) =>
  value
    .toLocaleLowerCase('es')
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase('es') + word.slice(1))
    .join(' ')
    .replace(/\bMl\b/g, 'ml')
    .replace(/\bKg\b/g, 'kg')
    .replace(/\bG\b/g, 'g')
    .replace(/\bL\b/g, 'L');

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

for (const family of families) {
  await fs.rm(path.join(outputRoot, family.slug), { recursive: true, force: true });
}

const jobs = [];
for (const family of families) {
  const directory = path.join(sourceRoot, family.folder);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(jpe?g|png)$/i.test(entry.name)) continue;
    jobs.push({ family, filename: entry.name, source: path.join(directory, entry.name) });
  }
}

const used = new Set();
const planned = jobs.map((job) => {
  const nombre = titleCase(cleanName(path.parse(job.filename).name));
  let base = slugify(nombre);
  while (used.has(`${job.family.slug}/${base}`)) base += '-2';
  used.add(`${job.family.slug}/${base}`);
  return {
    ...job,
    nombre,
    id: `${job.family.slug}-${base}`,
    filename: `${base}.webp`,
  };
});

const canvasWidth = 1200;
const canvasHeight = 800;
const canvasBackground = { r: 244, g: 244, b: 244 };

const isBackdrop = (r, g, b, a) => {
  if (a < 24) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 14 && (r + g + b) / 3 > 150;
};

async function fitProduct(source) {
  const prepared = sharp(source).rotate().resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const { data, info } = await prepared.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const background = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    const index = y * width + x;
    if (background[index]) return;
    const offset = index * channels;
    if (!isBackdrop(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return;
    background[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  const distance = new Uint16Array(width * height);
  distance.fill(65535);
  for (let i = 0; i < distance.length; i += 1) {
    const offset = i * channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    if (data[offset + 3] > 180 && Math.max(red, green, blue) - Math.min(red, green, blue) > 42) {
      distance[i] = 0;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let next = distance[index];
      if (x > 0) next = Math.min(next, distance[index - 1] + 1);
      if (y > 0) next = Math.min(next, distance[index - width] + 1);
      if (x > 0 && y > 0) next = Math.min(next, distance[index - width - 1] + 1);
      if (x < width - 1 && y > 0) next = Math.min(next, distance[index - width + 1] + 1);
      distance[index] = next;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      let next = distance[index];
      if (x < width - 1) next = Math.min(next, distance[index + 1] + 1);
      if (y < height - 1) next = Math.min(next, distance[index + width] + 1);
      if (x < width - 1 && y < height - 1) next = Math.min(next, distance[index + width + 1] + 1);
      if (x > 0 && y < height - 1) next = Math.min(next, distance[index + width - 1] + 1);
      distance[index] = next;
    }
  }
  const farStain = Math.round(Math.max(width, height) * 0.11);
  const nearStain = Math.round(Math.max(width, height) * 0.015);
  for (let i = 0; i < distance.length; i += 1) {
    if (background[i]) continue;
    const offset = i * channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    const luminance = (red + green + blue) / 3;
    const neutral = spread < 28 && luminance > 55;
    const farGray = distance[i] > farStain && neutral && luminance < 236;
    const darkHalo = distance[i] > nearStain && neutral && luminance < 185;
    if (farGray || darkHalo) background[i] = 1;
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (background[y * width + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  const usable = boxWidth > width * 0.12 && boxHeight > height * 0.12;
  const padding = usable ? Math.round(Math.max(boxWidth, boxHeight) * 0.06) : 0;
  const left = usable ? Math.max(0, minX - padding) : 0;
  const top = usable ? Math.max(0, minY - padding) : 0;
  const right = usable ? Math.min(width - 1, maxX + padding) : width - 1;
  const bottom = usable ? Math.min(height - 1, maxY + padding) : height - 1;
  const extracted = Buffer.from(data);
  for (let i = 0; i < background.length; i += 1) {
    if (!background[i]) continue;
    const offset = i * channels;
    extracted[offset] = canvasBackground.r;
    extracted[offset + 1] = canvasBackground.g;
    extracted[offset + 2] = canvasBackground.b;
    extracted[offset + 3] = 255;
  }

  const product = await sharp(extracted, { raw: { width, height, channels } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({
      width: Math.round(canvasWidth * 0.92),
      height: Math.round(canvasHeight * 0.92),
      fit: 'inside',
    })
    .removeAlpha()
    .png()
    .toBuffer();

  return sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 3, background: canvasBackground },
  })
    .composite([{ input: product, gravity: 'centre' }])
    .webp({ quality: 76, effort: 4 });
}

const products = await mapPool(planned, 3, async (job) => {
  const outputFile = path.join(outputRoot, job.family.slug, job.filename);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await (await fitProduct(job.source)).toFile(outputFile);

  return {
    id: job.id,
    nombre: job.nombre,
    categoria: job.family.slug,
    imagen: `/images/imagenes/${job.family.slug}/${job.filename}`,
  };
});

const order = new Map(families.map((family, index) => [family.slug, index]));
products.sort((a, b) => {
  const category = order.get(a.categoria) - order.get(b.categoria);
  return category || a.nombre.localeCompare(b.nombre, 'es');
});

await fs.writeFile(path.resolve('src/data/productos.json'), `${JSON.stringify(products, null, 2)}\n`);

const bytes = (
  await Promise.all(products.map(async (product) => {
    const file = path.resolve('public', product.imagen.slice(1));
    return (await fs.stat(file)).size;
  }))
).reduce((total, size) => total + size, 0);

const counts = families.map((family) => {
  const count = products.filter((product) => product.categoria === family.slug).length;
  return `${family.slug}: ${count}`;
});
console.log(counts.join('\n'));
console.log(`Productos: ${products.length}. WebP: ${(bytes / 1024 / 1024).toFixed(1)} MB.`);
