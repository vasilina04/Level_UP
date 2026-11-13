import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
const variants=cva("button",{variants:{variant:{primary:"primary",secondary:"secondary",ghost:"ghost"}},defaultVariants:{variant:"primary"}});
export function Button({asChild,className,variant,...props}:ComponentProps<"button">&VariantProps<typeof variants>&{asChild?:boolean}) {
  const Component=asChild?Slot:"button";
  return <Component className={cn(variants({variant}),className)} {...props}/>;
}
