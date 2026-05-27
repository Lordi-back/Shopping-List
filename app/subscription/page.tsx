import dynamic from 'next/dynamic'

const SubscriptionPage = dynamic(
  () => import('@/components/subscription/SubscriptionPage').then(mod => mod.SubscriptionPage),
  { ssr: false }
)

export default function Page() {
  return <SubscriptionPage />
}
