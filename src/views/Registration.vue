<template>
  <div class="register-container">
    <div class="register-form">
      <h2>Регистрация</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">Логин:</label>
          <input
              id="username"
              v-model="registerForm.username"
              type="text"
              required
              class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="password">Пароль:</label>
          <input
              id="password"
              v-model="registerForm.password"
              type="password"
              required
              class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="email">Email:</label>
          <input
              id="email"
              v-model="registerForm.email"
              type="email"
              required
              class="form-input"
          />
        </div>
        <button type="submit" class="submit-btn">Зарегистрироваться</button>
      </form>
      <p class="auth-link">Уже есть аккаунт? <router-link to="/login">Войдите</router-link></p>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="success" class="success-message">{{ success }}</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { useRouter } from 'vue-router'
import api from "@/api/index.js";

export default {
  name: 'Registration',
  setup() {
    const router = useRouter()
    const registerForm = {
      username: '',
      password: '',
      name: '',
      email: ''
    }
    let error = ''
    let success = ''

    const handleRegister = async () => {
      try {
        const response = await api.register( {
          username: registerForm.username,
          password: registerForm.password,
          email: registerForm.email
        })

        success = 'Регистрация успешна! Авторизуйтесь.'
        error = ''

        if (response.data['jwt-token']) {
          localStorage.setItem('jwt-token', response.data['jwt-token'])
          await router.push('/')
        }
      } catch (err) {
        error = err.response?.data?.message || 'Ошибка при регистрации'
        success = ''
      }
    }

    return {
      registerForm,
      error,
      success,
      handleRegister
    }
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100vw;
  background: var(--bg-secondary);
  margin: 0;
  padding: 0;
}

.register-form {
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
  margin-bottom: 30px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 25px;
}

label {
  display: block;
  margin-bottom: 10px;
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 15px;
  font-size: 16px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--input-text);
  border-radius: 6px;
  box-sizing: border-box;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #f082ff;
  box-shadow: 0 0 0 3px rgba(240, 130, 255, 0.2);
}

.submit-btn {
  width: 100%;
  padding: 1.2rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  margin-top: 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.submit-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.auth-link {
  text-align: center;
  margin-top: 20px;
  color: var(--text-secondary);
  font-size: 15px;
}

.auth-link a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.auth-link a:hover {
  text-decoration: underline;
}

.error-message {
  color: var(--color-danger);
  text-align: center;
  margin-top: 20px;
  font-size: 15px;
}

.success-message {
  color: var(--color-success);
  text-align: center;
  margin-top: 20px;
  font-size: 15px;
}

@media (min-width: 768px) {
  .register-form {
    max-width: 450px;
    border-radius: 1rem;
    box-shadow: var(--shadow-lg);
    height: auto;
    padding: 3rem;
  }
}

@media (max-width: 767px) {
  .register-container {
    padding: 0;
  }

  .register-form {
    border-radius: 0;
    height: 100vh;
  }
}
</style>