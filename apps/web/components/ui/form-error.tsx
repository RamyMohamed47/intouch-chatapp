import * as React from "react";

import { cn } from "@/lib/utils";

function FormError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn("text-xs leading-5 text-destructive", className)}
      {...props}
    />
  );
}

export { FormError };
