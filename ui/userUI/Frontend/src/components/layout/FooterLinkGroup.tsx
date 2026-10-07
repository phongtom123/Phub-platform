"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Accordion } from "@/components/common/Accordion";
import styles from "./Footer.module.css";

export function FooterLinkGroup({ title, children, initiallyOpen = false, id }: { title: string; children: ReactNode; initiallyOpen?: boolean; id?: string }) {
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => {
      const details = wrapper.current?.querySelector("details");
      if (details) details.open = !query.matches || initiallyOpen;
    };
    update();
    const revealAnchor = () => {
      if (id && window.location.hash === `#${id}`) {
        const details = wrapper.current?.querySelector("details");
        if (details) details.open = true;
      }
    };
    revealAnchor();
    query.addEventListener("change", update);
    window.addEventListener("hashchange", revealAnchor);
    return () => { query.removeEventListener("change", update); window.removeEventListener("hashchange", revealAnchor); };
  }, [initiallyOpen, id]);
  return <div ref={wrapper} id={id} className={styles.col}>
    <Accordion title={title} open={initiallyOpen} className={styles.linkGroup}>{children}</Accordion>
  </div>;
}
