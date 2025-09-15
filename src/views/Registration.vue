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
  background-color: #f5f5f7;
  margin: 0;
  padding: 0;
}

.register-form {
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
  margin-bottom: 30px;
  color: #333;
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
  color: #555;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 15px;
  font-size: 16px;
  border: 1px solid #ddd;
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
  color: #e74c3c;
  text-align: center;
  margin-top: 20px;
  font-size: 15px;
}

.success-message {
  color: #06d6a0;
  text-align: center;
  margin-top: 20px;
  font-size: 15px;
}

@media (min-width: 768px) {
  .register-form {
    max-width: 450px;
    border-radius: 1rem;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
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
