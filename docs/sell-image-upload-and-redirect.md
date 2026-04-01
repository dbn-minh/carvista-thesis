# Sell Flow Image Upload and Redirect

## What changed

The Sell flow now publishes listing photos through Cloudinary-backed storage and redirects the seller straight to the newly created listing detail page after a successful publish.

The end-to-end flow is now:

1. the seller selects original image files in the Sell UI
2. the browser optimizes them locally for preview and upload
3. the frontend submits the listing as `multipart/form-data`
4. the backend uploads the files to Cloudinary
5. the database stores only lightweight image metadata and delivery URLs
6. the create-listing API returns `detail_path`
7. the frontend redirects to the new listing detail page

## Why the old flow felt too limited

Two limits were working against normal marketplace behavior:

1. the frontend rejected original files above `5 MB` before optimization
2. the backend also limited processed uploads to `5 MB` each and `24 MB` total

That meant modern phone photos could be blocked too early, even though they would have become much smaller after local optimization.

## Current recommended limits

### Frontend input limits

- file types: `JPG`, `PNG`, `WEBP`
- max image count: `10`
- max original file size: `20 MB` per image
- local optimization target: `WEBP`, max dimension `1920px`

### Backend upload limits

- max image count: `10`
- max processed upload size: `8 MB` per image
- max processed upload batch: `60 MB`

This split is intentional:

- sellers can choose realistic phone photos
- the browser optimizes them before transport
- the backend still protects the API with a practical upload ceiling

## Cloudinary setup for local development

1. Create a free account at [Cloudinary](https://cloudinary.com/).
2. Open the Cloudinary dashboard.
3. Copy:
   - `Cloud name`
   - `API Key`
   - `API Secret`
4. Add these variables to the backend environment:

```env
IMAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=carvista
```

5. Restart the backend.

For the fuller provider guide, see [image-upload-cloudinary-setup.md](/C:/disk/Working/carvista/backend/docs/image-upload-cloudinary-setup.md).

## How the redirect works

After a successful `POST /api/listings`, the backend returns:

```json
{
  "listing_id": 123,
  "variant_id": 45,
  "custom_vehicle_created": false,
  "image_count": 6,
  "detail_path": "/listings/123",
  "detail_url": "https://your-frontend.example/listings/123"
}
```

The Sell page uses `detail_path` and performs a client-side redirect to the new listing detail route.

## Local testing checklist

1. Start the backend with valid Cloudinary credentials.
2. Start the frontend.
3. Sign in and open `/sell`.
4. Select multiple real phone photos.
5. Confirm:
   - previews appear
   - no early “one image is already too large” failure for normal photos
   - publish completes
   - the app redirects automatically to `/listings/{id}`
6. Open the created listing and confirm gallery images load from Cloudinary URLs.

## Troubleshooting

### “This image is too large” before publish

The original file is above the frontend raw input limit (`20 MB`) or the optimized result is still too large for upload (`8 MB`).

Try:

- exporting a slightly smaller image
- removing extremely large panorama shots
- using JPG/WEBP instead of huge PNG photos

### “Image upload failed while talking to Cloudinary”

Check:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- network access from the backend runtime

### Listing creation failed after images started uploading

The backend now attempts to:

- clean up already-uploaded Cloudinary assets for that failed request
- destroy the just-created listing row so the seller does not get stuck with a half-created post

If you still see inconsistencies, inspect backend logs for the cleanup warning.
