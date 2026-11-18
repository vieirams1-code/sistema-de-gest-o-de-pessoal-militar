/** Header the backend reads to tell which frontend build sent a request. */
export declare const BUILD_COMMIT_HEADER = "X-Base44-Build";
/**
 * The build-commit header to send from this client, if any.
 *
 * Only a browser sends it: the value names the browser bundle, so a server
 * (Node, Deno, a backend function) or React Native would report a commit that
 * isn't the one running.
 *
 * @internal
 */
export declare function getBuildCommitHeaders(): Record<string, string>;
