/**
 * Continues the visitor's session, or opens one when there is none or the
 * view arrives from another source. It touches only `KEYS[1]`, so Upstash
 * locks just that key (`allow-key-locking`).
 *
 * KEYS: the visitor's session key.
 * ARGV: a new session id, the arrival origin ("" inside a visit), TTL (s).
 * Returns the session id and the view's page index.
 */
export const WEB_SESSION_RESOLVE_SCRIPT = `#!lua flags=allow-key-locking
local stored = redis.call('GET', KEYS[1])
local next = { id = ARGV[1], index = 1, origin = ARGV[2] }
if stored then
  local current = cjson.decode(stored)
  if ARGV[2] == '' or current.origin == ARGV[2] then
    next = { id = current.id, index = current.index + 1, origin = current.origin }
  end
end
redis.call('SET', KEYS[1], cjson.encode(next), 'EX', ARGV[3])
return { next.id, next.index }
`;
