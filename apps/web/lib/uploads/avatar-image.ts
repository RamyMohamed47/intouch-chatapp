import { prepareSquareImage } from "@/lib/uploads/square-image";

export const prepareAvatarImage = (file: File) =>
  prepareSquareImage(file, "avatar.webp");
