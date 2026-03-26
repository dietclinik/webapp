
"use client"

import * as Icons from "lucide-react"

type FeatureIconProps = {
  name: string
  className?: string
}

export function FeatureIcon({ name, ...props }: FeatureIconProps) {
  // @ts-ignore
  const LucideIcon = Icons[name];

  if (!LucideIcon) {
    // Return a default icon or null if the name is invalid
    return <Icons.HelpCircle {...props} />;
  }

  return <LucideIcon {...props} />;
}

    