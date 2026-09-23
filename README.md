# Sistema de Gestión de Proyectos Serfamilia

Repositorio académico del Sistema de Gestión de Proyectos Serfamilia (SGP). En la etapa actual reúne la estructuración, la documentación de elicitación, los requisitos y la arquitectura del proyecto; todavía no contiene desarrollo de software.

## Contexto académico

El repositorio se organiza como parte de una entrega universitaria de Ingeniería de Software. Su propósito es mantener los artefactos documentales versionados y permitir que cada unidad de trabajo sea revisada antes de incorporarse a la rama principal.

## Estructura del repositorio

```text
.
├── README.md
├── .gitignore
├── docs/
│   ├── entrevistas/
│   ├── srs/
│   ├── trazabilidad/
│   └── arquitectura/
│       └── adr/
└── modelos/
    └── c4/
```

- `docs/entrevistas/`: fuentes de elicitación de requisitos.
- `docs/srs/`: Especificación de Requisitos de Software.
- `docs/trazabilidad/`: artefactos independientes de trazabilidad, cuando estén disponibles.
- `docs/arquitectura/`: documentación de arquitectura de software.
- `docs/arquitectura/adr/`: registros independientes de decisiones arquitectónicas, cuando estén disponibles.
- `modelos/c4/`: fuentes editables de diagramas C4, cuando estén disponibles.

Los directorios preexistentes `models/`, `src/` y `tests/` se conservan sin contenido de aplicación durante esta etapa documental.

## Convenciones de trabajo

Las ramas de trabajo siguen la forma `feature/<nombre-feature>` y parten de una versión actualizada de `main`.

Los commits siguen Conventional Commits. Los tipos admitidos son:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `chore:`

Cada rama debe mantener una sola responsabilidad y entrar a `main` mediante un Pull Request. Los Pull Requests se revisan y se integran con merge commit para conservar los commits semánticos individuales. Después de cada integración se actualiza `main` antes de iniciar la siguiente rama.
