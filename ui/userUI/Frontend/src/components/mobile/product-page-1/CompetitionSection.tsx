import Image from "next/image";
import { competitionContent } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function CompetitionSection() {
  return <section className={styles.competition} aria-labelledby="competition-heading">
    <Image className={styles.chipImage} src={competitionContent.image} alt="Bộ xử lý Intel Core i7 thế hệ 10" width={375} height={356} sizes="(max-width: 760px) 100vw, 375px" />
    <div className={styles.competitionCopy}>
      <h2 id="competition-heading">{competitionContent.title}</h2>
      <p>{competitionContent.description}</p>
      <p>{competitionContent.note}</p>
    </div>
  </section>;
}
