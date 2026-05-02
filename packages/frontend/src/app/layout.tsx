import type { Metadata } from 'next'
import { Instrument_Serif, JetBrains_Mono, Alfa_Slab_One } from 'next/font/google'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

const alphaSlabOne = Alfa_Slab_One({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-logo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AgentNet',
  description: 'Three agents. One job. Best score wins.',
  openGraph: {
    title: 'AgentNet',
    description: 'Decentralized AI agent reputation network on 0G.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable} ${alphaSlabOne.variable}`}
      style={{ fontFamily: "'General Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <body className="min-h-screen antialiased" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        {children}
      </body>
    </html>
  )
}
