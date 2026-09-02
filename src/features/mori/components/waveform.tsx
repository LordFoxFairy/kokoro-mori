import styles from "../mori-workspace.module.css"

type WaveformProps = {
  seed: number
  compact?: boolean
  progress?: number
}

export function Waveform({ seed, compact = false, progress = 1 }: WaveformProps) {
  const bars = Array.from({ length: compact ? 25 : 39 }, (_, index) => {
    const rhythm = Math.abs(Math.sin((index + 1) * (seed * 0.37)))
    const contour = Math.abs(Math.cos((index + seed) * 0.21))
    return Math.max(18, Math.round((rhythm * 0.62 + contour * 0.38) * 100))
  })

  return (
    <div className={`${styles.waveform} ${compact ? styles.waveformCompact : ""}`} aria-hidden="true">
      {bars.map((height, index) => (
        <span
          className={styles.waveBar}
          key={`${seed}-${index}`}
          style={{ height: `${height}%`, opacity: index / bars.length < progress ? 0.96 : 0.34 }}
        />
      ))}
    </div>
  )
}
