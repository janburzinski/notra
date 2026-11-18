import { addCustomDomains, isValid } from "mailchecker";

import { EXTRA_DISPOSABLE_EMAIL_DOMAINS } from "@/constants/disposable-email";

addCustomDomains(EXTRA_DISPOSABLE_EMAIL_DOMAINS);

export const isNotDisposableEmail = isValid;
