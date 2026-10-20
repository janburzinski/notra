export const DEMO_START_HTML = `<!doctype html>
<html lang="en">
<head><title>Demo admission regression</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><main id="root"></main><script type="module" src="/fixture.js"></script></body>
</html>`;

export const DEMO_TURNSTILE_STUB = `
let counter = 0;
let container;
let options;
window.turnstile = {
  render(element, config) {
    container = element;
    container.style.minWidth = "300px";
    options = config;
    const button = document.createElement("button");
    button.textContent = "Verify demo access";
    button.onclick = () => options.callback("synthetic-token-" + ++counter);
    container.append(button);
    return "synthetic-widget";
  },
  reset() { options["expired-callback"](); },
  remove() { container.replaceChildren(); }
};`;
