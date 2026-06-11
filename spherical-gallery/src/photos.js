// Manifest of the bundled photographs (real images, resized & committed under
// assets/photos/). Sourced from the public-domain-style sample set at
// github.com/yavuzceliker/sample-images.
export const PHOTO_COUNT = 90;
export const PHOTOS = Array.from({ length: PHOTO_COUNT }, (_, i) =>
  `./assets/photos/photo-${String(i + 1).padStart(3, '0')}.jpg`);
