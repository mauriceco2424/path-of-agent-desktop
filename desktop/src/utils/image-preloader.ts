/**
 * Preloads images into the browser cache by creating Image objects.
 * When the same URLs are later used in <img> tags or CSS background-image,
 * the browser serves them from cache instantly.
 */
export function preloadImages(urls: string[]): void {
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}
