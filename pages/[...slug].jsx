import dynamic from 'next/dynamic'

const RecimsApp = dynamic(() => import('@/App'), { ssr: false })

export default function RecimsCatchAll() {
  return <RecimsApp />
}
