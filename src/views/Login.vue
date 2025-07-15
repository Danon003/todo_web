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
          />
        </div>
        <button type="submit" class="submit-btn">Войти</button>
      </form>
      <p class="auth-link">Нет аккаунта? <router-link to="/register">Зарегистрируйтесь</router-link></p>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { useRouter } from 'vue-router'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const loginForm = {
      username: '',
      password: ''
    }
    let error = ''

    const handleLogin = async () => {
      try {
        const response = await axios.post(
            'http://localhost:8080/auth/login',
            {
              username: loginForm.username,
              password: loginForm.password
            },
            {
              withCredentials: true
            }
        );

        localStorage.setItem('jwt-token', response.data['jwt-token']);
        await router.push('/');
      } catch (err) {
        error.value = err.response?.data?.message || 'Ошибка при входе';
      }
    }

    return {
      loginForm,
      error,
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
}

.submit-btn {
  width: 100%;
  padding: 1.2rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  margin-top: 1rem;
}

.submit-btn:hover {
    background-color: rgba(79, 119, 79, 0.78);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(167, 238, 153, 0.3);
}

.submit-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(170, 250, 170, 0.3);
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
