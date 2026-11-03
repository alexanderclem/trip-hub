import type { ReactNode } from 'react'
import { LayoutGroup, LazyMotion } from 'motion/react'

const loadFeatures = () => import('./layoutFeatures').then((module) => module.default)

/** Load projection features only on surfaces that actually animate layout. */
export function LayoutMotion({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures} strict><LayoutGroup>{children}</LayoutGroup></LazyMotion>
}
