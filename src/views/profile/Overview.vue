<template>
  <div class="overview">
    <h2 class="welcome-title">Добро пожаловать, {{ user.username }}</h2>

    <!-- Дашборд для Администратора -->
    <div v-if="user.role === 'ROLE_ADMIN'" class="admin-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>👥 Пользователи</h3>
          <p class="stat-value">{{ stats.totalUsers }}</p>
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
        </div>
      </div>
    </div>

    <!-- Дашборд для Преподавателя -->
    <div v-else-if="user.role === 'ROLE_TEACHER'" class="teacher-dashboard">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>📈 Средний прогресс</h3>
          <p class="stat-value">{{ formatNumber(stats.avgStudentProgress) }}%</p>
          <span>задач выполнено в среднем</span>
        </div>

        <div class="stat-card">
          <h3>📊 Нагрузка</h3>
          <p class="stat-value">{{ formatNumber(stats.avgTasksPerStudent) }}</p>
          <span>задач на студента</span>
          <div class="sub-metric">
            <small>от {{ stats.minTasks || 0 }} до {{ stats.maxTasks || 0 }}</small>
          </div>
        </div>

        <div class="stat-card warning">
          <h3>⏰ Просрочки</h3>
          <p class="stat-value">{{ stats.totalOverdueTasks || 0 }}</p>
          <span>просроченных задач</span>
        </div>

        <div class="stat-card">
          <h3>🐢 Стагнация</h3>
          <p class="stat-value">{{ stats.stuckTasks || 0 }}</p>
          <span>задач не менялись >2 недель</span>
        </div>

        <div class="stat-card">
          <h3>👨‍🏫 Мои задания</h3>
          <p class="stat-value">{{ stats.myCreatedTasks || 0 }}</p>
          <div class="sub-metric">
            <div class="metric-line">{{ stats.totalTasks || 0 }} всего в системе</div>
          </div>
        </div>

        <!-- Добавляем 6-ю метрику для баланса -->
        <div class="stat-card">
          <h3>👥 Студенты</h3>
          <p class="stat-value">{{ stats.totalStudents || 0 }}</p>
          <span>в {{ stats.totalGroups || 0 }} группах</span>
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
          <div v-if="stats.nextDeadline" class="stat-value deadline-text">
            {{ formatDate(stats.nextDeadline) }}
          </div>
          <div v-else class="stat-value">
            <p>—</p>
            <span>Нет предстоящих дедлайнов</span>
          </div>
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
          <div class="status-bar overdue">
            <span class="status-label">Просрочено</span>
            <span class="status-count">{{ stats.statusCount?.OVERDUE || 0 }}</span>
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
        const responseStats = await api.getStats();
        stats.value = responseStats.data
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error)
      } finally {
        loading.value = false
      }
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
    const formatNumber = (number, decimals = 1) => {
      if (number === null || number === undefined) return '0'
      return Number(number).toFixed(decimals)
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
      formatNumber,
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

.status-bar.overdue {
  background: #f5a2a2;
  color: #8d0a0a;
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
.teacher-dashboard {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #42a5f5;
}

.stat-card.warning {
  border-left-color: #ffa726;
}

.stat-card h3 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: #333;
}

.stat-value {
  font-size: 2.5em;
  font-weight: bold;
  margin: 0;
  color: #1976d2;
}

.stat-card span {
  color: #666;
  font-size: 0.9em;
}

.sub-metric {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.sub-metric small {
  color: #888;
  font-size: 0.8em;
}

.teacher-dashboard {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #42a5f5;
  text-align: center;
}

.stat-card.warning {
  border-left-color: #ffa726;
}

.stat-card h3 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: #333;
}

.stat-value {
  font-size: 2.2em;  /* Немного уменьшил для баланса */
  font-weight: bold;
  margin: 0;
  color: #1976d2;
}

.stat-card span {
  color: #666;
  font-size: 0.9em;
  display: block;
  margin-top: 5px;
}

.sub-metric {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.sub-metric small {
  color: #888;
  font-size: 0.8em;
}

/* Адаптивность */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 15px;
  }

  .stat-value {
    font-size: 2em;
  }
}
</style>