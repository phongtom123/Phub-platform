"use client";

import { useId, useState, type ReactNode } from "react";
import { AccountEditor } from "./AccountEditor";
import { accountNavigation, demoAccount, emptyAccountViews, type AccountView, type DemoAccount, type EditorKind } from "./accountData";
import styles from "./profile.module.css";

function SummaryBox({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.summaryBox}><h2>{title}</h2><p>{children}</p></section>;
}

function AccountSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className={styles.section}>
    <div className={styles.sectionHeading}><h2>{title}</h2>{action}</div>
    {children}
  </section>;
}

export function AccountDashboard() {
  const id = useId();
  const [view, setView] = useState<AccountView>("dashboard");
  const [account, setAccount] = useState<DemoAccount>({ ...demoAccount });
  const [editor, setEditor] = useState<EditorKind | null>(null);
  const [message, setMessage] = useState("");
  const currentItem = accountNavigation.flat().find(item => item.id === view)!;

  function selectView(next: AccountView) { setView(next); setMessage(""); }
  function save(patch: Partial<DemoAccount>) {
    setAccount(current => ({ ...current, ...patch }));
    setEditor(null);
    setMessage("Preview updated. These changes are not saved to an account and will reset on reload.");
  }
  const showAccount = view === "dashboard" || view === "account";
  const showAddresses = view === "dashboard" || view === "addresses";

  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      <nav className={styles.navigation} aria-label="My account">
        {accountNavigation.map((group, index) => <ul key={index}>
          {group.map(item => <li key={item.id}>
            <button type="button" aria-current={view === item.id ? "page" : undefined} aria-controls={id + "-content"} onClick={() => selectView(item.id)}>{item.label}</button>
          </li>)}
        </ul>)}
      </nav>
      <SummaryBox title="Compare Products">You have no items to compare.</SummaryBox>
      <SummaryBox title="My Wish List">You have no items in your wish list.</SummaryBox>
    </aside>

    <div id={id + "-content"} className={styles.content} aria-label={currentItem.label}>
      {message && <p role="status" className={styles.message}>{message}</p>}
      {showAccount && <AccountSection title="Account Information">
        <div className={styles.detailsGrid}>
          <div className={styles.detail}>
            <h3>Contact Information</h3>
            <p>{account.name}<br />{account.email}</p>
            <div className={styles.links}>
              <button type="button" onClick={() => setEditor("contact")} aria-label="Edit contact information">Edit</button>
              <button type="button" onClick={() => setMessage("Password changes require a connected account service. No password is collected in this UI preview.")}>Change Password</button>
            </div>
          </div>
          <div className={styles.detail}>
            <h3>Newsletters</h3>
            <p>{account.subscribed ? "You subscribe to our newsletter." : "You don't subscribe to our newsletter."}</p>
            <div className={styles.links}><button type="button" onClick={() => setEditor("newsletter")} aria-label="Edit newsletter subscription">Edit</button></div>
          </div>
        </div>
      </AccountSection>}

      {showAddresses && <AccountSection title="Address Book" action={<button type="button" className={styles.textAction} onClick={() => selectView("addresses")}>Manage Addresses</button>}>
        <div className={styles.detailsGrid}>
          {(["billing", "shipping"] as const).map(kind => <div key={kind} className={styles.detail}>
            <h3>Default {kind === "billing" ? "Billing" : "Shipping"} Address</h3>
            <p>{account[kind] || "You have not set a default " + kind + " address."}</p>
            <div className={styles.links}><button type="button" onClick={() => setEditor(kind)} aria-label={"Edit " + kind + " address"}>Edit Address</button></div>
          </div>)}
        </div>
      </AccountSection>}

      {view === "newsletter" && <AccountSection title="Newsletter Subscriptions">
        <div className={styles.detail}>
          <p>{account.subscribed ? "You subscribe to our newsletter." : "You don't subscribe to our newsletter."}</p>
          <div className={styles.links}><button type="button" onClick={() => setEditor("newsletter")}>Edit subscription</button></div>
        </div>
      </AccountSection>}

      {view in emptyAccountViews && <AccountSection title={currentItem.label}>
        <p className={styles.empty}>{emptyAccountViews[view as keyof typeof emptyAccountViews]}</p>
        <p className={styles.demoHint}>Sample view only. No account data is connected.</p>
      </AccountSection>}
    </div>
    {editor && <AccountEditor key={editor} kind={editor} account={account} onSave={save} onClose={() => setEditor(null)} />}
  </div>;
}
