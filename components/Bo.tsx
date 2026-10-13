import Link from "next/link";

export default function Bo({ title, subtitle, home, children }: { title: string; subtitle?: string; home: string; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="container">
        <Link href={home} className="brand">
          <img src="/wapen.png" alt="" />
          <span>
            <span className="t1">{title}</span>
            {subtitle ? <span className="t2">{subtitle}</span> : null}
          </span>
        </Link>
        <nav className="topnav">{children}</nav>
      </div>
    </header>
  );
}
