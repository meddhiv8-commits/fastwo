const DATABASE_NAME = "fastwo-photo-library";
const STORE_NAME = "photos";
const PHOTO_PREFIX = "fastwo-photo:";
let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Impossible de lire la photo « ${file.name} ».`));
    };
    image.src = url;
  });
}

async function optimizePhoto(file) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await loadImage(file);
  }
  const largestSide = Math.max(source.width, source.height);
  const scale = Math.min(1, 1600 / largestSide);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Impossible de préparer cette photo.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === "function") source.close();

  for (const quality of [0.82, 0.72, 0.62]) {
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Impossible d’optimiser cette photo.");
    if (blob.size <= 450_000 || quality === 0.62) return blob;
  }
  throw new Error("Impossible d’optimiser cette photo.");
}

export async function saveUploadedPhoto(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choisissez un fichier image.");
  }
  const blob = await optimizePhoto(file);
  const database = await openDatabase();
  const id = crypto.randomUUID();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  return `${PHOTO_PREFIX}${id}`;
}

export async function readUploadedPhoto(reference) {
  if (!reference?.startsWith(PHOTO_PREFIX)) return null;
  const database = await openDatabase();
  const id = reference.slice(PHOTO_PREFIX.length);
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export function isUploadedPhoto(reference) {
  return typeof reference === "string" && reference.startsWith(PHOTO_PREFIX);
}
