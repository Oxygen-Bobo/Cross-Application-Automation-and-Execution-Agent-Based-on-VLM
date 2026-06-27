import { useState } from "react";
import { Monitor } from "lucide-react";

type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
};

export function SmartImage({ src, alt, className, fallbackTitle }: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`image-fallback ${className ?? ""}`} role="img" aria-label={alt}>
        <Monitor aria-hidden="true" />
        <strong>{fallbackTitle ?? "产品界面预览"}</strong>
        <span>{src}</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
