import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentNet Explorer',
  description: 'Decentralized AI Agent Reputation Explorer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0a] text-gray-200 antialiased">
        {children}
      </body>
    </html>
  )
}
