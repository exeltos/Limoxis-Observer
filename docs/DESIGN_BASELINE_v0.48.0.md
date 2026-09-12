# Design baseline — v0.48.0

The mature Limoxis visual language is the reference baseline.

1. Fixed application shell; content/list regions scroll, not the entire operational page where avoidable.
2. Search remains visible; secondary filters live inside one compact **Filters** button/popover.
3. Dense, readable registries with clickable rows and preserved return context.
4. Full record/workflow screens may be rich, but should not fragment into repeated modal hopping.
5. Shared components/tokens override per-module one-off styling.
6. Greek UI uses Greek operational terminology. International abbreviations (WHO, EUCAST, AST, MDR/XDR) may remain where clinically standard, with Greek context around them.
7. LIRA remains a floating/expandable assistant, not a replacement for the application workspace.
8. Prevention is a coherent hub; specialized Vaccination and Stewardship records remain single-source modules and are linked rather than duplicated.
9. Avoid oversized empty cards, excessive KPI blocks, nested scrollbars and decorative buttons without actions.
10. Supabase-backed success is shown only after the actual write succeeds.
