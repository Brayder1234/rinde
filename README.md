# Rinde Web · Control de gastos

Versión web instalable (PWA) de Rinde. Se abre en Safari y se instala con **Compartir → Agregar a pantalla de inicio**: queda con ícono, a pantalla completa y funciona sin internet.

- Escribe o dicta como en un chat: “almuerzo 18 mil ayer #trabajo”, “20 lucas”, “2 palos”, varios gastos en una frase.
- Disponible para gastar hoy / semana / mes, presupuestos con alertas, metas de ahorro, pagos recurrentes (con detección automática), análisis y etiquetas.
- Lectura de recibos con foto (Tesseract, en el teléfono), varias monedas con tasa del día.
- Datos 100 % en el teléfono (localStorage). Exportar CSV, copia de seguridad y restauración.
- Sin dependencias ni compilación: HTML, CSS y JavaScript (módulos ES).

Pruebas del analizador de texto:

```bash
node tests/parser.test.mjs
```

Para publicar cambios, sube la versión de `CACHE` en `sw.js`.
