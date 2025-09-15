<template>
  <div class="notification-container">
    <div class="notification-header">
      <h2>Уведомления</h2>
      <div class="header-actions">
        <button
            @click="markAllAsRead"
            class="btn-mark-all"
            :disabled="notifications.length === 0"
        >
          Отметить все как прочитанные
        </button>
        <button
            @click="fetchNotifications"
            class="btn-refresh"
        >
          <span class="refresh-icon">↻</span>
        </button>
      </div>
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
          <span v-else-if="notification.type === 'DEADLINE'">⏰</span>
          <span v-else>🔔</span>
        </div>

        <div class="notification-content">
          <h4>{{ notification.title }}</h4>
          <p>{{ notification.message }}</p>
          <div class="notification-meta">
            <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
            <span class="notification-type">{{ getTypeText(notification.type) }}</span>
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

    <div v-if="filteredNotifications.length > 0" class="notification-pagination">
      <button
          :disabled="currentPage === 1"
          @click="prevPage"
          class="pagination-btn"
      >
        Назад
      </button>
      <span>Страница {{ currentPage }}</span>
      <button
          :disabled="filteredNotifications.length < pageSize"
          @click="nextPage"
          class="pagination-btn"
      >
        Вперед
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useToast } from 'vue-toastification'
import api from "@/api/index.js";

export default {
  name: 'Notifications',
  setup() {
    const toast = useToast()
    const notifications = ref([])
    const loading = ref(true)
    const currentPage = ref(1)
    const pageSize = ref(20)

    const filters = ref({
      unreadOnly: false,
      type: 'all'
    })

    const fetchNotifications = async () => {
      try {
        loading.value = true
        const token = localStorage.getItem('jwt-token')
        const response = await api.getNotification({
          params: {
            page: currentPage.value - 1,
            size: pageSize.value
          }
        })

        notifications.value = response.data.content || response.data
      } catch (error) {
        console.error('Ошибка при загрузке уведомлений:', error)
        toast.error('Не удалось загрузить уведомления')

        // Заглушка для демонстрации
        notifications.value = [
          {
            id: 1,
            title: 'Добро пожаловать!',
            message: 'Вы успешно вошли в систему. Начните работу с вашими задачами.',
            type: 'SYSTEM',
            read: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 2,
            title: 'Новая задача',
            message: 'Вам назначена новая задача: "Лабораторная работа по Vue.js"',
            type: 'TASK',
            read: false,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          }
        ]
      } finally {
        loading.value = false
      }
    }

    const markAsRead = async (notification) => {
      try {
        const token = localStorage.getItem('jwt-token')
        await api.markAsReadNotification(notification.id)

        notification.read = true
        toast.success('Уведомление отмечено как прочитанное')
      } catch (error) {
        console.error('Ошибка при отметке уведомления:', error)
        notification.read = true // Локально меняем для UX
      }
    }

    const markAllAsRead = async () => {
      try {
        const token = localStorage.getItem('jwt-token')
        await api.markAllAsReadNotification()

        notifications.value.forEach(n => n.read = true)
        toast.success('Все уведомления отмечены как прочитанные')
      } catch (error) {
        console.error('Ошибка при отметке всех уведомлений:', error)
        notifications.value.forEach(n => n.read = true)
      }
    }

    const deleteNotification = async (id) => {
      try {
        const token = localStorage.getItem('jwt-token')
        await api.deleteNotification(id)

        notifications.value = notifications.value.filter(n => n.id !== id)
        toast.success('Уведомление удалено')
      } catch (error) {
        console.error('Ошибка при удалении уведомления:', error)
        toast.error('Не удалось удалить уведомление')
      }
    }

    const formatTime = (dateString) => {
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date

      if (diff < 60000) return 'только что'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`

      return date.toLocaleDateString('ru-RU')
    }

    const getTypeText = (type) => {
      const typeMap = {
        'SYSTEM': 'Системное',
        'TASK': 'Задача',
        'GROUP': 'Группа',
        'DEADLINE': 'Дедлайн'
      }
      return typeMap[type] || type
    }

    const filteredNotifications = computed(() => {
      return notifications.value.filter(notification => {
        const matchesUnread = !filters.value.unreadOnly || !notification.read
        const matchesType = filters.value.type === 'all' || notification.type === filters.value.type
        return matchesUnread && matchesType
      })
    })

    const applyFilters = () => {
      currentPage.value = 1
    }

    const nextPage = () => {
      currentPage.value++
      fetchNotifications()
    }

    const prevPage = () => {
      if (currentPage.value > 1) {
        currentPage.value--
        fetchNotifications()
      }
    }

    onMounted(() => {
      fetchNotifications()
    })

    return {
      notifications,
      loading,
      filters,
      filteredNotifications,
      currentPage,
      pageSize,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      formatTime,
      getTypeText,
      applyFilters,
      nextPage,
      prevPage
    }
  }
}
</script>

<style scoped>
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
  gap: 16px;
  margin-top: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.pagination-btn {
  padding: 8px 16px;
  border: 1px solid #ced4da;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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