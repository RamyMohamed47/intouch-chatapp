const SQUARE_IMAGE_SIZE = 512;
const SQUARE_IMAGE_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const prepareSquareImage = async (
  file: File,
  outputName: string,
): Promise<File> => {
  if (!SQUARE_IMAGE_SOURCE_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SQUARE_IMAGE_SIZE;
    canvas.height = SQUARE_IMAGE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable");
    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - sourceSize) / 2;
    const sourceY = (bitmap.height - sourceSize) / 2;
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      SQUARE_IMAGE_SIZE,
      SQUARE_IMAGE_SIZE,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("Image processing failed")),
        "image/webp",
        0.88,
      ),
    );
    return new File([blob], outputName, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
};
