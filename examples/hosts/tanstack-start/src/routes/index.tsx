import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

const FEATURES = [
  {
    title: "One inbox for the team",
    text: "Email, chat and in-app messages land in one queue. Assign, reply and close without stepping on each other.",
  },
  {
    title: "SLA timers",
    text: "First response and resolution targets per plan. The clock pauses while you wait on the customer.",
  },
  {
    title: "Tickets API",
    text: "Open tickets from your own app with the user's plan and page attached, so nobody has to ask.",
  },
] as const;

function Home() {
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <a className="brand" href="/">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            Brightdesk
          </a>
          <nav className="links" aria-label="Main">
            <a href="/blog">Blog</a>
            <a href="/changelog">Changelog</a>
            <a className="button" href="https://usenotra.com">
              Try Brightdesk
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero container">
          <p className="eyebrow">Help desk for small SaaS teams</p>
          <h1>Answer every customer before they ask twice.</h1>
          <p className="lead">
            Brightdesk gives teams of 2 to 20 a shared inbox, SLA timers and a
            Tickets API, without the enterprise setup.
          </p>
          <div className="actions">
            <a className="button" href="https://usenotra.com">
              Start free
            </a>
            <a className="button secondary" href="/changelog">
              See what's new
            </a>
          </div>
        </section>

        <section className="features container" aria-label="Features">
          {FEATURES.map((feature) => (
            <article className="feature" key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="latest container">
          <h2>From the blog</h2>
          <p>
            Support playbooks and product news.{" "}
            <a href="/blog">Read the blog</a> or follow the{" "}
            <a href="/blog/feed.xml">RSS feed</a>.
          </p>
        </section>
      </main>

      <footer className="footer container">
        <span>© 2026 Brightdesk</span>
        <span>
          Blog and changelog by <a href="https://usenotra.com">Notra</a>
        </span>
      </footer>
    </>
  );
}
