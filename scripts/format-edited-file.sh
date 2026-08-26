#!/bin/sh

set -eu

file_path=$(node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => {
    const payload = JSON.parse(input);
    process.stdout.write(payload.file_path ?? payload.tool_input?.file_path ?? "");
  });
')

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.mts|*.cts)
    ./node_modules/.bin/oxlint --threads=4 --fix --no-error-on-unmatched-pattern "$file_path"
    ./node_modules/.bin/oxfmt --threads=4 --write --no-error-on-unmatched-pattern "$file_path"
    ;;
  *.json|*.jsonc|*.css|*.graphql|*.html|*.vue)
    ./node_modules/.bin/oxfmt --threads=4 --write --no-error-on-unmatched-pattern "$file_path"
    ;;
esac
