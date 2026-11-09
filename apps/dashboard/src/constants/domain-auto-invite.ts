/** University domains are shared by students, not one company (`.edu`, `.ac.uk`, `.edu.au`). */
export const ACADEMIC_DOMAIN_PATTERN = /(^|\.)(edu|ac)(\.[a-z]{2,3})?$/;

/** WorkOS's maximum page size, so one request covers almost every address. */
export const INVITATION_PAGE_SIZE = 100;
