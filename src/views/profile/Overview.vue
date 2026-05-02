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
          <h3>👨‍🏫 Мои задания</h3>
          <p class="stat-value">{{ stats.myCreatedTasks || 0 }}</p>
          <div class="sub-metric">
            <div class="metric-line">{{ stats.totalTasks || 0 }} всего в системе</div>
          </div>
        </div>

        <div class="stat-card">
          <h3>👥 Студенты</h3>
          <p class="stat-value">{{ stats.totalStudents || 0 }}</p>
          <span>в {{ stats.totalGroups || 0 }} группах</span>
        </div>
        <div class="report-card stat-card">
          <div class="report-header">
            <h3>📊 Генератор отчетов</h3>
            <span class="report-description">Создайте детальный отчет в формате Excel</span>
          </div>
          <button @click="openReportModal" class="generate-report-btn">
            Сгенерировать отчет
          </button>
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

    <div v-if="showReportModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>📊 Генератор отчетов</h3>
          <button @click="closeReportModal" class="close-btn">×</button>
        </div>

        <div class="report-options">
          <div class="option-group">
            <label class="option-label">
              <span class="label-icon">📋</span>
              Тип отчета:
            </label>
            <select v-model="reportOptions.reportType" class="form-select">
              <option value="STUDENT_PROGRESS">📊 Прогресс студентов</option>
              <option value="TASK_STATISTICS">📈 Статистика по задачам</option>
              <option value="GRADES_OVERVIEW">⭐ Обзор оценок</option>
              <option value="COMPREHENSIVE">📑 Комплексный отчет</option>
            </select>
            <p class="option-hint" v-if="reportOptions.reportType === 'STUDENT_PROGRESS'">
              Детальная информация о прогрессе каждого студента по задачам
            </p>
            <p class="option-hint" v-else-if="reportOptions.reportType === 'TASK_STATISTICS'">
              Статистика выполнения задач: количество назначений, статусы, просрочки
            </p>
            <p class="option-hint" v-else-if="reportOptions.reportType === 'GRADES_OVERVIEW'">
              Сводная информация по всем выставленным оценкам
            </p>
            <p class="option-hint" v-else-if="reportOptions.reportType === 'COMPREHENSIVE'">
              Полный отчет, включающий все данные по всем группам
            </p>
          </div>

          <div class="option-group">
            <label class="option-label">
              <span class="label-icon">📅</span>
              Период:
            </label>
            <select v-model="reportOptions.period" class="form-select">
              <option value="LAST_WEEK">За последнюю неделю</option>
              <option value="LAST_MONTH">За последний месяц</option>
              <option value="LAST_QUARTER">За последний квартал</option>
              <option value="ALL_TIME">За все время</option>
            </select>
          </div>

          <div class="option-group" v-if="reportOptions.reportType !== 'COMPREHENSIVE'">
            <label class="option-label">
              <span class="label-icon">👥</span>
              Группа:
            </label>
            <select v-model="reportOptions.groupId" class="form-select">
              <option value="all">Все группы</option>
              <option v-for="group in availableGroups" :key="group.id" :value="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>

          <div class="option-group">
            <label class="option-label">
              <span class="label-icon">📄</span>
              Формат файла:
            </label>
            <div class="format-selector">
              <label class="format-option" :class="{ active: reportOptions.format === 'excel' }">
                <input type="radio" v-model="reportOptions.format" value="excel" />
                <span class="format-icon">📊</span>
                <span class="format-name">Excel (.xlsx)</span>
              </label>
              <label class="format-option" :class="{ active: reportOptions.format === 'doc' }">
                <input type="radio" v-model="reportOptions.format" value="doc" />
                <span class="format-icon">📝</span>
                <span class="format-name">Word (.docx)</span>
              </label>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">
              <span class="label-icon">⚙️</span>
              Включить в отчет:
            </label>
            <div class="checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" v-model="reportOptions.includeGrades" />
                <span class="checkbox-text">
                  <span class="checkbox-icon">⭐</span>
                  Оценки
                </span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="reportOptions.includeComments" />
                <span class="checkbox-text">
                  <span class="checkbox-icon">💬</span>
                  Комментарии преподавателей
                </span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="reportOptions.includeDeadlines" />
                <span class="checkbox-text">
                  <span class="checkbox-icon">⏰</span>
                  Дедлайны
                </span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="reportOptions.includeProgress" />
                <span class="checkbox-text">
                  <span class="checkbox-icon">📈</span>
                  Прогресс выполнения
                </span>
              </label>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="closeReportModal" class="cancel-btn">Отмена</button>
          <button
              @click="generateReport"
              class="generate-btn"
              :disabled="generatingReport"
          >
            <span v-if="generatingReport">⏳ Генерация...</span>
            <span v-else>📥 Скачать отчет</span>
          </button>
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
    const showReportModal = ref(false)
    const generatingReport = ref(false)
    const availableGroups = ref([])

    const reportOptions = ref({
      reportType: 'STUDENT_PROGRESS',
      period: 'LAST_MONTH',
      groupId: 'all',
      includeGrades: true,
      includeComments: true,
      includeDeadlines: true,
      includeProgress: true,
      format: 'excel'
    })

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

    const fetchGroups = async () => {
      try {
        console.log('Загружаем группы для отчета...');
        const response = await api.getGroups();
        console.log('Ответ от сервера (группы):', response);

        // Проверяем структуру ответа
        let groups = [];
        if (response.data && Array.isArray(response.data)) {
          groups = response.data;
        } else if (response.data && response.data.content && Array.isArray(response.data.content)) {
          // Пагинированный ответ
          groups = response.data.content;
        } else if (Array.isArray(response)) {
          groups = response;
        }

        console.log('Обработанные группы:', groups);
        availableGroups.value = groups || [];

        if (groups.length === 0) {
          console.log('Нет доступных групп');
        }
      } catch (error) {
        console.error('Детальная ошибка при загрузке групп:', error);
        console.error('Статус:', error.response?.status);
        console.error('Данные ошибки:', error.response?.data);

        // Показываем пользователю понятную ошибку
        if (error.response?.status === 403) {
          alert('У вас нет прав для просмотра списка групп');
        } else if (error.response?.status === 401) {
          alert('Сессия истекла. Пожалуйста, войдите снова');
        } else {
          alert('Не удалось загрузить список групп. Проверьте консоль для деталей');
        }
      }
    };

    const openReportModal = async () => {
      showReportModal.value = true
      if (availableGroups.value.length === 0) {
        await fetchGroups()
      }
    }

    const closeReportModal = () => {
      showReportModal.value = false
    }

    const generateReport = async () => {
      generatingReport.value = true
      try {
        const response = await api.generateReport(reportOptions.value)

        // Определяем MIME тип в зависимости от формата
        const format = reportOptions.value.format || 'excel'
        const mimeType = format === 'doc'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

        const fileExtension = format === 'doc' ? 'docx' : 'xlsx'

        // Создаем blob и скачиваем файл
        const blob = new Blob([response.data], { type: mimeType })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url

        // Генерируем имя файла
        const timestamp = new Date().toISOString().split('T')[0]
        const reportType = {
          'STUDENT_PROGRESS': 'progress',
          'TASK_STATISTICS': 'tasks',
          'GRADES_OVERVIEW': 'grades',
          'COMPREHENSIVE': 'full'
        }[reportOptions.value.reportType]

        link.download = `report_${reportType}_${timestamp}.${fileExtension}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        closeReportModal()

      } catch (error) {
        console.error('Ошибка генерации отчета:', error)
        alert('Не удалось сгенерировать отчет. Попробуйте позже.')
      } finally {
        generatingReport.value = false
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
      stats,
      loading,
      showReportModal,
      generatingReport,
      availableGroups,
      reportOptions,
      formatNumber,
      openReportModal,
      closeReportModal,
      generateReport,
      formatDate
    }
  }
}
</script>

<style scoped>
.overview {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  color: var(--text-primary);
}

.welcome-title {
  color: var(--text-primary);
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
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  text-align: center;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--color-primary);
}

.stat-card h3 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 18px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin: 10px 0;
  color: var(--color-primary);
}

.stat-details {
  margin-top: 15px;
  font-size: 14px;
  color: var(--text-secondary);
}

.stat-details span {
  display: block;
  margin: 4px 0;
}

/* Progress bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin: 15px 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-dark));
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Deadline warning */
.deadline-warning {
  border-left-color: var(--color-danger);
  background: linear-gradient(135deg, var(--bg-card), var(--task-not-started));
}

.deadline-text {
  color: var(--task-overdue-text);
  font-weight: bold;
}

/* Task status chart */
.task-status-chart {
  margin-top: 40px;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px var(--shadow-sm);
}

.task-status-chart h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
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
  background: var(--task-not-started);
  color: var(--task-not-started-text);
}

.status-bar.in-progress {
  background: var(--task-in-progress);
  color: var(--task-in-progress-text);
}

.status-bar.completed {
  background: var(--task-completed);
  color: var(--task-completed-text);
}

.status-bar.overdue {
  background: var(--task-overdue);
  color: var(--task-overdue-text);
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
  color: var(--text-muted);
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
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-sm);
  border-left: 4px solid var(--color-info);
}

.stat-card.warning {
  border-left-color: #ffa726;
}

.stat-card h3 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: var(--text-primary);
}

.stat-value {
  font-size: 2.5em;
  font-weight: bold;
  margin: 0;
  color: var(--color-primary);
}

.stat-card span {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.sub-metric {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color-light);
}

.sub-metric small {
  color: var(--text-muted);
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
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px var(--shadow-sm);
  border-left: 4px solid var(--color-info);
  text-align: center;
}

.stat-card.warning {
  border-left-color: #ff0000;
}

.stat-card h3 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: var(--text-primary);
}

.stat-value {
  font-size: 2.2em;
  font-weight: bold;
  margin: 0;
  color: var(--color-primary);
}

.stat-card span {
  color: var(--text-secondary);
  font-size: 0.9em;
  display: block;
  margin-top: 5px;
}

.sub-metric {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color-light);
}

.sub-metric small {
  color: #888;
  font-size: 0.8em;
}
.report-section {
  margin-bottom: 30px;
}

.report-card {
  color: var(--text-primary);
  border-left: 4px solid #17a2b8 !important;
}

.report-card h3 {
  color: var(--text-primary);
  margin-bottom: 8px !important;
}

.report-description {
  color: var(--text-primary);
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 15px;
  display: block;
}

.generate-report-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgb(23, 162, 184);
  color: var(--text-primary);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.generate-report-btn:hover {
  background: rgba(23, 162, 184, 0.09);
  border-color: rgb(27, 135, 152);
  transform: translateY(-2px);
}

/* Стили для модального окна */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 0;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e5e9;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #495057;
}

.report-options {
  padding: 24px;
}

.option-group {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.option-group:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 15px;
}

.label-icon {
  font-size: 18px;
}

.option-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
  line-height: 1.4;
}

.form-select {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.2s ease;
  cursor: pointer;
}

.form-select:hover {
  border-color: #cbd5e0;
}

.form-select:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.format-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.format-option:hover {
  border-color: #cbd5e0;
  background: #f8f9fa;
}

.format-option.active {
  border-color: #4a90e2;
  background: #e8f4fd;
}

.format-option input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.format-icon {
  font-size: 20px;
}

.format-name {
  font-weight: 500;
  color: #2c3e50;
}

.checkboxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: normal;
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.2s ease;
}

.checkbox-label:hover {
  background: #f8f9fa;
}

.checkbox-label input[type="checkbox"] {
  margin: 0;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #4a90e2;
}

.checkbox-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2c3e50;
}

.checkbox-icon {
  font-size: 16px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 0 0 16px 16px;
}

.cancel-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.generate-btn {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
}

.generate-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* Адаптивность */
@media (max-width: 768px) {
  .checkboxes {
    grid-template-columns: 1fr;
  }

  .format-selector {
    grid-template-columns: 1fr;
  }

  .modal-content {
    width: 95%;
    margin: 20px;
  }

  .modal-actions {
    flex-direction: column;
  }

  .cancel-btn,
  .generate-btn {
    width: 100%;
  }
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