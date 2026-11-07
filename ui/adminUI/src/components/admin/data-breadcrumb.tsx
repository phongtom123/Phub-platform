"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useAdminAuth } from "./auth-provider";
import { dataBreadcrumbs } from "@internal/lib/data-navigation";

export function DataBreadcrumb({ resource }: { resource: string }) {
  const search = useSearchParams();
  const { portal } = useAdminAuth();
  const crumbs = dataBreadcrumbs(resource, search.toString());
  return <nav className="crumb" aria-label="Breadcrumb">{crumbs.map((crumb, index) => <Fragment key={`${index}:${crumb.href}`}>
    {index > 0 && <ChevronRight />}
    <Link href={crumb.href} className={index === crumbs.length - 1 ? "current" : undefined} aria-current={index === crumbs.length - 1 ? "page" : undefined}>{index === 0 && portal === "staff" ? "Nhân viên" : crumb.label}</Link>
  </Fragment>)}</nav>;
}
