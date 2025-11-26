import dynamic from 'next/dynamic'

const RecimsApp = dynamic(() => import('@/App'), { ssr: false })

export default function IndexPage() {
  return <RecimsApp />
}
