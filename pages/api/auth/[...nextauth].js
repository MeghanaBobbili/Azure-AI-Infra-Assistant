import NextAuth from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID,
      authorization: {
        params: {
          scope: 'openid profile email offline_access https://management.azure.com/user_impersonation'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        try {
          // Get subscription info from Azure Management API
          const response = await fetch('https://management.azure.com/subscriptions?api-version=2020-01-01', {
            headers: {
              Authorization: `Bearer ${account.access_token}`
            }
          })
          const data = await response.json()
          console.log('Azure API Response:', data)
          
          if (data.error) {
            console.error('Azure API Error:', data.error)
            throw new Error(data.error.message)
          }
          
          if (data.value && data.value.length > 0) {
            token.subscriptionId = data.value[0].subscriptionId
            token.tenantId = data.value[0].tenantId
          } else {
            console.error('No subscriptions found')
          }
        } catch (error) {
          console.error('Error fetching subscription:', error)
        }
      }
      console.log('JWT Token:', token)
      return token
    },
    async session({ session, token }) {
      // Store only essential data
      session.accessToken = token.accessToken
      session.subscriptionId = token.subscriptionId
      session.tenantId = token.tenantId
      session.user = {
        name: token.name,
        email: token.email
      }
      // Don't store refresh token in session
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development'
}

export default NextAuth(authOptions) 