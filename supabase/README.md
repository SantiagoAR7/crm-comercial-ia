# Esquema y migraciones

**El esquema inicial del CRM no está completo en este repositorio.** Los archivos disponibles no bastan para construir una base vacía.

| Archivos | Dominio | Estado |
| --- | --- | --- |
| `001_initial_schema.sql` | CRM inicial | Referenciado históricamente, no incluido |
| `002_add_contacts_and_link_campaigns.sql` | Contactos y campañas | Referenciado históricamente, no incluido |
| `003_add_equipment_type.sql` | Equipos | Referenciado históricamente, no incluido |
| `004_*` | Baseline intermedio | No incluido; contenido pendiente de verificar |
| `005_motor_comercial.sql` | Ejecuciones, cola y resultados | Incluido; requiere tablas previas |
| `006_migrate_campaigns_to_retell.sql` | Campañas Retell | Incluido |
| `007_ai_prospecting.sql` | Prospección | Incluido |
| `008_telegram_tickets.sql` | Tickets | Incluido; destino independiente |
| `009_ticket_delivery.sql` | Entrega | Incluido |
| `010_ticket_test_isolation.sql` | Aislamiento de pruebas | Incluido |

`005` referencia `campaigns` y `campaign_contacts`, que deben existir antes. CRM y Tickets usan proyectos Supabase distintos: no apliques indiscriminadamente todos los archivos al mismo proyecto.

## Preparar otro entorno

1. Obtener un baseline autorizado de estructura, sin datos, contraseñas ni tokens.
2. Revisar dependencias, funciones, permisos y políticas de cada proyecto Supabase.
3. Probar toda la secuencia en proyectos desechables con datos ficticios.
4. Versionar el baseline verificado antes de anunciar una instalación reproducible.

No se proporciona un baseline inventado. El script de datos de demostración de la raíz presupone un esquema existente; no lo crea y puede escribir en la base configurada.
