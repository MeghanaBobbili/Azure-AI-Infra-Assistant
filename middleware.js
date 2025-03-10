import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request) {
  const path = request.nextUrl.pathname
  
  // Public paths that don't require authentication
  const publicPaths = [
    '/auth/signin',
    '/auth/error',
    '/api/auth'
  ]

  // Check if the path is public
  const isPublicPath = publicPaths.some(pp => 
    path.startsWith(pp) || 
    path.startsWith('/_next') || 
    path.startsWith('/static')
  )

  if (isPublicPath) {
    return NextResponse.next()
  }

  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  // Redirect to login if there is no token
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!auth|_next/static|_next/image|favicon.ico).*)',
  ],
} 