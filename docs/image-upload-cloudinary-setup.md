# Cloudinary Image Upload Setup

## 1. What this feature does

CarVista now supports cloud-backed listing image uploads.

Instead of storing uploaded image content inside the MySQL database, the backend now:

1. accepts listing images as `multipart/form-data`
2. uploads the file to Cloudinary
3. stores only lightweight metadata in `listing_images`
4. returns normalized image objects for frontend rendering

This is a better fit for production because the database no longer has to carry large base64 payloads.

## 2. Why Cloudinary

Cloudinary is used here because it is:

- easy to set up
- friendly for student and thesis projects
- built specifically for image delivery
- good enough for free-tier marketplace demos

## 3. Current-state assessment

Before this refactor, the repository already accepted real file uploads through `multer`, but the backend storage layer still serialized image buffers into JSON/base64 and saved that inside `listing_images.url`.

The new design keeps backward compatibility for old rows, but all new uploads should go to Cloudinary.

## 4. Required environment variables

Add these variables to your backend environment:

```env
IMAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=carvista
```

If you want to keep the old DB-inline behavior temporarily for local fallback only, you can set:

```env
IMAGE_PROVIDER=db_legacy
```

That fallback exists for migration safety, not as the recommended production mode.

## 5. How to create a free Cloudinary account

1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Create a free account
3. Open the Cloudinary dashboard
4. Copy these values from the dashboard:
   - Cloud name
   - API key
   - API secret

## 6. Where to put the credentials

### Local development

Add the values to your local backend env file or shell session using the same keys shown above.

### Render / production

Add the same variables in your Render Web Service environment settings.

Do not expose these values in the frontend or commit them to git.

## 7. Install dependencies

The backend now depends on the official Cloudinary SDK.

If you need to install it manually:

```bash
yarn add cloudinary
```

or

```bash
npm install cloudinary
```

## 8. Database migration / schema notes

No destructive migration is required to start using Cloudinary.

The backend will safely add these metadata columns to `listing_images` when needed:

- `provider`
- `public_id`
- `asset_id`
- `width`
- `height`
- `format`
- `bytes`

The `url` column remains the canonical delivery URL, so read-side compatibility is preserved.

## 9. Legacy data migration strategy

Old records may still contain:

- inline JSON with base64
- `data:image/...` payloads
- plain remote URLs

The current backend still reads those old rows correctly.

Recommended migration strategy:

1. switch new uploads to Cloudinary immediately
2. keep old rows readable
3. migrate old base64 rows gradually later

A safe future migration process would be:

1. query `listing_images` rows whose `url` starts with `{` or `data:image/`
2. decode/upload each image to Cloudinary
3. update the row with:
   - `url = secure_url`
   - `provider = cloudinary`
   - `public_id = ...`
   - `asset_id = ...`
   - `width/height/format/bytes`
4. leave already-cloud-backed rows untouched

## 10. API endpoints

### Create listing with images

`POST /api/listings`

Use `multipart/form-data` with fields like:

- `variant_id`
- `asking_price`
- `mileage_km`
- `location_city`
- `location_country_code`
- `description`
- `images` (repeat this field for each uploaded file)

### Upload images to an existing listing

`POST /api/listings/:id/images`

Owner only.

### List normalized listing images

`GET /api/listings/:id/images`

### Delete one listing image

`DELETE /api/listings/:id/images/:imageId`

Owner only.

### Reorder listing images

`PATCH /api/listings/:id/images/reorder`

Body:

```json
{
  "image_ids": [12, 15, 18]
}
```

Owner only.

## 11. How to test locally with Postman

### Create a listing with files

1. Login and copy your bearer token
2. In Postman, create:
   - method: `POST`
   - URL: `http://localhost:4000/api/listings`
3. Add header:
   - `Authorization: Bearer <token>`
4. Choose `Body -> form-data`
5. Add text fields:
   - `variant_id`
   - `asking_price`
   - `mileage_km`
   - `location_city`
   - `location_country_code`
6. Add one or more file fields named `images`
7. Send request

Expected success shape:

```json
{
  "listing_id": 123,
  "variant_id": 45,
  "custom_vehicle_created": false,
  "image_count": 3
}
```

### Upload more images to an existing listing

1. Create:
   - method: `POST`
   - URL: `http://localhost:4000/api/listings/123/images`
2. Add header:
   - `Authorization: Bearer <token>`
3. Use `Body -> form-data`
4. Add one or more file fields named `images`
5. Send request

Expected success shape:

```json
{
  "listing_id": 123,
  "image_count": 2,
  "items": [
    {
      "listing_id": 123,
      "listing_image_id": 999,
      "url": "https://res.cloudinary.com/...",
      "provider": "cloudinary",
      "publicId": "carvista/listings/123/...",
      "width": 1600,
      "height": 900,
      "format": "webp",
      "bytes": 143221
    }
  ]
}
```

## 12. How to test with Swagger

The upload endpoints are now described in the OpenAPI file.

Open:

- `http://localhost:4000/api-docs`

Then test:

- `POST /listings`
- `POST /listings/{id}/images`
- `GET /listings/{id}/images`
- `PATCH /listings/{id}/images/reorder`
- `DELETE /listings/{id}/images/{imageId}`

For protected routes, click `Authorize` and paste your bearer token.

## 13. Common failure cases

### "Image uploads are not configured yet"

Cause:

- Cloudinary env vars are missing
- `IMAGE_PROVIDER` is set to `cloudinary` but credentials are empty

Fix:

- add `CLOUDINARY_CLOUD_NAME`
- add `CLOUDINARY_API_KEY`
- add `CLOUDINARY_API_SECRET`

### "Only JPG, PNG, and WEBP files are supported"

Cause:

- uploaded file type is not allowed

Fix:

- use JPEG, PNG, or WEBP only

### "This image is too large"

Cause:

- one file exceeds the configured per-file limit

Fix:

- upload a smaller image

### "Your photo batch is too large overall"

Cause:

- the total request size is too large

Fix:

- upload fewer images in one batch

### "You can only manage images for your own listings"

Cause:

- the authenticated user does not own that listing

Fix:

- login as the listing owner

## 14. Future improvements

- add an admin/one-off migration script for legacy base64 rows
- add image transformation presets for thumbnails
- add frontend UI for deleting and reordering listing images after publish
- optionally add Cloudinary signed upload or eager transformations later
