
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './lib'

export async function registerDeviceNotifications(
  userId: string
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {}
  }

  if (!supabase) {
    throw new Error('Supabase não está configurado.')
  }

  // Verifica e solicita autorização para notificações.
  const currentPermission = await PushNotifications.checkPermissions()

  const permission =
    currentPermission.receive === 'granted'
      ? currentPermission
      : await PushNotifications.requestPermissions()

  if (permission.receive !== 'granted') {
    throw new Error('Permissão de notificações não concedida.')
  }

  // Recebe o token emitido pelo Firebase.
  const registrationListener = await PushNotifications.addListener(
    'registration',
    async (token) => {
      const { error } = await supabase!
        .from('user_devices')
        .upsert(
          {
            user_id: userId,
            fcm_token: token.value,
            platform: Capacitor.getPlatform(),
            enabled: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'fcm_token' }
        )

      if (error) {
        console.error('Erro ao salvar token FCM:', error)
      } else {
        console.log('Dispositivo registrado para notificações.')
      }
    }
  )

  const errorListener = await PushNotifications.addListener(
    'registrationError',
    (error) => {
      console.error('Erro no registro Firebase:', error)
    }
  )

  try {
    await PushNotifications.register()
  } catch (error) {
    await registrationListener.remove()
    await errorListener.remove()
    throw error
  }

  return () => {
    void registrationListener.remove()
    void errorListener.remove()
  }
}
