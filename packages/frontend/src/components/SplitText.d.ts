import { ComponentType } from 'react'

export interface SplitTextProps {
  text: string
  className?: string
  delay?: number
  duration?: number
  ease?: string
  splitType?: 'chars' | 'words' | 'lines'
  from?: Record<string, unknown>
  to?: Record<string, unknown>
  threshold?: number
  rootMargin?: string
  textAlign?: string
  onLetterAnimationComplete?: () => void
  showCallback?: boolean
}

declare const SplitText: ComponentType<SplitTextProps>
export default SplitText
