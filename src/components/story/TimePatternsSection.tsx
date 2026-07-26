import { StorySection } from './StorySection'
import { Reveal } from './Reveal'
import { ColumnChart } from './StoryCharts'
import type { TimePatterns } from '../../analytics/timePatterns'

type TimePatternsSectionProps = {
  timePatterns: TimePatterns
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const WEEKDAY_FULL = [
  'понеділок',
  'вівторок',
  'середа',
  'четвер',
  "п'ятниця",
  'субота',
  'неділя',
]

export function TimePatternsSection({ timePatterns }: TimePatternsSectionProps) {
  const peakHour = String(timePatterns.busiestHour).padStart(2, '0')
  const peakDay = WEEKDAY_FULL[timePatterns.busiestWeekdayIndex]

  return (
    <StorySection
      eyebrow="Ритм твого життя"
      index="05"
      title={
        <>
          Твій пік — <span className="text-trail-400">{peakHour}:00</span>,
          <br />
          найактивніший день — <span className="text-trail-400">{peakDay}</span>
        </>
      }
    >
      <div className="flex flex-col gap-16">
        <div>
          <Reveal>
            <p className="mb-6 text-label text-ink-400">
              За годинами доби
            </p>
          </Reveal>
          <ColumnChart
            values={timePatterns.byHour}
            labels={HOUR_LABELS}
            highlightIndex={timePatterns.busiestHour}
            labelStep={3}
            ariaLabel="Активність за годинами доби"
            accent="magnitude"
          />
        </div>

        <div>
          <Reveal>
            <p className="mb-6 text-label text-ink-400">
              За днями тижня
            </p>
          </Reveal>
          <ColumnChart
            values={timePatterns.byWeekday}
            labels={WEEKDAY_LABELS}
            highlightIndex={timePatterns.busiestWeekdayIndex}
            ariaLabel="Активність за днями тижня"
            accent="magnitude"
          />
        </div>
      </div>
    </StorySection>
  )
}
