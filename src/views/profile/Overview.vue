<template>
  <div class="overview">
    <h2 class="welcome-title">Добро пожаловать, {{ user.username }}</h2>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import api from "@/api/index.js";

export default {
  name: 'Overview',
  setup() {
    const user = ref({})

    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('jwt-token')
        const response = await api.getUserInfo()
        user.value = response.data
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error)
      }
    }

    onMounted(() => {
      fetchUser()
    })

    return { user }
  }
}
</script>

<style scoped>
.overview {
  padding: 20px;
}

.welcome-title {
  color: #000; /* Явно задаём чёрный цвет */
  font-size: 24px;
  margin-bottom: 20px;
}

.stats {
  display: flex;
  gap: 20px;
  margin-top: 30px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  flex: 1;
  text-align: center;
  color: #000; /* Чёрный цвет для карточек */
}

.stat-card h3 {
  margin-top: 0;
  color: #000; /* Чёрный цвет для заголовков */
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0 0;
  color: #000 !important; /* Явно чёрный цвет для значений */
}
</style>