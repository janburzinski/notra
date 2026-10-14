import Image from "next/image";

const features = [
  {
    title: "Plan in minutes",
    body: "Import the day's stops and get routes for every driver that respect time windows, vehicle size and shift length.",
  },
  {
    title: "React to traffic",
    body: "Routes re-plan themselves when live traffic would make a driver miss a window, and the driver app updates on its own.",
  },
  {
    title: "Tell customers when",
    body: "Customers get a 30-minute ETA the evening before, so they're home when the driver rings.",
  },
] as const;

export default function Home() {
  return (
    <>
      <header className="header">
        <a className="brand" href="/">
          <Image src="/logo.svg" alt="" width={28} height={28} priority />
          Pathway
        </a>
        <nav aria-label="Main">
          <a href="/blog">Blog</a>
          <a href="/changelog">Changelog</a>
          <a className="button" href="https://usenotra.com">
            Book a demo
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Route planning for delivery fleets</p>
          <h1>Every stop on time, even when the day changes.</h1>
          <p className="lead">
            Pathway plans routes for your whole fleet each morning and keeps fixing them while drivers are out.
          </p>
          <div className="actions">
            <a className="button" href="https://usenotra.com">
              Book a demo
            </a>
            <a className="link" href="/changelog">
              See what&apos;s new →
            </a>
          </div>
        </section>

        <section className="features" aria-label="Features">
          {features.map((feature) => (
            <article key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="latest">
          <h2>From the blog</h2>
          <p>
            Routing, dispatch and last-mile operations. Start with{" "}
            <a href="/blog/live-traffic-rerouting">routes that react to traffic</a>.
          </p>
        </section>
      </main>

      <footer className="footer">
        <span>© 2026 Pathway</span>
        <nav aria-label="Footer">
          <a href="/blog">Blog</a>
          <a href="/changelog">Changelog</a>
          <a href="https://usenotra.com">Made with Notra</a>
        </nav>
      </footer>
    </>
  );
}
