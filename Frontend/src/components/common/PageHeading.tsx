import { Breadcrumb, type BreadcrumbProps } from "./Breadcrumb";
import styles from "./PageHeading.module.css";

interface PageHeadingProps {
  title: string;
  breadcrumbs: BreadcrumbProps["items"];
}

export function PageHeading({ title, breadcrumbs }: PageHeadingProps) {
  return <div className={styles.heading}>
    <Breadcrumb items={breadcrumbs} />
    <h1>{title}</h1>
  </div>;
}
