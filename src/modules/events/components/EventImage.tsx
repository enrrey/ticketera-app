"use client";
import Image, { type ImageProps } from "next/image";
export function EventImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src.trim() : props.src;
  return <Image {...props} alt={props.alt} src={src} unoptimized={typeof src === "string" && /^https:\/\//i.test(src)} referrerPolicy="no-referrer" />;
}
