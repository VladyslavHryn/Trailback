import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { BreakdownBars, type BreakdownRow } from './StoryCharts'
import { formatDaysUniform, formatDuration } from './format'
import type { CategoryBreakdown } from '../../analytics/placeInsights'

type CategoriesSectionProps = {
  categories: CategoryBreakdown[]
}

const MAX_CATEGORIES = 6

export function CategoriesSection({ categories }: CategoriesSectionProps) {
  if (categories.length === 0) return null

  const shown = categories.slice(0, MAX_CATEGORIES)
  const max = Math.max(...shown.map((c) => c.totalDurationSec), 1)

  // Bars are scaled against the largest category rather than the sum: these
  // are only the places whose type OSM actually knows, so they don't form a
  // whole, and a share-of-total reading would be quietly wrong.
  const rows: BreakdownRow[] = shown.map((c) => ({
    key: c.category,
    label: c.category,
    value: formatDaysUniform(c.totalDurationSec),
    ratio: c.totalDurationSec / max,
  }))

  const top = shown[0]

  return (
    <StorySection
      eyebrow="Категорії місць"
      index="06"
      title={
        <>
          Найбільше часу —<br />
          це <span className="text-trail-400">{top.category}</span>
        </>
      }
      subtitle={`Разом ${formatDuration(top.totalDurationSec)} у цій категорії.`}
    >
      <BreakdownBars rows={rows} />

      <Reveal index={rows.length}>
        <p className="mt-10 text-xs leading-relaxed text-ink-400">
          Категорії беруться з OpenStreetMap і показуються лише там, де тип
          місця вдалося впевнено визначити.
        </p>
      </Reveal>
    </StorySection>
  )
}
