'use client'

import NextLink from 'next/link'
import { useParams as useNextParams, usePathname, useRouter } from 'next/navigation'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'

export function useNavigate() {
  const router = useRouter()
  return (to: string | number) => {
    if (typeof to === 'number') {
      if (to < 0) router.back()
      else router.forward()
      return
    }
    router.push(to)
  }
}

export function useLocation() {
  return { pathname: usePathname() }
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useNextParams() as T
}

type LinkProps = {
  to: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLAnchorElement>
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>
  onMouseLeave?: MouseEventHandler<HTMLAnchorElement>
}

export function Link({ to, ...props }: LinkProps) {
  return <NextLink href={to} {...props} />
}

type NavLinkProps = Omit<LinkProps, 'children' | 'className'> & {
  end?: boolean
  title?: string
  className?: string | ((state: { isActive: boolean }) => string)
  children: ReactNode | ((state: { isActive: boolean }) => ReactNode)
}

export function NavLink({ to, end, className, children, ...props }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  const state = { isActive }
  return (
    <NextLink href={to} className={typeof className === 'function' ? className(state) : className} {...props}>
      {typeof children === 'function' ? children(state) : children}
    </NextLink>
  )
}
