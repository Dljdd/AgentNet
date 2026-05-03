import { ComponentType } from 'react'

export interface GridScanProps {
  sensitivity?: number
  lineThickness?: number
  linesColor?: string
  scanColor?: string
  scanOpacity?: number
  gridScale?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  lineJitter?: number
  scanDirection?: 'up' | 'down' | 'pingpong'
  noiseIntensity?: number
  scanGlow?: number
  scanSoftness?: number
  scanDuration?: number
  scanDelay?: number
  scanOnClick?: boolean
}

export declare const GridScan: ComponentType<GridScanProps>
