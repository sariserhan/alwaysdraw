import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/canvas", label: "Canvas" },
  { href: "/board", label: "Board" },
  { href: "/sketchbook", label: "Sketchbook" },
];

/**
 * Server-rendered heading, one-line summary and site links for routes whose
 * visible UI is drawn client-side (canvas, board, sketchbook pages). Visually
 * hidden; it gives screen readers and crawlers the page's name and real
 * <a href> links to the rest of the site, which the bare canvas HTML lacked.
 */
export function RouteSummary({
  heading,
  summary,
  extraLinks = [],
}: {
  heading: string;
  summary: string;
  extraLinks?: { href: string; label: string }[];
}) {
  return (
    <header className="sr-only">
      <h1>{heading}</h1>
      <p>{summary}</p>
      <nav aria-label="Site">
        <ul>
          {[...LINKS, ...extraLinks].map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
