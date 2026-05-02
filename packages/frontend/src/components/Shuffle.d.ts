import { ComponentType } from 'react'

export interface ShuffleProps {
  text: string
  className?: string
  style?: React.CSSProperties
  tag?: string
  textAlign?: string
  shuffleDirection?: 'left' | 'right'
  duration?: number
  animationMode?: 'evenodd' | 'all'
  shuffleTimes?: number
  ease?: string
  stagger?: number
  threshold?: number
  triggerOnce?: boolean
  triggerOnHover?: boolean
  respectReducedMotion?: boolean
  loop?: boolean
  loopDelay?: number
}

declare const Shuffle: ComponentType<ShuffleProps>
export default Shuffle
