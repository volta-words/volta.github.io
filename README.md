# volta.github.io
Volta Word Game (SKEWRD)

## Deploying updates (no “clear cache” needed for visitors)

1. Upload changed files to the web server.
2. **Bump `?v=` in `index.html`** (e.g. `js/main.js?v=4` → `?v=5`) and match the same version in all `js/**/*.js` import paths.
3. Configure the server so **`index.html` is never cached** — see [`deploy/nginx-cache-snippet.conf`](deploy/nginx-cache-snippet.conf).

With that setup, the next normal visit loads fresh `index.html`, which points at new versioned JS. Old cached `main.js` / `dictionary.js` URLs are ignored.

Private mode worked because it had no old cache; fixing server HTML caching fixes everyone else without asking users to clear data.

### Fasthosts (Apache `.htaccess`)

From the repo root:

```bash
bash deploy/create-htaccess.sh
```

This writes `.htaccess` next to `index.html`. Upload that file to your Fasthosts web root via File Manager or FTP.
