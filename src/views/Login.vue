<template>
  <div class="login-container">
    <div class="login-form">
      <!-- Форма входа -->
      <div v-if="!showForgotPassword && !showResetPassword">
        <h2>Вход в систему</h2>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="username">Логин:</label>
            <input
                id="username"
                v-model="loginForm.username"
                type="text"
                required
                class="form-input"
                :disabled="loading"
            />
          </div>
          <div class="form-group">
            <label for="password">Пароль:</label>
            <input
                id="password"
                v-model="loginForm.password"
                type="password"
                required
                class="form-input"
                :disabled="loading"
            />
          </div>
          <button
              type="submit"
              class="submit-btn"
              :disabled="loading"
          >
            <span v-if="loading">Вход...</span>
            <span v-else>Войти</span>
          </button>
        </form>

        <div class="auth-links">
          <p class="auth-link">Нет аккаунта? <router-link to="/register">Зарегистрируйтесь</router-link></p>
          <p class="auth-link">
            <a href="#" @click.prevent="showForgotPassword = true" class="forgot-password-link">
              Забыли пароль?
            </a>
          </p>
        </div>
      </div>

      <!-- Форма восстановления пароля -->
      <div v-if="showForgotPassword && !showResetPassword" class="forgot-password-form">
        <div class="form-header">
          <button type="button" @click="backToLogin" class="back-btn">← Назад</button>
          <h2>Восстановление пароля</h2>
        </div>

        <form @submit.prevent="sendResetCode">
          <div class="form-group">
            <label for="email">Email:</label>
            <input
                id="email"
                v-model="forgotPasswordForm.email"
                type="email"
                required
                class="form-input"
                :disabled="loading"
                placeholder="Введите email, указанный при регистрации"
            />
          </div>
          <button
              type="submit"
              class="submit-btn"
              :disabled="loading"
          >
            <span v-if="loading">Отправка...</span>
            <span v-else>Отправить код</span>
          </button>
        </form>
      </div>

      <!-- Форма сброса пароля -->
      <div v-if="showResetPassword" class="reset-password-form">
        <div class="form-header">
          <button type="button" @click="backToForgotPassword" class="back-btn">← Назад</button>
          <h2>Создание нового пароля</h2>
        </div>

        <form @submit.prevent="resetPassword">
          <div class="form-group">
            <label for="resetCode">Код подтверждения:</label>
            <input
                id="resetCode"
                v-model="resetPasswordForm.code"
                type="text"
                required
                class="form-input"
                :disabled="loading"
                placeholder="Введите код из письма"
            />
          </div>
          <div class="form-group">
            <label for="newPassword">Новый пароль:</label>
            <input
                id="newPassword"
                v-model="resetPasswordForm.newPassword"
                type="password"
                required
                class="form-input"
                :disabled="loading"
                placeholder="Введите новый пароль"
                minlength="6"
            />
            <div class="password-hint">
              Пароль должен содержать минимум 6 символов
            </div>
          </div>
          <div class="form-group">
            <label for="confirmPassword">Подтвердите пароль:</label>
            <input
                id="confirmPassword"
                v-model="resetPasswordForm.confirmPassword"
                type="password"
                required
                class="form-input"
                :disabled="loading"
                placeholder="Повторите новый пароль"
            />
            <div v-if="passwordMismatch" class="error-text">
              Пароли не совпадают
            </div>
          </div>
          <button
              type="submit"
              class="submit-btn"
              :disabled="loading || passwordMismatch"
          >
            <span v-if="loading">Сброс...</span>
            <span v-else>Сбросить пароль</span>
          </button>
        </form>
      </div>

      <!-- Блок для отображения сообщений -->
      <div v-if="message" class="success-message">
        {{ message }}
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()

    // Состояния для переключения между формами
    const showForgotPassword = ref(false)
    const showResetPassword = ref(false)

    // Форма входа
    const loginForm = ref({
      username: '',
      password: ''
    })

    // Форма восстановления пароля
    const forgotPasswordForm = ref({
      email: ''
    })

    // Форма сброса пароля
    const resetPasswordForm = ref({
      code: '',
      newPassword: '',
      confirmPassword: ''
    })

    const loading = ref(false)
    const error = ref('')
    const message = ref('')

    // Проверка совпадения паролей
    const passwordMismatch = computed(() => {
      return resetPasswordForm.value.newPassword !== '' &&
          resetPasswordForm.value.confirmPassword !== '' &&
          resetPasswordForm.value.newPassword !== resetPasswordForm.value.confirmPassword
    })

    // Метод входа
    const handleLogin = async () => {
      error.value = ''
      message.value = ''
      loading.value = true

      try {
        const response = await api.login({
          username: loginForm.value.username,
          password: loginForm.value.password
        });

        console.log('Login response:', response)

        if (response.data && response.data['jwt-token']) {
          localStorage.setItem('jwt-token', response.data['jwt-token']);
          await router.push('/');
        } else {
          throw new Error('Не удалось получить токен авторизации')
        }

      } catch (err) {
        console.error('Login error:', err)
        handleError(err)
      } finally {
        loading.value = false
      }
    }

    // Метод отправки кода восстановления
    const sendResetCode = async () => {
      error.value = ''
      message.value = ''
      loading.value = true

      try {
        await api.forgotPassword(forgotPasswordForm.value.email)

        message.value = 'Код подтверждения отправлен на ваш email'
        showResetPassword.value = true
      } catch (err) {
        console.error('Forgot password error:', err)
        handleError(err)
      } finally {
        loading.value = false
      }
    }

    // Метод сброса пароля
    const resetPassword = async () => {
      if (passwordMismatch.value) {
        error.value = 'Пароли не совпадают'
        return
      }

      error.value = ''
      message.value = ''
      loading.value = true

      try {
        await api.resetPassword({
          email: forgotPasswordForm.value.email,
          code: resetPasswordForm.value.code,
          newPassword: resetPasswordForm.value.newPassword
        })

        message.value = 'Пароль успешно изменен! Теперь вы можете войти с новым паролем.'

        // Возвращаемся к форме входа через 3 секунды
        setTimeout(() => {
          backToLogin()
        }, 3000)
      } catch (err) {
        console.error('Reset password error:', err)
        handleError(err)
      } finally {
        loading.value = false
      }
    }

    // Обработка ошибок
    const handleError = (err) => {
      if (err.response && err.response.data) {
        if (err.response.data.message === 'Incorrect credentials!') {
          error.value = 'Неверный логин или пароль'
        } else if (err.response.data.message) {
          error.value = err.response.data.message
        } else {
          error.value = 'Произошла ошибка'
        }
      } else if (err.response) {
        if (err.response.status === 401) {
          error.value = 'Неверный логин или пароль'
        } else if (err.response.status === 400) {
          error.value = 'Некорректные данные'
        } else {
          error.value = `Ошибка сервера: ${err.response.status}`
        }
      } else if (err.request) {
        error.value = 'Не удалось подключиться к серверу'
      } else {
        error.value = err.message || 'Произошла ошибка'
      }
    }

    // Навигация между формами
    const backToLogin = () => {
      showForgotPassword.value = false
      showResetPassword.value = false
      error.value = ''
      message.value = ''
      forgotPasswordForm.value.email = ''
      resetPasswordForm.value.code = ''
      resetPasswordForm.value.newPassword = ''
      resetPasswordForm.value.confirmPassword = ''
    }

    const backToForgotPassword = () => {
      showResetPassword.value = false
      error.value = ''
      message.value = ''
      resetPasswordForm.value.code = ''
      resetPasswordForm.value.newPassword = ''
      resetPasswordForm.value.confirmPassword = ''
    }

    return {
      // Состояния
      showForgotPassword,
      showResetPassword,
      loginForm,
      forgotPasswordForm,
      resetPasswordForm,
      loading,
      error,
      message,
      passwordMismatch,

      // Методы
      handleLogin,
      sendResetCode,
      resetPassword,
      backToLogin,
      backToForgotPassword
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100vw;
  background: var(--bg-secondary);
  margin: 0;
  padding: 0;
}

.login-form {
  width: 100%;
  max-width: 100%;
  padding: 2rem;
  background: var(--bg-primary);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

h2 {
  text-align: center;
  margin-bottom: 2.5rem;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  color: var(--text-primary);
}

.form-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 2rem;
}

.form-header h2 {
  margin: 0;
  text-align: left;
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-success);
  cursor: pointer;
  font-size: 16px;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.back-btn:hover {
  background-color: var(--bg-tertiary);
}

.form-group {
  margin-bottom: 1.8rem;
}

label {
  display: block;
  margin-bottom: 0.8rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: var(--text-secondary);
}

.form-input {
  width: 100%;
  padding: 1rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--input-text);
  border-radius: 0.5rem;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-input:focus {
  border-color: var(--color-success);
  outline: none;
}

.form-input:disabled {
  background-color: var(--bg-tertiary);
  cursor: not-allowed;
}

.password-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.error-text {
  font-size: 0.85rem;
  color: var(--color-danger);
  margin-top: 0.5rem;
}

.submit-btn {
  width: 100%;
  padding: 1.2rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  margin-top: 1rem;
  background: var(--color-success);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.submit-btn:disabled {
  background: var(--color-secondary);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.auth-links {
  margin-top: 1.5rem;
}

.auth-link {
  text-align: center;
  margin: 0.5rem 0;
  color: var(--text-secondary);
  font-size: 15px;
}

.auth-link a {
  color: var(--color-success);
  text-decoration: none;
  font-weight: 500;
}

.auth-link a:hover {
  text-decoration: underline;
}

.forgot-password-link {
  color: var(--color-success) !important;
}

.success-message {
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(46, 125, 50, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(46, 125, 50, 0.2);
  border-radius: 0.5rem;
  text-align: center;
}

.error-message {
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(198, 40, 40, 0.1);
  color: var(--color-danger);
  border: 1px solid rgba(198, 40, 40, 0.2);
  border-radius: 0.5rem;
  text-align: center;
}

/* Медиазапросы для адаптации */
@media (min-width: 768px) {
  .login-form {
    max-width: 450px;
    border-radius: 1rem;
    box-shadow: var(--shadow-lg);
    height: auto;
    padding: 3rem;
  }
}

@media (max-width: 767px) {
  .login-container {
    padding: 0;
  }

  .login-form {
    border-radius: 0;
    height: 100vh;
  }

  .form-header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .form-header h2 {
    text-align: center;
  }
}
</style>