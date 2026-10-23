import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sourceRoot = path.resolve('../web-ecommerce-dulcesar/public/images');
const outputRoot = path.resolve('public/images');
const productsRoot = path.join(sourceRoot, 'imagenes');
const productCategories = new Set(['aderezos', 'granos', 'jugos', 'mermeladas']);

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const resolved = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(resolved) : resolved;
    }),
  );
  return files.flat();
}

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const sourceFiles = (await walk(sourceRoot)).filter((file) =>
  /\.(jpe?g|png)$/i.test(file),
);

const usedPaths = new Set();
const products = [];

for (const sourceFile of sourceFiles) {
  const relative = path.relative(sourceRoot, sourceFile);
  const parsed = path.parse(relative);
  const directoryParts = parsed.dir.split(path.sep).filter(Boolean).map(slugify);
  const baseSlug = slugify(parsed.name);
  let outputRelative = path.join(...directoryParts, `${baseSlug}.webp`);

  let suffix = 2;
  while (usedPaths.has(outputRelative.toLowerCase())) {
    outputRelative = path.join(...directoryParts, `${baseSlug}-${suffix}.webp`);
    suffix += 1;
  }
  usedPaths.add(outputRelative.toLowerCase());

  const outputFile = path.join(outputRoot, outputRelative);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await sharp(sourceFile)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(outputFile);

  const productRelative = path.relative(productsRoot, sourceFile);
  const [category] = productRelative.split(path.sep);
  if (
    !productRelative.startsWith('..') &&
    productCategories.has(category.toLowerCase())
  ) {
    const normalizedName = parsed.name.replace(/\s+/g, ' ').trim();
    const categorySlug = category.toLowerCase();
    const upperName = normalizedName.toUpperCase();
    const line =
      categorySlug === 'mermeladas' && upperName.includes('ZERO')
        ? 'zero'
        : categorySlug === 'mermeladas' && upperName.includes('LIGHT')
          ? 'light'
          : categorySlug === 'mermeladas'
            ? 'tradicional'
            : undefined;

    products.push({
      id: slugify(`${categorySlug}-${normalizedName}`),
      nombre: titleCase(normalizedName),
      categoria: categorySlug,
      linea: line,
      imagen: `/images/${outputRelative.split(path.sep).join('/')}`,
    });
  }
}

products.sort((a, b) =>
  `${a.categoria}-${a.nombre}`.localeCompare(`${b.categoria}-${b.nombre}`, 'es'),
);

await fs.mkdir(path.resolve('src/data'), { recursive: true });
await fs.writeFile(
  path.resolve('src/data/productos.json'),
  `${JSON.stringify(products, null, 2)}\n`,
  'utf8',
);

const originalBytes = (
  await Promise.all(sourceFiles.map(async (file) => (await fs.stat(file)).size))
).reduce((total, size) => total + size, 0);
const optimizedFiles = await walk(outputRoot);
const optimizedBytes = (
  await Promise.all(optimizedFiles.map(async (file) => (await fs.stat(file)).size))
).reduce((total, size) => total + size, 0);

console.log(
  `Imágenes: ${sourceFiles.length}. Productos: ${products.length}. ` +
    `Peso: ${(originalBytes / 1024 / 1024).toFixed(1)} MB → ` +
    `${(optimizedBytes / 1024 / 1024).toFixed(1)} MB.`,
);
