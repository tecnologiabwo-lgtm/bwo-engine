import { Fragment } from "react";
import { linkify, safeHref, displayUrl } from "@/shared/lib/linkify";
import { cn } from "@/shared/lib/utils";

const linkCls = "font-semibold text-bwo-turquoiseLt underline-offset-2 hover:underline break-words";

/** Texto con enlaces clicables (URLs, correos, @usuarios y #hashtags). */
export function LinkedText({ text, className, as: Tag = "span" }) {
  return (
    <Tag className={cn("whitespace-pre-line", className)}>
      {linkify(text).map((p, i) => p.type === "link"
        ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className={linkCls} onClick={(e) => e.stopPropagation()}>{p.text}</a>
        : <Fragment key={i}>{p.text}</Fragment>)}
    </Tag>
  );
}

/** Un enlace suelto (p. ej. el de la biografía). Si no es válido, se muestra como texto. */
export function ExternalLink({ url, className, children }) {
  const href = safeHref(url);
  if (!href) return <span className={className}>{url}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cn(linkCls, className)}>{children || displayUrl(href)}</a>;
}
