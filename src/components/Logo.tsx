interface LogoProps {
  size?: number
  withName?: boolean
}

/** The Infynix mark (public/infynixicon.svg), optionally with the product name. */
export function Logo({ size = 24, withName = false }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/infynixicon.svg"
        alt={withName ? '' : 'Infynix OS'}
        width={size}
        height={size}
        className="shrink-0 dark:brightness-[1.35]"
      />
      {withName && (
        <span className="text-body-lg font-semibold tracking-title text-ink">
          Infynix OS
        </span>
      )}
    </span>
  )
}
