"use client";

/**
 * Event photo gallery picker for the admin form.
 *
 * Thin wrapper over the shared dropzone so the admin and the member
 * submission form behave identically — drag-and-drop, previews,
 * reordering — while keeping the `{ url, alt? }[]` shape this form
 * persists.
 */

import { PhotoDropzone, type DropzonePhoto } from "@/components/ui/photo-dropzone";

export type GalleryPhoto = DropzonePhoto;

export function GalleryUpload({
  value,
  onChange,
  category,
  label,
  hint,
  max = 12,
}: {
  value: GalleryPhoto[];
  onChange: (next: GalleryPhoto[]) => void;
  category: string;
  label: string;
  hint?: string;
  max?: number;
}) {
  return (
    <PhotoDropzone
      value={value}
      onChange={onChange}
      endpoint="/api/admin/upload"
      category={category}
      label={label}
      hint={hint}
      max={max}
    />
  );
}
