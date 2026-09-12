# Canonical paginated registry — v0.46.0

All primary lists that use `RegistryPagination` inherit one layout contract from `src/styles/registry.css`.

- full width of the content column
- full remaining page height
- filters at top
- exactly one internal scrolling results viewport
- pagination pinned to the bottom
- no feature-specific width/max-height/margins for primary registries

The obsolete Production Surveillance registry geometry block was removed from `modules.css`, and the previous appended canonical-registry block was removed from `core.css`. `registry.css` is loaded last and is now the single registry geometry source of truth.
