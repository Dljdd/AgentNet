import { ComponentType } from 'react'

export interface ShapeGridProps {
  speed?: number
  squareSize?: number
  direction?: 'diagonal' | 'horizontal' | 'vertical'
  borderColor?: string
  hoverFillColor?: string
  shape?: 'square' | 'circle' | 'triangle'
  hoverTrailAmount?: number
}

declare const ShapeGrid: ComponentType<ShapeGridProps>
export default ShapeGrid
