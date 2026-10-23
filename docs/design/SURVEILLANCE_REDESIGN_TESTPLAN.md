# Surveillance redesign test plan

- Episode forms internal navigation renders only sections visible to the current role/profile.
- Clicking a navigation item opens the corresponding collapsed section and scrolls to it.
- Existing external open requests (for example scales) still open the section.
- Sections remain mounted while collapsed so dialogs/data state are preserved.
- Mobile/tablet keeps horizontal navigation scroll and single-column form rows where applicable.
- No changes to permissions, data loading, save actions or clinical calculations.
