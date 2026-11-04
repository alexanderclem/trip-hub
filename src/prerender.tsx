import { renderToString } from 'react-dom/server'
import { createMemoryRouter, createStaticHandler, RouterProvider } from 'react-router'
import { routes } from './router'
import { MotionProvider } from './ui/MotionProvider'
import { publicPages } from './features/website/metadata'

/** Build-time rendering is restricted to public pages; no private trip or account is rendered. */
export async function render(path: string) {
  if (!publicPages[path]) throw new Error('Only public marketing pages may be pre-rendered.')
  const handler = createStaticHandler(routes)
  const context = await handler.query(new Request(`https://joinstowaway.app${path}`))
  if (context instanceof Response) throw new Error(`Unexpected pre-render response: ${context.status}`)
  if (context.errors) throw new Error(`Pre-render failed for ${path}`)
  const router = createMemoryRouter(handler.dataRoutes, { initialEntries: [path], hydrationData: { loaderData: context.loaderData, actionData: context.actionData, errors: context.errors } })
  try { return renderToString(<MotionProvider><RouterProvider router={router} /></MotionProvider>) }
  finally { router.dispose() }
}
