<template>
  <div class="overview">
    <h2 class="welcome-title">Добро пожаловать, {{ user.username }}</h2>

    <!-- Дашборд для Администратора -->
    <div v-if="user.role === 'ROLE_ADMIN'" class="admin-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>👥 Пользователи</h3>
          <p class="stat-value">{{ stats.totalUsers || 0 }}</p>
          <div class="stat-details">
            <span>Студенты: {{ stats.roleStatistics?.ROLE_STUDENT || 0 }}</span>
            <span>Преподаватели: {{ stats.roleStatistics?.ROLE_TEACHER || 0 }}</span>
            <span>Админы: {{ stats.roleStatistics?.ROLE_ADMIN || 0 }}</span>
          </div>
        </div>

        <div class="stat-card">
          <h3>📚 Группы</h3>
          <p class="stat-value">{{ stats.totalGroups || 0 }}</p>
        </div>

        <div class="stat-card">
          <h3>📋 Задачи</h3>
          <p class="stat-value">{{ stats.totalTasks || 0 }}</p>
          <div class="stat-details">
            <span>Активные: {{ stats.activeTasks || 0 }}</span>
            <span>Завершенные: {{ stats.completedTasks || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Дашборд для Преподавателя -->
    <div v-else-if="user.role === 'ROLE_TEACHER'" class="teacher-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>🎓 Мои студенты</h3>
          <p class="stat-value">{{ stats.totalStudents || 0 }}</p>
          <span v-if="stats.myGroups">в {{ stats.myGroups.length }} группах</span>
        </div>

        <div class="stat-card">
          <h3>📊 Статистика задач</h3>
          <p class="stat-value">{{ stats.completedTasks || 0 }}/{{ stats.totalAssignedTasks || 0 }}</p>
          <div class="progress-bar">
            <div
                class="progress-fill"
                :style="{width: calculateProgress(stats.completedTasks, stats.totalAssignedTasks) + '%'}"
            ></div>
          </div>
          <span>Выполнено</span>
        </div>

        <div class="stat-card">
          <h3>📅 Активность</h3>
          <p class="stat-value">{{ stats.activeTasks || 0 }}</p>
          <span>активных задач</span>
        </div>
      </div>
    </div>

    <!-- Дашборд для Студента -->
    <div v-else class="student-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>📝 Активные задачи</h3>
          <p class="stat-value">{{ stats.activeTasks || 0 }}</p>
        </div>

        <div class="stat-card">
          <h3>✅ Выполнено</h3>
          <p class="stat-value">{{ stats.completedTasks || 0 }}</p>
        </div>

        <div class="stat-card" :class="{ 'deadline-warning': hasUpcomingDeadline }">
          <h3>⏰ Ближайший дедлайн</h3>
          <p v-if="stats.nextDeadline" class="stat-value deadline-text">
            {{ formatDate(stats.nextDeadline) }}
          </p>
          <p v-else class="stat-value">—</p>
          <span>Нет предстоящих дедлайнов</span>
        </div>
      </div>

      <div class="task-status-chart">
        <h3>Статусы задач</h3>
        <div class="status-bars">
          <div class="status-bar not-started">
            <span class="status-label">Не начато</span>
            <span class="status-count">{{ stats.statusCount?.NOT_STARTED || 0 }}</span>
          </div>
          <div class="status-bar in-progress">
            <span class="status-label">В процессе</span>
            <span class="status-count">{{ stats.statusCount?.IN_PROGRESS || 0 }}</span>
          </div>
          <div class="status-bar completed">
            <span class="status-label">Выполнено</span>
            <span class="status-count">{{ stats.statusCount?.COMPLETED || 0 }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Заглушка если данные еще грузятся -->
    <div v-if="loading" class="loading">
      <p>Загрузка статистики...</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import api from "@/api/index.js";

export default {
  name: 'Overview',
  setup() {
    const user = ref({})
    const stats = ref({})
    const loading = ref(true)

    const fetchUser = async () => {
      try {
        const response = await api.getUserInfo()
        user.value = response.data
      } catch (error) {
        console.error('Ошибка загрузки пользователя:', error)
      }
    }

    const fetchStats = async () => {
      try {
        // Здесь будет вызов API для получения статистики
        // Пока используем заглушки
        stats.value = await getMockStatsBasedOnRole(user.value.role)
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error)
      } finally {
        loading.value = false
      }
    }

    // Заглушка для демонстрации (замените на реальный API вызов)
    const getMockStatsBasedOnRole = (role) => {
      const mockStats = {
        'ROLE_ADMIN': {
          totalUsers: 154,
          totalGroups: 12,
          totalTasks: 287,
          activeTasks: 189,
          completedTasks: 98,
          roleStatistics: {
            ROLE_STUDENT: 132,
            ROLE_TEACHER: 18,
            ROLE_ADMIN: 4
          }
        },
        'ROLE_TEACHER': {
          totalStudents: 45,
          totalAssignedTasks: 87,
          completedTasks: 52,
          activeTasks: 35,
          myGroups: [{}, {}, {}] // 3 группы
        },
        'ROLE_STUDENT': {
          activeTasks: 5,
          completedTasks: 12,
          nextDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 дня
          statusCount: {
            NOT_STARTED: 2,
            IN_PROGRESS: 3,
            COMPLETED: 12
          }
        }
      }
      return mockStats[role] || {}
    }

    const calculateProgress = (completed, total) => {
      if (!total || total === 0) return 0
      return Math.round((completed / total) * 100)
    }

    const formatDate = (date) => {
      if (!date) return ''
      return new Date(date).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    const hasUpcomingDeadline = computed(() => {
      return stats.value.nextDeadline &&
          new Date(stats.value.nextDeadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })

    onMounted(async () => {
      await fetchUser()
      await fetchStats()
    })

    return {
      user,
      stats,
      loading,
      calculateProgress,
      formatDate,
      hasUpcomingDeadline
    }
  }
}
</script>

<style scoped>
.overview {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-title {
  color: #000;
  font-size: 28px;
  margin-bottom: 30px;
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  text-align: center;
  color: #000;
  border-left: 4px solid #4a90e2;
}

.stat-card h3 {
  margin: 0 0 15px 0;
  color: #000;
  font-weight: 600;
  font-size: 18px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin: 10px 0;
  color: #000;
}

.stat-details {
  margin-top: 15px;
  font-size: 14px;
  color: #666;
}

.stat-details span {
  display: block;
  margin: 4px 0;
}

/* Progress bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  margin: 15px 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #357abd);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Deadline warning */
.deadline-warning {
  border-left-color: #dc3545;
  background: linear-gradient(135deg, #fff, #fff3cd);
}

.deadline-text {
  color: #dc3545;
  font-weight: bold;
}

/* Task status chart */
.task-status-chart {
  margin-top: 40px;
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.task-status-chart h3 {
  margin: 0 0 20px 0;
  color: #000;
  text-align: center;
}

.status-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
}

.status-bar.not-started {
  background: #fff3cd;
  color: #856404;
}

.status-bar.in-progress {
  background: #d1ecf1;
  color: #0c5460;
}

.status-bar.completed {
  background: #d4edda;
  color: #155724;
}

.status-label {
  font-weight: 600;
}

.status-count {
  font-size: 18px;
  font-weight: bold;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

/* Адаптивность */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 20px;
  }

  .stat-value {
    font-size: 28px;
  }
}
</style>