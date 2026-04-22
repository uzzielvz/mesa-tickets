interface HeaderProps {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <div className="px-5 pt-16 pb-5 md:px-9 md:pt-9 md:pb-6 pr-6 md:pr-9 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold text-navy tracking-[-0.4px] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-ink-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
