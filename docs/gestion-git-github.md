# Gestión de Git y GitHub

Este documento registra cómo se aplicó el flujo de trabajo Git/GitHub durante la estructuración inicial y la incorporación de los artefactos documentales del Sistema de Gestión de Proyectos Serfamilia.

## Estrategia de ramas

El trabajo se separó por unidad documental mediante la convención `feature/<nombre-feature>`:

- `feature/estructura-repositorio`: estructura de carpetas, `.gitignore` y README principal.
- `feature/documentacion-entrevista`: minuta de entrevista utilizada como fuente de elicitación.
- `feature/documentacion-requisitos`: SRS y documentación sobre la ubicación de la trazabilidad.
- `feature/documentacion-arquitectura`: Documento 3, modelos C4 y estructura para ADR.

Cada rama se publicó en GitHub, se integró mediante Pull Request y se eliminó únicamente después de confirmar su merge. La evidencia de las ramas permanece en el historial de commits y en los Pull Requests cerrados.

## Commits semánticos

Los cambios utilizan Conventional Commits. Los commits realizados durante esta organización fueron:

- `40cda7e chore(repo): crear estructura base del repositorio`
- `a9d64d8 docs(readme): documentar organizacion del proyecto`
- `2d63b9a docs(entrevista): incorporar minuta de elicitacion de requisitos`
- `3115139 docs(srs): incorporar especificacion de requisitos`
- `3f6082e docs(trazabilidad): documentar ubicacion de la matriz de trazabilidad`
- `5778703 docs(arquitectura): incorporar documento de arquitectura C4`
- `b3ad878 docs(c4): documentar disponibilidad de fuentes editables`
- `2928d01 docs(adr): preparar estructura para decisiones arquitectonicas`

Los tipos documentados para futuros cambios son `feat:`, `fix:`, `docs:`, `refactor:`, `test:` y `chore:`.

## Pull Requests integrados

Los cambios ingresaron a `main` mediante merge commits, sin squash ni rebase destructivo:

- [PR #1 — Establecer estructura base del repositorio](https://github.com/OddALaCream/Ferrum/pull/1), merge commit `ec8e70e`.
- [PR #2 — Incorporar entrevista de elicitación](https://github.com/OddALaCream/Ferrum/pull/2), merge commit `3ec7d2e`.
- [PR #3 — Incorporar especificación de requisitos](https://github.com/OddALaCream/Ferrum/pull/3), merge commit `9431e8c`.
- [PR #4 — Incorporar arquitectura y modelos C4](https://github.com/OddALaCream/Ferrum/pull/4), merge commit `eec437f`.

## Flujo aplicado

Para cada unidad documental se aplicó el siguiente flujo:

1. Actualizar `main` desde `origin/main`.
2. Crear una rama `feature/<nombre-feature>` con una sola responsabilidad.
3. Realizar uno o más commits semánticos con cambios reales y coherentes.
4. Publicar la rama en GitHub.
5. Crear un Pull Request hacia `main`.
6. Verificar que GitHub permita la integración.
7. Integrar mediante merge commit.
8. Eliminar la rama solo después del merge.
9. Volver a `main` y actualizarlo antes de continuar.

## Estructura documental resultante

```text
.
├── README.md
├── .gitignore
├── docs/
│   ├── gestion-git-github.md
│   ├── entrevistas/
│   ├── srs/
│   ├── trazabilidad/
│   └── arquitectura/
│       └── adr/
└── modelos/
    └── c4/
```

Los directorios preexistentes `models/`, `src/` y `tests/` se conservaron sin añadir código de aplicación. Los documentos PDF y DOCX se versionaron sin modificar su contenido interno.
