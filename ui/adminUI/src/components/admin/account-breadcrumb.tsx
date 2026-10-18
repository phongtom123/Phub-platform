"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { accountHref, type AccountView } from "@/src/features/accounts/types";

export function AccountBreadcrumb({ mode, id }: AccountView) {
  const crumbs = [{ label: "Quản trị", href: "/" }, { label: "Tài khoản", href: "/accounts" }];
  if (id) crumbs.push({ label: id, href: accountHref(id) });
  if (mode === "create") crumbs.push({ label: "Thêm tài khoản", href: "/accounts/new" });
  if (mode === "self") crumbs.push({ label: "Tài khoản của tôi", href: "/account" });
  return <nav className="crumb" aria-label="Breadcrumb">{crumbs.map((crumb, index) => <Fragment key={crumb.href}>
    {index > 0 && <ChevronRight />}
    <Link href={crumb.href} className={index === crumbs.length - 1 ? "current" : undefined} aria-current={index === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</Link>
  </Fragment>)}</nav>;
}
