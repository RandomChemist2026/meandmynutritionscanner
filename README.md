# My Nutrition Scanner

Personal-use PWA for:
- scanning EAN/UPC food barcodes with the phone camera,
- fetching packaged-food nutrition from Open Food Facts,
- entering the amount eaten in grams,
- calculating calories, protein, carbs, fat, fiber, sugar, saturated fat, and salt,
- saving corrected product values locally on your phone,
- keeping a daily food log,
- exporting the day's log as CSV.

## Important

Camera access and PWA installation require the site to be served over **HTTPS** (or localhost during development).
Do not open `index.html` directly from the Files app and expect camera scanning/service workers to work.

## Free deployment option: GitHub Pages

1. Create a free GitHub account if you do not already have one.
2. Create a new repository, for example `my-nutrition-scanner`.
3. Upload everything inside this folder to the repository root:
   - index.html
   - app.css
   - app.js
   - manifest.webmanifest
   - sw.js
   - icons/
4. Open repository **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)`, then save.
7. GitHub will give you an HTTPS Pages address.
8. Open that address on your phone.

### Android
Open in Chrome → menu → **Add to Home screen / Install app**.

### iPhone
Open in Safari → Share → **Add to Home Screen**.

## Privacy

Your saved foods and meal log are stored in the browser's local storage on that device.
No account or personal backend is used.

Deleting browser/site data will delete the saved local data, so export CSV if you want a backup.

## Barcode lookup

The app uses the public Open Food Facts product API:
`https://world.openfoodfacts.org/api/v2/product/{barcode}.json`

Open Food Facts is community-maintained. Always compare database values with the actual package label if accuracy matters.

## Camera scanner

The app loads `@zxing/browser` from jsDelivr when you start the camera scanner.
This improves EAN/UPC camera support across browsers.
Manual barcode entry remains available if the camera scanner cannot start.

## Nutrition calculation

For each nutrient:

amount consumed = nutrient per 100 g × weight eaten / 100

These are calculated values based on food-label/database values, not laboratory measurements.
