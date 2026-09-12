# v0.47.3 Login + HMR cleanup

- Added Vite polling for reliable Windows file-copy HMR.
- One restart is required once because vite.config.js changed.
- Future JSX/JS/CSS file replacements in the same running project should refresh automatically.
- Rebuilt login surface with auth.css as the final authoritative auth layer.
- Removed auth overrides from modern.css.
