import { useEffect, useState } from "react";

/**
 * Hash routes (#/configure), so the site works from any folder of GitHub Pages:
 * the site itself, a pull request preview under pr-preview/<n>/, or a file.
 */
export type Route =
  | { page: "home" }
  | { page: "toolbox" }
  | { page: "configure"; target?: string } | { page: "not-found"; path: string };

export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "") return { page: "home" };
  if (clean === "/toolbox") return { page: "toolbox" };
  if (clean === "/configure") {
    const target = new URLSearchParams(query).get("target") ?? undefined;
    return { page: "configure", target };
  }
  return { page: "not-found", path: clean };
}

export function href(path: string): string {
  return `#${path}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
