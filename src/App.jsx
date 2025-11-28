import { useEffect } from "react"
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { ensureSeedDataLoaded } from "@/lib/seedData"

if (typeof window !== "undefined") {
  ensureSeedDataLoaded()
}

function App() {
  useEffect(() => {
    ensureSeedDataLoaded()
  }, [])
  return (
    <>
      <Pages />
      <Toaster />
    </>
  )
}

export default App 