import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandProps = {
  className?: string;
  preload?: boolean;
};

type BrandMarkProps = BrandProps & {
  decorative?: boolean;
};

export function BrandMark({
  className,
  decorative = true,
  preload = false,
}: BrandMarkProps) {
  return (
    <span
      className={cn(
        "brand-mark-frame relative grid shrink-0 place-items-center overflow-hidden rounded-[28%]",
        className,
      )}
      {...(!decorative && { role: "img", "aria-label": "InTouch" })}
      data-testid="brand-mark"
    >
      <Image
        src="/brand/intouch-mark.png"
        alt=""
        fill
        preload={preload}
        sizes="96px"
        className="object-contain p-[5%]"
      />
    </span>
  );
}

export function BrandSignature({ className, preload = false }: BrandProps) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2.5", className)}
      aria-label="InTouch"
      data-testid="brand-signature"
    >
      <BrandMark className="size-10" preload={preload} />
      <span className="brand-wordmark text-lg font-semibold tracking-[-0.04em]">
        <span className="brand-wordmark-warm">In</span>
        <span className="brand-wordmark-cool">Touch</span>
      </span>
    </span>
  );
}

export function BrandLockup({ className, preload = false }: BrandProps) {
  return (
    <span
      className={cn("brand-lockup relative block", className)}
      role="img"
      aria-label="InTouch. Connect. Communicate. Together."
      data-testid="brand-lockup"
    >
      <Image
        src="/brand/intouch-lockup-dark.webp"
        alt=""
        fill
        preload={preload}
        sizes="(min-width: 1024px) 440px, 300px"
        className="brand-lockup-dark object-contain"
      />
      <Image
        src="/brand/intouch-lockup-light.webp"
        alt=""
        fill
        preload={preload}
        sizes="(min-width: 1024px) 440px, 300px"
        className="brand-lockup-light object-contain"
      />
    </span>
  );
}
