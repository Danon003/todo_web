<template>
  <div class="notification-container">
    <div class="notification-header">
      <h2>Уведомления</h2>
      <div class="header-actions">
        <button
            @click="markAllAsRead"
            class="btn-mark-all"
            :disabled="notifications.length === 0 || unreadCount === 0 || !userInfo"
        >
          Отметить все как прочитанные
        </button>
        <button
            @click="fetchNotifications"
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
      <div class="connection-status" >
        <span v-if="unreadCount > 0">• Непрочитанных: {{ unreadCount }}</span>
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

        <div class="filter-group">
          <select v-model="filters.type" @change="applyFilters" class="filter-select">
            <option value="all">Все типы</option>
            <option value="SYSTEM">Системные</option>
            <option value="TASK">Задачи</option>
            <option value="GROUP">Группы</option>
            <option value="DEADLINE">Дедлайны</option>
            <option value="TEST">Тестовые</option>
            <option value="REGISTER">Регистрация</option>

          </select>
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

      <div v-if="filteredNotifications.length > 0 && !filters.unreadOnly" class="notification-pagination">
        <button
            @click="loadMore"
            class="pagination-btn"
            :disabled="loadingMore || !hasMoreNotifications"
        >
          {{ loadingMore ? 'Загрузка...' : 'Загрузить еще' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useRouter } from 'vue-router'
import api from "@/api/index.js";
import notificationWebSocket from '@/notifications-websocket'

export default {
  name: 'Notifications',
  setup() {
    const toast = useToast()
    const router = useRouter()
    const notifications = ref([])
    const loading = ref(false)
    const authLoading = ref(true)
    const loadingMore = ref(false)
    const hasMoreNotifications = ref(true)
    const currentLimit = ref(50)
    const userInfo = ref(null)

    const filters = ref({
      unreadOnly: false,
      type: 'all'
    })


    const unreadCount = computed(() => {
      return notifications.value.filter(n => !n.read).length
    })

    const filteredNotifications = computed(() => {
      return notifications.value.filter(notification => {
        const matchesUnread = !filters.value.unreadOnly || !notification.read
        const matchesType = filters.value.type === 'all' || notification.type === filters.value.type
        return matchesUnread && matchesType
      })
    })

    // Получение информации о пользователе
    const fetchUserInfo = async () => {
      try {
        authLoading.value = true
        const response = await api.getUserInfo()
        userInfo.value = response.data
        console.log('User info loaded:', userInfo.value)

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
      // ❗ Пропускаем уведомления без ID
      if (!newNotification.id) {
        console.warn('Пропущено уведомление без ID:', newNotification);
        return;
      }

      // ❗ Устанавливаем read по умолчанию
      if (newNotification.read === undefined) {
        newNotification.read = false;
      }

      // ❗ Исправляем createdAt, если это массив или число
      if (Array.isArray(newNotification.createdAt)) {
        // Если массив — формируем строку вручную
        const [year, month, day, hour, minute, second, nano] = newNotification.createdAt;
        newNotification.createdAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(nano).slice(0, 3)}Z`;
      } else if (typeof newNotification.createdAt === 'number') {
        newNotification.createdAt = new Date(newNotification.createdAt * 1000).toISOString();
      }

      const existingIndex = notifications.value.findIndex(n => n.id === newNotification.id);

      if (existingIndex === -1) {
        notifications.value.unshift(newNotification);

        if (!document.hidden) {
          toast.info(`Новое уведомление: ${newNotification.title}`, {
            timeout: 4000,
            onClick: () => {
              markAsRead(newNotification)
            }
          })
        }
      } else {
        notifications.value[existingIndex] = newNotification;
      }
    }

    const fetchNotifications = async () => {
      if (!userInfo.value) return

      try {
        loading.value = true
        const response = await api.getNotification({
          limit: currentLimit.value,
          userId: userInfo.value.id
        })
        notifications.value = response.data || []
        hasMoreNotifications.value = (response.data || []).length === currentLimit.value
      } catch (error) {
        console.error('Ошибка при загрузке уведомлений:', error)
        toast.error('Ошибка загрузки уведомлений')
        notifications.value = getDemoNotifications()
      } finally {
        loading.value = false
      }
    }

    const loadMore = async () => {
      if (!userInfo.value) return

      try {
        loadingMore.value = true
        const newLimit = currentLimit.value + 30
        const response = await api.getNotification({
          limit: newLimit,
          userId: userInfo.value.id
        })

        if (response.data && response.data.length > notifications.value.length) {
          notifications.value = response.data
          currentLimit.value = newLimit
          hasMoreNotifications.value = response.data.length === newLimit
        } else {
          hasMoreNotifications.value = false
        }
      } catch (error) {
        console.error('Ошибка при загрузке дополнительных уведомлений:', error)
        toast.error('Ошибка загрузки уведомлений')
      } finally {
        loadingMore.value = false
      }
    }

    const markAsRead = async (notification) => {
      if (!userInfo.value) return

      try {
        if (!notification.read) {
          await api.markAsReadNotification(notification.id)
          notification.read = true
        }
      } catch (error) {
        console.error('Ошибка при отметке уведомления как прочитанного:', error)
        notification.read = true
        toast.warning('Уведомление отмечено как прочитанное (локально)')
      }
    }

    const markAllAsRead = async () => {
      if (!userInfo.value) return

      try {
        await api.markAllAsReadNotification(userInfo.value.id)
        notifications.value.forEach(notification => {
          notification.read = true
        })
        toast.success('Все уведомления отмечены как прочитанные')
      } catch (error) {
        console.error('Ошибка при отметке всех уведомлений:', error)
        notifications.value.forEach(notification => {
          notification.read = true
        })
        toast.success('Все уведомления отмечены как прочитанные (локально)')
      }
    }

    const deleteNotification = async (id) => {
      try {
        await api.deleteNotification(id)
        notifications.value = notifications.value.filter(n => n.id !== id)
        toast.success('Уведомление удалено')
      } catch (error) {
        console.error('Ошибка при удалении уведомления:', error)
        notifications.value = notifications.value.filter(n => n.id !== id)
        toast.success('Уведомление удалено (локально)')
      }
    }


    const formatTime = (dateString) => {
      if (!dateString) return 'недавно';

      // Обрезаем наносекунды до миллисекунд
      const trimmed = typeof dateString === 'string'
          ? dateString.replace(/(\.\d{3})\d+/, '$1')
          : dateString;

      const date = new Date(trimmed);
      if (isNaN(date.getTime())) {
        console.warn('Невалидная дата:', dateString);
        return 'недавно';
      }

      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return 'только что';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;

      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
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
        'CHANGE_ROLE': 'Дедлайн',
        'TEACHER_REMOVED': 'Наставничество',
        'TEACHER_ASSIGN': 'Наставничество',
      }
      return typeMap[type] || type
    }
    const applyFilters = () => {
      // Фильтрация происходит автоматически через computed
    }

    onMounted(() => {
      fetchUserInfo()
    })

    onUnmounted(() => {
      notificationWebSocket.disconnect()
    })

    return {
      notifications,
      loading,
      authLoading,
      loadingMore,
      filters,
      filteredNotifications,
      unreadCount,
      hasMoreNotifications,
      userInfo,
      fetchUserInfo,
      fetchNotifications,
      loadMore,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      formatTime,
      isRealTime,
      getTypeText,
      applyFilters
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
  color: #2c3e50;
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
  background: #f8f9fa;
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
  color: #495057;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
}

.loading {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
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
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.notification-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.notification-item.unread {
  border-left-color: #4a90e2;
  background: #f8fbff;
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
  color: #2c3e50;
  font-weight: 600;
  word-wrap: break-word;
}

.notification-content p {
  margin: 0 0 12px 0;
  color: #495057;
  line-height: 1.5;
  word-wrap: break-word;
}

.notification-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6c757d;
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