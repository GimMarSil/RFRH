import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  const selectedEmployeeId = req.cookies.get('selectedEmployeeId')?.value
  if (selectedEmployeeId) {
    return NextResponse.next()
  }

  if (!pathname.startsWith('/landing')) {
    const url = req.nextUrl.clone()
    url.pathname = '/landing'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
