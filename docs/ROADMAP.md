# Estado y próximos pasos

## Implementado en el código

- Portal y sesiones por módulo.
- CRM, instalaciones, revisión de candidatos y campañas mediante n8n/Retell.
- Prospección, BI, lectura de publicaciones y revisión de tickets.
- Pruebas de tickets y autenticación de callbacks.
- CI con pruebas, detector de secretos, auditoría de dependencias y build.

Esta lista describe el repositorio, no certifica la configuración de producción.

## Prioridad 1: revisión reproducible

- Recuperar y revisar el baseline inicial del CRM; completar `001-004` sin datos reales.
- Validar migraciones en una base vacía de pruebas.
- Preparar demo con datos ficticios y proveedores simulados.
- Añadir capturas anonimizadas y explicación del recorrido principal.

## Prioridad 2: confianza operativa

- Cubrir aprobación de campañas, exclusiones, deduplicación y reintentos.
- Probar callbacks repetidos, concurrencia, caídas de proveedores y escrituras parciales.
- Uniformar errores asíncronos y validar configuración al iniciar.
- Revisar secretos en el historial y configuración específica del entorno.

## Prioridad 3: mantenimiento y presentación

- Dividir prospección en servicios y componentes pequeños.
- Añadir pruebas de navegador y accesibilidad.
- Documentar resultados medidos sin publicar datos privados.
- Confirmar permisos de distribución antes de elegir licencia.
