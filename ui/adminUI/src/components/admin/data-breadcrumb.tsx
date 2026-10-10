"use client";

import { useEffect, useState, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { dataBreadcrumbs } from "@/src/lib/data-navigation";

export function DataBreadcrumb({ resource }: { resource: string }) {
  const [search, setSearch] = useState("");
  useEffect(() => {
    const sync = () => setSearch(window.location.search);
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [resource]);
  const crumbs = dataBreadcrumbs(resource, search);
  return <nav className="crumb" aria-label="Breadcrumb">{crumbs.map((crumb, index) => <Fragment key={`${index}:${crumb.href}`}>
    {index > 0 && <ChevronRight />}
    <a href={crumb.href} className={index === crumbs.length - 1 ? "current" : undefined} aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</a>
  </Fragment>)}</nav>;
}
