// Reports errors to the server, so they can be read without access to the
// headset: each one becomes a request for `diag?...` beside the player, which
// the server answers 404 and keeps in its access log. A given error is sent
// once per page load, and at most `max` in all, so an error repeating every
// frame doesn't flood the log.
export function createErrorReporter({ send, version, max = 20 }) {
    const sent = new Set();
    return function report(where, error) {
        const message = String(error?.message ?? error);
        const key = `${where}: ${message}`;
        if (sent.has(key) || sent.size >= max) {
            return false;
        }
        sent.add(key);
        const stack = String(error?.stack ?? "")
            .split("\n")
            .slice(1, 4)
            .map((line) => line.trim())
            .join(" | ");
        const query = new URLSearchParams({
            v: version,
            where,
            message: message.slice(0, 300),
            stack: stack.slice(0, 400),
        });
        send(query.toString());
        return true;
    };
}
