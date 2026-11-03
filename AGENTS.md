# Reglas de Desarrollo — BarraOnline

## Regla Obligatoria de Git (Commit y Push Automático)

Cada vez que se complete una modificación, ajuste, optimización o creación de archivos en el proyecto:
1. **Verificación**: Asegurar que los cambios no rompan la compilación (`npm run build` o `npm run typecheck`).
2. **Stage**: Ejecutar `git add <archivos_modificados>`.
3. **Commit**: Realizar el commit con un mensaje claro y descriptivo siguiendo Conventional Commits (`feat:`, `fix:`, `perf:`, `style:`, `refactor:`).
4. **Push**: Ejecutar inmediatamente `git push origin <rama_actual>` para que el repositorio remoto en GitHub siempre refleje la última versión.
5. **Reporte**: Confirmar en la respuesta al usuario el commit generado y el estado del push.
