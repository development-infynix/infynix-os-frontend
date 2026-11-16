interface LoaderProps {
  /** Read by screen readers; the bars themselves are decorative. */
  label?: string
  className?: string
}

/**
 * The app's loader: four bars that grow in turn (styles: `.loader` in
 * index.css, colour: `--loader-color` in tokens.css). Use it wherever
 * something is loading; `PageLoader` centres it in a page-sized area.
 */
export function Loader({ label = 'Loading…', className = '' }: LoaderProps) {
  return (
    <div role="status" aria-live="polite" className={`loader ${className}`}>
      <span className="loader-bar" aria-hidden />
      <span className="loader-bar" aria-hidden />
      <span className="loader-bar" aria-hidden />
      <span className="loader-bar" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** The loader centred in the viewport: the router's pending screen. */
export function PageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <Loader />
    </div>
  )
}
