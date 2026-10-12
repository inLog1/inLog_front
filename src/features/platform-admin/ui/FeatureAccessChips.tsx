import { useTranslation } from 'react-i18next'
import { orderFeatureKeys } from './featureAccessMeta'

type ChipTone = {
  background: string
  color: string
  border: string
}

function tone(token: string, amount = 20): ChipTone {
  return {
    background: `color-mix(in srgb, var(${token}) ${amount}%, var(--card))`,
    color: `color-mix(in srgb, var(${token}) 78%, var(--foreground))`,
    border: `color-mix(in srgb, var(${token}) 55%, transparent)`,
  }
}

const FEATURE_TONES: Record<string, ChipTone> = {
  organizations: tone('--primary'),
  projects: tone('--accent'),
  notifications: tone('--warning'),
  tasks: tone('--success'),
  users: tone('--primary', 34),
  constructor: tone('--destructive', 18),
  measurements: tone('--accent', 36),
  wells: tone('--success', 36),
}

const FALLBACK_TONE = tone('--muted-foreground', 12, 40)

export function FeatureAccessChips({ features }: { features: readonly string[] }) {
  const { t } = useTranslation()

  if (features.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {orderFeatureKeys(features).map((feature) => {
        const label = t(`admin-page.feature-access.features.${feature}`, { defaultValue: feature })
        const chip = FEATURE_TONES[feature] ?? FALLBACK_TONE

        return (
          <span
            key={feature}
            title={label}
            className="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-5"
            style={{ background: chip.background, color: chip.color, borderColor: chip.border }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
