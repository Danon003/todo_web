<template>
  <div class="login-container">
    <div class="login-form">
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
      <p class="auth-link">Нет аккаунта? <router-link to="/register">Зарегистрируйтесь</router-link></p>

      <!-- Блок для отображения ошибок -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import api from '@/api'
import {ref} from "vue";

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const loginForm = ref({
      username: '',
      password: ''
    })
    const error = ref('')
    const loading = ref(false)

    const handleLogin = async () => {
      error.value = ''
      loading.value = true

      try {
        const response = await api.login({
          username: loginForm.value.username,
          password: loginForm.value.password
        });

        console.log('Login response:', response)

        // Проверяем наличие токена в ответе
        if (response.data && response.data['jwt-token']) {
          localStorage.setItem('jwt-token', response.data['jwt-token']);
          await router.push('/');
        } else {
          // Если токена нет, но ответ успешный - что-то пошло не так
          throw new Error('Не удалось получить токен авторизации')
        }

      } catch (err) {
        console.error('Login error:', err)

        // Обрабатываем ошибку от сервера
        if (err.response && err.response.data) {
          // Сервер вернул ошибку в формате { "message": "Incorrect credentials!" }
          if (err.response.data.message === 'Incorrect credentials!') {
            error.value = 'Неверный логин или пароль'
          } else if (err.response.data.message) {
            error.value = err.response.data.message
          } else {
            error.value = 'Произошла ошибка при входе'
          }
        } else if (err.response) {
          // HTTP ошибка без тела ответа
          if (err.response.status === 401) {
            error.value = 'Неверный логин или пароль'
          } else if (err.response.status === 400) {
            error.value = 'Некорректные данные'
          } else {
            error.value = `Ошибка сервера: ${err.response.status}`
          }
        } else if (err.request) {
          // Запрос был сделан, но ответ не получен
          error.value = 'Не удалось подключиться к серверу'
        } else {
          // Другие ошибки
          error.value = err.message || 'Произошла ошибка при входе'
        }
      } finally {
        loading.value = false
      }
    }

    return {
      loginForm,
      error,
      loading,
      handleLogin
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
  background-color: #f5f5f7;
  margin: 0;
  padding: 0;
}

.login-form {
  width: 100%;
  max-width: 100%;
  padding: 2rem;
  background: white;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

h2 {
  text-align: center;
  margin-bottom: 2.5rem;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
}

.form-group {
  margin-bottom: 1.8rem;
}

label {
  display: block;
  margin-bottom: 0.8rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
}

.form-input {
  width: 100%;
  padding: 1rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.form-input:focus {
  border-color: #4CAF50;
  outline: none;
}

.form-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.submit-btn {
  width: 100%;
  padding: 1.2rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  margin-top: 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-btn:hover:not(:disabled) {
  background-color: rgba(79, 119, 79, 0.78);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(167, 238, 153, 0.3);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(170, 250, 170, 0.3);
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.auth-link {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 15px;
}

.auth-link a {
  color: #00bc85;
  text-decoration: none;
  font-weight: 500;
}

.auth-link a:hover {
  text-decoration: underline;
}

.error-message {
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
  border-radius: 0.5rem;
  text-align: center;
}

/* Медиазапросы для адаптации */
@media (min-width: 768px) {
  .login-form {
    max-width: 450px;
    border-radius: 1rem;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
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
}
</style>