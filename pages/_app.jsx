import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/index.css'
import '@/App.css'
import { ensureSeedDataLoaded } from '@/lib/seedData'

if (typeof window !== 'undefined') {
  ensureSeedDataLoaded()
}

export default function MyApp({ Component, pageProps }) {
  const [queryClient] = useState(() => new QueryClient())
  useEffect(() => {
    ensureSeedDataLoaded()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
    </QueryClientProvider>
  )
}
