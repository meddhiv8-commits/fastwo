import { useEffect, useState } from "react";
import { isUploadedPhoto, readUploadedPhoto } from "../lib/photoStorage.js";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85";

export default function ProductImage({ src, alt = "", ...imageProps }) {
  const [resolvedSrc, setResolvedSrc] = useState(() =>
    isUploadedPhoto(src) ? "" : src || FALLBACK_IMAGE,
  );

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!isUploadedPhoto(src)) {
      setResolvedSrc(src || FALLBACK_IMAGE);
      return undefined;
    }
    setResolvedSrc("");
    readUploadedPhoto(src)
      .then((blob) => {
        if (!active) return;
        objectUrl = blob ? URL.createObjectURL(blob) : FALLBACK_IMAGE;
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (active) setResolvedSrc(FALLBACK_IMAGE);
      });
    return () => {
      active = false;
      if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img src={resolvedSrc || FALLBACK_IMAGE} alt={alt} {...imageProps} />;
}
