# Pruebas y verificación

## Comandos desde la raíz

| Comando | Qué comprueba |
| --- | --- |
| `npm test` | Pruebas de backend con el runner de Node |
| `npm run check:secrets` | Patrones de secretos y rutas prohibidas en archivos versionados actuales |
| `npm run audit` | Avisos de dependencias de producción, nivel alto o superior; requiere red |
| `npm run build` | Compilación del frontend y comprobaciones Next.js/TypeScript |

Instala antes las dependencias con `npm ci --prefix backend` y `npm ci --prefix frontend`.

## Cobertura actual

- **Callbacks de campaña:** rechazo si falta el secreto del servidor o la cabecera, o si es incorrecta; ambas rutas y cabeceras admitidas. Las peticiones autorizadas alcanzan la validación del cuerpo sin consultar Supabase.
- **Acceso a tickets:** credenciales, cookies de entrada/salida y rechazo de sesiones de otro módulo.
- **Revisión documental:** fechas imposibles, importes inseguros, pagos ambiguos y archivos sin la firma esperada de imagen.
- **Entrega:** identidad del archivo, destino por técnico, neutralización de fórmulas de Excel, checkpoints, reanudación y rechazo de documentos no aprobados.

Los tests HTTP escuchan en `127.0.0.1` con puerto efímero. Usan configuración ficticia y no cargan `.env`. Las exportaciones se simulan: no escriben en Microsoft 365.

## GitHub Actions

En pushes y pull requests, CI instala dependencias y ejecuta detector de secretos, pruebas de backend, auditoría de dependencias y compilación de frontend. Usa permisos de lectura y no necesita secretos de producción.

## Límites

Un resultado verde no demuestra disponibilidad de proveedores reales, cobertura completa de todos los módulos, pruebas de navegador/carga/accesibilidad ni instalación del esquema completo. El detector tampoco garantiza ausencia de secretos en commits antiguos o datos que no coincidan con sus patrones.

Las pruebas con proveedores deben hacerse por separado con cuentas, destinatarios y datos de prueba. No añadas llamadas ni envíos de producción a CI.
