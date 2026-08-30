const AVATAR_SIZE = 512;
const AVATAR_SOURCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const prepareAvatarImage = async (file: File): Promise<File> => {
  if (!AVATAR_SOURCE_TYPES.has(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Avatar processing is unavailable");
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
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Avatar processing failed")),
        "image/webp",
        0.88,
      ),
    );
    return new File([blob], "avatar.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
};
