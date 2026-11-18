import mailchecker from "mailchecker";

import { EXTRA_DISPOSABLE_EMAIL_DOMAINS } from "@/constants/disposable-email";

// mailchecker is CommonJS: Node and the Vite dev server only see its default
// export, so a named import fails there.
const { addCustomDomains, isValid } = mailchecker;

addCustomDomains(EXTRA_DISPOSABLE_EMAIL_DOMAINS);

export const isNotDisposableEmail = isValid;
