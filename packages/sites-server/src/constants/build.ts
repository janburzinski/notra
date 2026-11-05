import { FONT_CACHE_DIR } from "@notra/sites-core/constants/fonts";
import { SITE_BUILD_LIMITS } from "@notra/sites-core/constants/sites";

export const BOX_WORKDIR = "/workspace/home";
// The builder's default work dir in the Box (toolchain/.notra/work), where it looks for fonts.
export const BOX_FONT_CACHE_DIR = `${BOX_WORKDIR}/toolchain/.notra/work/${FONT_CACHE_DIR}`;
export const BOX_FONT_ARCHIVE = "fonts.tgz";
export const BOX_TTL_SECONDS = SITE_BUILD_LIMITS.buildTimeoutSeconds + 5 * 60;
export const BUILD_LOG_POLL_MS = 2000;
/** Exit code of coreutils `timeout` when it stops the compile step. */
export const BUILD_TIMEOUT_EXIT_CODE = 124;
export const UPLOAD_CONCURRENCY = 16;
export const TAR_BLOCK_SIZE = 512;
