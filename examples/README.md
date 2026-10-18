# Notra examples

Ready-to-copy setups for Notra products. Each folder is self-contained.

Start with [`sites/default/`](./sites/default) for the default Notra hosted blog and changelog template. Deploy it from this repository using `examples/sites/default` as the site subdirectory.

- [`sites/`](./sites) — Notra Sites blogs and changelogs, one folder per site. Every folder is deployed as its own site from this repository with **Site is in a subdirectory** set to `examples/sites/<name>`.
- [`hosts/`](./hosts) — small apps that serve one of the sites under a path like `/blog` on their own domain.

To start your own site, copy a folder into your repository and connect it in the dashboard under **Sites → New site**.
