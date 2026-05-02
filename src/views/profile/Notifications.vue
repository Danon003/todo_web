<template>
  <div class="notification-container">
    <div class="notification-header">
      <h2>Уведомления</h2>
      <div class="header-actions">
        <button
            @click="markAllAsRead"
            class="btn-mark-all"
            :disabled="notificationsPage.content.length === 0 || unreadCount === 0 || !userInfo"
        >
          Отметить все как прочитанные
        </button>
        <button
            @click="refreshNotifications"
            class="btn-refresh"
            :disabled="loading"
        >
          <span class="refresh-icon">↻</span>
        </button>
      </div>
    </div>

    <div v-if="authLoading" class="loading">
      <div class="spinner"></div>
      <p>Загрузка информации пользователя...</p>
    </div>

    <div v-else-if="!userInfo" class="empty-state">
      <div class="empty-icon">🔒</div>
      <h3>Требуется авторизация</h3>
      <p>Пожалуйста, войдите в систему для просмотра уведомлений</p>
      <button @click="fetchUserInfo" class="btn-login">Обновить</button>
    </div>

    <div v-else>
      <div class="connection-status">
        <span v-if="unreadCount > 0">• Непрочитанных: {{ unreadCount }}</span>
        <span v-else>• Все уведомления прочитаны</span>
      </div>

      <div class="notification-filters">
        <div class="filter-group">
          <label>
            <input
                type="checkbox"
                v-model="filters.unreadOnly"
                @change="applyFilters"
            >
            Только непрочитанные
          </label>
        </div>

      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Загрузка уведомлений...</p>
      </div>

      <div v-else-if="filteredNotifications.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Уведомлений нет</h3>
        <p>Здесь будут появляться ваши уведомления</p>
      </div>

      <div v-else class="notifications-list">
        <div
            v-for="notification in filteredNotifications"
            :key="notification.id"
            :class="['notification-item', { unread: !notification.read }]"
            @click="markAsRead(notification)"
        >
          <div class="notification-icon">
            <span v-if="notification.type === 'TASK'">📝</span>
            <span v-else-if="notification.type === 'GROUP'">👥</span>
            <span v-else-if="notification.type === 'TASK_OVERDUE'">🚨</span>
            <span v-else-if="notification.type === 'TEST'">🧪</span>
            <span v-else-if="notification.type === 'REGISTER'">👋</span>
            <span v-else-if="notification.type === 'TASK_DEADLINE_2D'">⏰</span>
            <span v-else-if="notification.type === 'TASK_DEADLINE_1D'">⏰</span>
            <span v-else-if="notification.type === 'TASK_DEADLINE_12H'">⏰</span>
            <span v-else-if="notification.type === 'CHANGE_ROLE'">⚙️</span>
            <span v-else-if="notification.type === 'SYSTEM'">⚙️</span>
            <span v-else-if="notification.type === 'VIDEO_MEETING_CREATED'">📹</span>
            <span v-else-if="notification.type === 'VIDEO_MEETING_REMINDER'">📹</span>
            <span v-else-if="notification.type === 'SOLUTION_UPLOADED'">📎</span>
            <span v-else-if="notification.type === 'New_Comment'">💬</span>
            <span v-else-if="notification.type === 'SOLUTION_GRADED'">⭐</span>
            <span v-else>🔔</span>
          </div>

          <div class="notification-content">
            <h4>{{ notification.title }}</h4>
            <p>{{ notification.message }}</p>
            <div class="notification-meta">
              <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
              <span class="notification-type">{{ getTypeText(notification.type) }}</span>
              <span v-if="isRealTime(notification.createdAt)" class="realtime-badge">LIVE</span>
            </div>
          </div>

          <div class="notification-actions">
            <button
                v-if="!notification.read"
                @click.stop="markAsRead(notification)"
                class="btn-mark-read"
                title="Отметить как прочитанное"
            >
              ✓
            </button>
            <button
                @click.stop="deleteNotification(notification.id)"
                class="btn-delete"
                title="Удалить"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <!-- Пагинация -->
      <div v-if="filteredNotifications.length > 0 && !filters.unreadOnly" class="notification-pagination">
        <div class="pagination-info">
          Страница {{ notificationsPage.number + 1 }} из {{ notificationsPage.totalPages }}
          (всего: {{ notificationsPage.totalElements }} уведомлений)
        </div>

        <div class="pagination-buttons">
          <button
              @click="prevPage"
              :disabled="notificationsPage.first || loading"
              class="pagination-btn"
          >
            ← Назад
          </button>

          <button
              @click="nextPage"
              :disabled="notificationsPage.last || loading"
              class="pagination-btn"
          >
            Вперед →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, inject } from 'vue'
import { useToast } from 'vue-toastification'
import { useRouter } from 'vue-router'
import api from "@/api/index.js";
import notificationWebSocket from '@/notifications-websocket'

export default {
  name: 'Notifications',
  setup() {
    const toast = useToast()
    const router = useRouter()

    // Используем Page объект вместо простого массива
    const notificationsPage = ref({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 15,
      first: true,
      last: true
    })

    const loading = ref(false)
    const authLoading = ref(true)
    const userInfo = ref(null)

    // Пагинационные параметры
    const currentPage = ref(0)
    const pageSize = ref(15)
    const sort = ref('createdAt,desc')

    const filters = ref({
      unreadOnly: false
    })

    // Получаем метод обновления счетчика из родительского компонента
    const updateNotificationCount = inject('updateNotificationCount', null)

    const updateParentCounter = () => {
      if (updateNotificationCount) {
        updateNotificationCount()
      }
    }

    const unreadCount = computed(() => {
      return notificationsPage.value.content.filter(n => !n.read).length
    })

    // Фильтрованные уведомления
    const filteredNotifications = computed(() => {
      if (filters.value.unreadOnly) {
        // Если фильтр "только непрочитанные" - фильтруем локально
        return notificationsPage.value.content.filter(notification => !notification.read)
      }
      // Иначе показываем все уведомления текущей страницы
      return notificationsPage.value.content
    })

    // Получение информации о пользователе
    const fetchUserInfo = async () => {
      try {
        authLoading.value = true
        const response = await api.getUserInfo()
        userInfo.value = response.data

        // После получения userInfo загружаем уведомления и настраиваем WebSocket
        await fetchNotifications()
        setupWebSocket()
      } catch (error) {
        console.error('Ошибка при загрузке информации пользователя:', error)
        toast.error('Ошибка авторизации')
        userInfo.value = null
      } finally {
        authLoading.value = false
      }
    }

    const setupWebSocket = () => {
      if (!userInfo.value || !userInfo.value.id) {
        console.warn('User ID not available for WebSocket connection')
        return
      }

      notificationWebSocket.connect(userInfo.value.id,
          (newNotification) => {
            handleNewNotification(newNotification)
          },
      )
    }

    const handleNewNotification = (newNotification) => {
      if (!newNotification.id) {
        console.warn('Пропущено уведомление без ID:', newNotification)
        return
      }

      // Устанавливаем read по умолчанию
      if (newNotification.read === undefined) {
        newNotification.read = false
      }

      // Исправляем createdAt
      if (Array.isArray(newNotification.createdAt)) {
        const [year, month, day, hour, minute, second, nano] = newNotification.createdAt
        newNotification.createdAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(nano).slice(0, 3)}Z`
      } else if (typeof newNotification.createdAt === 'number') {
        newNotification.createdAt = new Date(newNotification.createdAt * 1000).toISOString()
      }

      // Добавляем новое уведомление в начало списка
      notificationsPage.value.content.unshift(newNotification)

      // Обновляем общее количество
      notificationsPage.value.totalElements += 1

      // Обновляем количество страниц
      notificationsPage.value.totalPages = Math.ceil(notificationsPage.value.totalElements / pageSize.value)

      if (!document.hidden) {
        toast.info(`Новое уведомление: ${newNotification.title}`, {
          timeout: 4000,
          onClick: () => {
            markAsRead(newNotification)
          }
        })
      }

      updateParentCounter()
    }

    const fetchNotifications = async () => {
      if (!userInfo.value) return

      try {
        loading.value = true

        const params = {
          userId: userInfo.value.id,
          page: currentPage.value,
          size: pageSize.value,
          sort: sort.value
        }

        let response
        if (filters.value.unreadOnly) {
          response = await api.getUnreadNotifications(params)
        } else {
          response = await api.getNotification(params)
        }

        // Предполагаем, что API возвращает Page объект
        if (response.data && response.data.content) {
          notificationsPage.value = response.data
        } else {
          // Если API возвращает просто массив, создаем Page вручную
          notificationsPage.value = {
            content: response.data || [],
            totalElements: response.data?.length || 0,
            totalPages: Math.ceil((response.data?.length || 0) / pageSize.value),
            number: currentPage.value,
            size: pageSize.value,
            first: currentPage.value === 0,
            last: currentPage.value >= Math.ceil((response.data?.length || 0) / pageSize.value) - 1
          }
        }

      } catch (error) {
        console.error('Ошибка при загрузке уведомлений:', error)
        toast.error('Ошибка загрузки уведомлений')
      } finally {
        loading.value = false
      }
    }

    // Обновить уведомления (сброс на первую страницу)
    const refreshNotifications = () => {
      currentPage.value = 0
      fetchNotifications()
    }

    // Навигация по страницам
    const nextPage = () => {
      if (!notificationsPage.value.last) {
        currentPage.value++
        fetchNotifications()
      }
    }

    const prevPage = () => {
      if (!notificationsPage.value.first) {
        currentPage.value--
        fetchNotifications()
      }
    }

    const applyFilters = () => {
      currentPage.value = 0
      fetchNotifications()
    }

    const applySorting = () => {
      currentPage.value = 0
      fetchNotifications()
    }

    const markAsRead = async (notification) => {
      if (!userInfo.value) return

      try {
        if (!notification.read) {
          await api.markAsReadNotification(notification.id)
          notification.read = true
          updateParentCounter()
        }
      } catch (error) {
        console.error('Ошибка при отметке уведомления как прочитанного:', error)
        notification.read = true
        updateParentCounter()
        toast.warning('Уведомление отмечено как прочитанное (локально)')
      }
    }

    const markAllAsRead = async () => {
      if (!userInfo.value) return

      try {
        await api.markAllAsReadNotification(userInfo.value.id)
        // Помечаем все уведомления как прочитанные локально
        notificationsPage.value.content.forEach(notification => {
          notification.read = true
        })
        updateParentCounter()
        toast.success('Все уведомления отмечены как прочитанные')
      } catch (error) {
        console.error('Ошибка при отметке всех уведомлений:', error)
        notificationsPage.value.content.forEach(notification => {
          notification.read = true
        })
        updateParentCounter()
        toast.success('Все уведомления отмечены как прочитанные (локально)')
      }
    }

    const deleteNotification = async (id) => {
      try {
        await api.deleteNotification(id)
        // Удаляем уведомление из списка
        notificationsPage.value.content = notificationsPage.value.content.filter(n => n.id !== id)
        notificationsPage.value.totalElements = Math.max(0, notificationsPage.value.totalElements - 1)
        notificationsPage.value.totalPages = Math.ceil(notificationsPage.value.totalElements / pageSize.value)
        toast.success('Уведомление удалено')
      } catch (error) {
        console.error('Ошибка при удалении уведомления:', error)
        notificationsPage.value.content = notificationsPage.value.content.filter(n => n.id !== id)
        notificationsPage.value.totalElements = Math.max(0, notificationsPage.value.totalElements - 1)
        notificationsPage.value.totalPages = Math.ceil(notificationsPage.value.totalElements / pageSize.value)
        toast.success('Уведомление удалено (локально)')
      }
    }

    const formatTime = (dateString) => {
      if (!dateString) return 'недавно'

      const trimmed = typeof dateString === 'string'
          ? dateString.replace(/(\.\d{3})\d+/, '$1')
          : dateString

      const date = new Date(trimmed)
      if (isNaN(date.getTime())) {
        console.warn('Невалидная дата:', dateString)
        return 'недавно'
      }

      const now = new Date()
      const diff = now - date

      if (diff < 60000) return 'только что'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`

      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const isRealTime = (dateString) => {
      if (!dateString) return false
      const date = new Date(dateString)
      const now = new Date()
      return (now - date) < 30000
    }

    const getTypeText = (type) => {
      const typeMap = {
        'SYSTEM': 'Системное',
        'TASK': 'Задача',
        'GROUP': 'Группа',
        'TASK_OVERDUE': 'Дедлайн',
        'TEST': 'Тестовое',
        'REGISTER': 'Регистрация',
        'TASK_DEADLINE_2D': 'Дедлайн',
        'TASK_DEADLINE_1D': 'Дедлайн',
        'TASK_DEADLINE_12H': 'Дедлайн',
        'CHANGE_ROLE': 'Новая роль',
        'TEACHER_REMOVED': 'Наставничество',
        'TEACHER_ASSIGN': 'Наставничество',
        'VIDEO_MEETING_CREATED': 'Видеоконференция',
        'VIDEO_MEETING_REMINDER': 'Видеоконференция',
        'SOLUTION_UPLOADED': 'Новое решение',
        'New_Comment': 'Новый комментарий',
        'SOLUTION_GRADED': 'Оценка решения',
      }
      return typeMap[type] || type
    }

    onMounted(() => {
      fetchUserInfo()
    })

    onUnmounted(() => {
      notificationWebSocket.disconnect()
    })

    return {
      notificationsPage,
      loading,
      authLoading,
      filters,
      filteredNotifications,
      unreadCount,
      userInfo,
      sort,
      fetchUserInfo,
      refreshNotifications,
      nextPage,
      prevPage,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      formatTime,
      isRealTime,
      getTypeText,
      applyFilters,
      applySorting
    }
  }
}
</script>

<style scoped>
/* Стили остаются без изменений из предыдущего варианта */
.notification-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e1e5e9;
}

.notification-header h2 {
  color: var(--text-primary);
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.connection-status {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
}

.connection-status.connected {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.connection-status.connecting {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
}

.connection-status.disconnected {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.connection-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.btn-mark-all, .btn-refresh, .btn-test {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-mark-all {
  background: #4a90e2;
  color: white;
}

.btn-mark-all:hover:not(:disabled) {
  background: #357abd;
}

.btn-mark-all:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-refresh {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #495057;
}

.btn-refresh:hover {
  background: #e9ecef;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-test {
  background: #ffc107;
  color: #212529;
  border: 1px solid #ffc107;
}

.btn-test:hover {
  background: #e0a800;
}

.refresh-icon {
  font-size: 18px;
}

.notification-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-secondary);
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-card);
}

.loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e1e5e9;
  border-top: 4px solid #4a90e2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #495057;
}

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.notification-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.notification-item.unread {
  border-left-color: var(--color-primary);
  background: var(--bg-secondary);
}

.notification-icon {
  font-size: 24px;
  padding-top: 4px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-content h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-weight: 600;
  word-wrap: break-word;
}

.notification-content p {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  line-height: 1.5;
  word-wrap: break-word;
}

.notification-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
  align-items: center;
}

.notification-time {
  font-weight: 500;
}

.notification-type {
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 12px;
}

.realtime-badge {
  background: #dc3545;
  color: white;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: bold;
}

.notification-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.notification-item:hover .notification-actions {
  opacity: 1;
}

.btn-mark-read, .btn-delete {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-mark-read {
  background: #28a745;
  color: white;
}

.btn-mark-read:hover {
  background: #218838;
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
}

.notification-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 24px;
  padding: 16px;
}

.pagination-btn {
  padding: 12px 24px;
  border: 1px solid #4a90e2;
  background: white;
  color: #4a90e2;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #4a90e2;
  color: white;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #ccc;
  color: #ccc;
}

@media (max-width: 768px) {
  .notification-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .notification-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .notification-item {
    flex-direction: column;
    gap: 12px;
  }

  .notification-actions {
    opacity: 1;
    align-self: flex-end;
  }

  .notification-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>