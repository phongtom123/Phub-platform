import { contactPage1Data } from "./contactPage1Data";
import styles from "./ContactPage1.module.css";

const svgProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function PinIcon() {
  return (
    <svg {...svgProps}>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...svgProps}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c1 .4 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6h5" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 9 5 4 5-4v7H7V9Z" />
    </svg>
  );
}

export function ContactInfoCard() {
  const { address, phone, openingHours, email } = contactPage1Data.infoCard;

  return (
    <aside className={styles.infoCard} aria-label="Thông tin liên hệ cửa hàng">
      <div className={styles.infoItem}>
        <div className={styles.iconWrapper}>
          <PinIcon />
        </div>
        <div className={styles.infoContent}>
          <h2 className={styles.infoTitle}>{address.title}</h2>
          <p className={styles.infoText}>{address.text}</p>
        </div>
      </div>

      <div className={styles.infoItem}>
        <div className={styles.iconWrapper}>
          <PhoneIcon />
        </div>
        <div className={styles.infoContent}>
          <h2 className={styles.infoTitle}>{phone.title}</h2>
          <p className={styles.infoText}>
            <a href={`tel:${phone.tel}`} className={styles.infoLink}>
              {phone.text}
            </a>
          </p>
        </div>
      </div>

      <div className={styles.infoItem}>
        <div className={styles.iconWrapper}>
          <ClockIcon />
        </div>
        <div className={styles.infoContent}>
          <h2 className={styles.infoTitle}>{openingHours.title}</h2>
          <p className={styles.infoText}>
            {openingHours.schedules.map((schedule, index) => (
              <span key={index}>
                {schedule}
                {index < openingHours.schedules.length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className={styles.infoItem}>
        <div className={styles.iconWrapper}>
          <MailIcon />
        </div>
        <div className={styles.infoContent}>
          <h2 className={styles.infoTitle}>{email.title}</h2>
          <p className={styles.infoText}>
            <a href={`mailto:${email.mailto}`} className={styles.emailLink}>
              {email.text}
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}
