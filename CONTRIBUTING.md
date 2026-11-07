# Guía de cambios

1. Trabaja en una rama con un objetivo concreto.
2. Usa datos ficticios y conserva los límites de acceso entre módulos.
3. Añade pruebas cuando cambies validaciones, permisos, estados o integración con proveedores.
4. Actualiza la documentación si cambia configuración o comportamiento.

No inicies campañas, envíos ni migraciones contra producción para probar un pull request.

## Verificar antes de publicar

```bash
npm test
npm run check:secrets
npm run audit
npm run build
git diff --check
```

El detector usa archivos que Git ya conoce. Revisa también los nuevos antes de añadirlos y repite el control tras prepararlos para commit.

## Describir el pull request

Explica problema, comportamiento resultante, pruebas y requisitos de configuración o migración. Distingue comprobaciones locales de las que necesitan proveedores.

No incluyas capturas con datos de clientes, tokens, sesiones, grabaciones ni transcripciones. Consulta [SECURITY.md](SECURITY.md).
