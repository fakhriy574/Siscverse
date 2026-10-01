export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser()

  // Jika tidak ada user yang login, lempar kembali ke halaman login (sesuaikan rutenya)
  if (!user.value) {
    return navigateTo('/') 
  }
})