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

## Rutas

- `/`: inicio y catálogo.
- `/nosotros`: historia y valores.
- `/contacto`: información y formulario de correo.
- `/recetario`: recetas.
- `/distribuidores`: información comercial.

## Datos pendientes de validar

Antes de publicar deben confirmarse el dominio definitivo, las direcciones de correo
`info@dulcesar.com.py` y `ventas@dulcesar.com`, y cualquier canal oficial de WhatsApp o redes sociales.
No se trasladaron los números ni enlaces sociales de prueba del proyecto anterior.
