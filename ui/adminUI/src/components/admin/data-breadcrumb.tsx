"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { dataBreadcrumbs } from "@/src/lib/data-navigation";

export function DataBreadcrumb({ resource }: { resource: string }) {
  const search = useSearchParams();
  const crumbs = dataBreadcrumbs(resource, search.toString());
  return <nav className="crumb" aria-label="Breadcrumb">{crumbs.map((crumb, index) => <Fragment key={`${index}:${crumb.href}`}>
    {index > 0 && <ChevronRight />}
    <Link href={crumb.href} className={index === crumbs.length - 1 ? "current" : undefined} aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</Link>
  </Fragment>)}</nav>;
}
