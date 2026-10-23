# Sitio web Dul-Cesar

Landing institucional estática construida con Astro 7 y Tailwind CSS 4. Reemplaza la antigua
implementación en Laravel y no incluye el e-commerce, que quedó pausado.

## Desarrollo

```bash
npm install
npm run dev
```

El sitio estará disponible en `http://localhost:4321`.

## Comandos

- `npm run dev`: servidor local.
- `npm run build`: genera el sitio estático en `dist/`.
- `npm run preview`: previsualiza el build.
- `npm run images:migrate`: importa y optimiza las imágenes desde el proyecto Laravel.

El importador detecta automáticamente el proyecto anterior en XAMPP. Si se mueve a otra ubicación,
se puede indicar la carpeta de imágenes con la variable `DULCESAR_LEGACY_IMAGES`.

## Rutas

- `/`: inicio y catálogo.
- `/nosotros`: historia y valores.
- `/contacto`: información y formulario de correo.
- `/recetario`: recetas.
- `/distribuidores`: información comercial.

## Datos pendientes de validar

Antes de publicar deben confirmarse el dominio definitivo, la dirección `ventas@dulcesar.com` y si
el celular (0974) 699-585 es también canal de WhatsApp. Instagram (@productos_dulcesar),
`info@dulcesar.com.py` y los teléfonos ya fueron confirmados por el cliente.
