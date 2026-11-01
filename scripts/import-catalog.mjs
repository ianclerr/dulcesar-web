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

const products = await mapPool(planned, 3, async (job) => {
  const outputFile = path.join(outputRoot, job.family.slug, job.filename);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await sharp(job.source)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, effort: 4, alphaQuality: 75 })
    .toFile(outputFile);

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
