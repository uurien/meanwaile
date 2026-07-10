---
description: Wait N seconds (default 20) via a blocking Node.js timer, for testing
argument-hint: [seconds]
---

Wait for a period of time by running a blocking Node.js command. Useful for testing timing-dependent behavior.

1. Determine the number of seconds to wait:
   - If an argument was given (e.g. `/wait-to-test 12`), use it as the seconds.
   - Otherwise, default to 20 seconds.

2. Convert seconds to milliseconds (seconds * 1000).

3. Run the following, substituting the computed milliseconds, and wait for it to finish:
   `node -e "setTimeout(() => {}, <milliseconds>)"`
   Set the Bash tool's `timeout` a few seconds above the wait duration so it doesn't cut the wait short.

4. Report how many seconds were waited.
