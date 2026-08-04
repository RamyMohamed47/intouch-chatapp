import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFormString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
