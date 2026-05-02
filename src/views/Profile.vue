<template>
  <div class="profile-container">
    <!-- Тосты для уведомлений -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <div class="sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <div class="sidebar-header">
        <button @click="toggleSidebar" class="toggle-btn" :title="isSidebarCollapsed ? 'Развернуть' : 'Свернуть'">
          <span v-if="!isSidebarCollapsed">◄</span>
          <span v-else>►</span>
        </button>
      </div>
      <div class="user-info" v-if="user">
        <h2 v-if="!isSidebarCollapsed">{{ user.username }}</h2>
        <p v-if="!isSidebarCollapsed">{{ user.email }}</p>
        <p class="role-badge" v-if="!isSidebarCollapsed">{{ getRoleText(user.role) }}</p>
        <button
            v-if="!isSidebarCollapsed"
            @click="openEditModal"
            class="edit-profile-btn"
            title="Редактировать профиль"
        >
          Редактировать
        </button>
        <button
            v-if="!isSidebarCollapsed"
            @click="toggleTheme"
            class="theme-toggle-btn"
            :title="getThemeTitle()"
        >
          {{ getThemeText() }}
        </button>
        <button @click="logout" class="logout-btn" :title="isSidebarCollapsed ? 'Выйти' : ''">
          <span v-if="!isSidebarCollapsed">Выйти</span>
          <span v-else>🔒</span>
        </button>
      </div>
      <div v-else class="user-info">
        <p v-if="!isSidebarCollapsed">Загрузка...</p>
      </div>
      <nav>
        <router-link
            v-for="link in availableLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            :exact="link.path === '/profile'"
            exact-active-class="active"
            :title="isSidebarCollapsed ? link.title : ''"
        >
          <span class="nav-link-text" v-if="!isSidebarCollapsed">{{ link.title }}</span>
          <span v-else class="nav-link-icon">{{ getLinkIcon(link.name) }}</span>
          <!-- БАДЖИК ДЛЯ УВЕДОМЛЕНИЙ -->
          <span
              v-if="link.name === 'notifications' && unreadNotificationsCount > 0"
              class="notification-badge"
          >
            {{ unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount }}
          </span>
        </router-link>
      </nav>
    </div>

    <div class="main-content">
      <router-view />
    </div>

    <!-- Модальное окно редактирования профиля -->
    <div v-if="showEditModal" class="modal" @click.self="closeEditModal">
      <div class="modal-content">
        <span class="close" @click="closeEditModal">&times;</span>
        <h3>Редактировать профиль</h3>
        <form @submit.prevent="saveProfile">
          <div class="form-group">
            <label>Имя пользователя:</label>
            <input
                v-model="editForm.username"
                type="text"
                required
                :disabled="updating"
            >
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input
                v-model="editForm.email"
                type="email"
                required
                :disabled="updating"
            >
          </div>
          <div class="form-group">
            <label>Новый пароль (оставьте пустым, чтобы не менять):</label>
            <input
                v-model="editForm.password"
                type="password"
                placeholder="Введите новый пароль"
                :disabled="updating"
                minlength="4"
            >
            <small class="form-hint">Оставьте поле пустым, если не хотите менять пароль. Минимальная длина: 4 символа</small>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeEditModal" class="cancel-btn" :disabled="updating">
              Отмена
            </button>
            <button type="submit" class="save-btn" :disabled="updating">
              <span v-if="updating">Сохранение...</span>
              <span v-else>Сохранить</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, provide } from 'vue'
import { useRouter } from 'vue-router'
import api from "@/api/index.js";
import {getCurrentTheme, initTheme, Theme, toggleTheme} from "@/utils/theme.js";

export default {
  name: 'Profile',
  setup() {
    const router = useRouter()

    const user = ref({
      username: '',
      email: '',
      role: ''
    })
    const currentTheme = ref(getCurrentTheme())

    const availableLinks = ref([])
    const unreadNotificationsCount = ref(0)
    const loading = ref(true)
    const isSidebarCollapsed = ref(false)
    const showEditModal = ref(false)
    const updating = ref(false)
    const editForm = ref({
      username: '',
      email: '',
      password: ''
    })
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    })

    const getRoleText = (role) => {
      const roleMap = {
        'ROLE_ADMIN': 'Администратор',
        'ROLE_TEACHER': 'Преподаватель',
        'ROLE_STUDENT': 'Студент'
      }
      return roleMap[role] || role
    }

    const toggleSidebar = () => {
      isSidebarCollapsed.value = !isSidebarCollapsed.value
      // Сохраняем состояние в localStorage
      localStorage.setItem('sidebarCollapsed', isSidebarCollapsed.value.toString())
    }

    const getLinkIcon = (linkName) => {
      const iconMap = {
        'profile-overview': '📊',
        'tasks': '📋',
        'groups': '👥',
        'users': '👤',
        'calendar': '📅',
        'my-group': '👥',
        'video-meetings': '📹',
        'notifications': '🔔',
        'kanban': '📌'
      }
      return iconMap[linkName] || '•'
    }

    const logout = () => {
      localStorage.removeItem('jwt-token')
      localStorage.removeItem('user')
      router.push('/login')
    }

    const fetchUserData = async () => {
      try {
        loading.value = true

        // Сначала пробуем получить данные из localStorage
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
          user.value = JSON.parse(savedUser)
          setAvailableLinks(user.value.role)
        }

        // Затем обновляем данные с сервера
        const response = await api.getUserInfo()
        user.value = response.data
        localStorage.setItem('user', JSON.stringify(response.data))
        setAvailableLinks(response.data.role)

        // Загружаем счетчик уведомлений
        await fetchUnreadNotificationsCount()

      } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error)
        // Если ошибка, используем данные из localStorage
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
          user.value = JSON.parse(savedUser)
          setAvailableLinks(user.value.role)
        }
      } finally {
        loading.value = false
      }
    }

    // Метод для получения количества непрочитанных уведомлений
    const fetchUnreadNotificationsCount = async () => {
      try {
        if (!user.value || !user.value.id) return

        const response = await api.getNotification({
          limit: 100,
          userId: user.value.id
        })

        if (response.data && Array.isArray(response.data)) {
          unreadNotificationsCount.value = response.data.filter(notification => !notification.read).length
        }
      } catch (error) {
        console.error('Ошибка при получении количества непрочитанных уведомлений:', error)
        unreadNotificationsCount.value = 0
      }
    }

    const setAvailableLinks = (role) => {
      const linksMap = {
        'ROLE_ADMIN': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/groups', title: 'Управление группами', name: 'groups' },
          { path: '/profile/users', title: 'Управление пользователями', name: 'users' },
          { path: '/profile/notifications', title: 'Уведомления', name: 'notifications' }
        ],
        'ROLE_TEACHER': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/tasks', title: 'Задачи', name: 'tasks' },
          { path: '/profile/groups', title: 'Группы', name: 'groups' },
          { path: '/profile/video-meetings', title: 'Видеовстречи', name: 'video-meetings' },
          { path: '/profile/notifications', title: 'Уведомления', name: 'notifications' },
        ],
        'ROLE_STUDENT': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/kanban', title: 'Канбан-доска', name: 'kanban' },
          { path: '/profile/tasks', title: 'Мои задачи', name: 'tasks' },
          { path: '/profile/calendar', title: 'Календарь', name: 'calendar' },
          { path: '/profile/my-group', title: 'Моя группа', name: 'my-group' },
          { path: '/profile/video-meetings', title: 'Видеовстречи', name: 'video-meetings' },
          { path: '/profile/notifications', title: 'Уведомления', name: 'notifications' },
        ]
      };

      availableLinks.value = linksMap[role] || [];
    };

    // Предоставляем метод обновления счетчика для дочерних компонентов
    provide('updateNotificationCount', fetchUnreadNotificationsCount)

    const openEditModal = () => {
      if (user.value) {
        editForm.value = {
          username: user.value.username || '',
          email: user.value.email || '',
          password: ''
        }
        showEditModal.value = true
      }
    }

    const closeEditModal = () => {
      showEditModal.value = false
      editForm.value = {
        username: '',
        email: '',
        password: ''
      }
    }

    const saveProfile = async () => {
      if (!user.value) return

      // Валидация пароля, если он указан
      if (editForm.value.password && editForm.value.password.trim() !== '') {
        if (editForm.value.password.length < 4) {
          showToast('Пароль должен содержать минимум 4 символа', 'error')
          return
        }
      }

      updating.value = true
      try {
        const profileData = {
          username: editForm.value.username,
          email: editForm.value.email
        }

        // Добавляем пароль только если он указан
        if (editForm.value.password && editForm.value.password.trim() !== '') {
          profileData.password = editForm.value.password
        }

        await api.updateUserProfile(profileData)

        // Обновляем данные пользователя
        user.value.username = editForm.value.username
        user.value.email = editForm.value.email
        localStorage.setItem('user', JSON.stringify(user.value))

        showToast('Профиль успешно обновлен', 'success')
        closeEditModal()
      } catch (error) {
        console.error('Ошибка при обновлении профиля:', error)
        const errorMessage = error.response?.data?.message || 'Не удалось обновить профиль'
        showToast(errorMessage, 'error')
      } finally {
        updating.value = false
      }
    }

    const showToast = (message, type = 'success') => {
      toast.value = {
        show: true,
        message,
        type
      }
      setTimeout(() => {
        hideToast()
      }, 4000)
    }

    const hideToast = () => {
      toast.value.show = false
    }
    const handleToggleTheme = () => {
      const newTheme = toggleTheme()
      currentTheme.value = newTheme
      // Можно добавить уведомление
      showToast(`Тема изменена: ${getThemeText()}`, 'info')
    }

    const getThemeText = () => {
      const texts = {
        [Theme.LIGHT]: 'Светлая тема',
        [Theme.DARK]: 'Тёмная тема',
        [Theme.AUTO]: 'Авто тема'
      }
      return texts[currentTheme.value] || texts[Theme.LIGHT]
    }

    const getThemeIcon = () => {
      const icons = {
        [Theme.LIGHT]: '🌞',
        [Theme.DARK]: '🌙',
        [Theme.AUTO]: '🔄'
      }
      return icons[currentTheme.value] || icons[Theme.LIGHT]
    }

    const getThemeTitle = () => {
      const titles = {
        [Theme.LIGHT]: 'Светлая тема. Следующая: тёмная',
        [Theme.DARK]: 'Тёмная тема. Следующая: авто',
        [Theme.AUTO]: 'Авто тема. Следующая: светлая'
      }
      return titles[currentTheme.value] || titles[Theme.LIGHT]
    }

    // Предоставляем тему дочерним компонентам
    provide('currentTheme', currentTheme)


    onMounted(() => {
      // Восстанавливаем состояние панели из localStorage
      const savedState = localStorage.getItem('sidebarCollapsed')
      if (savedState !== null) {
        isSidebarCollapsed.value = savedState === 'true'
      }
      fetchUserData()
      initTheme()
    })

    return {
      user,
      availableLinks,
      unreadNotificationsCount,
      loading,
      logout,
      getRoleText,
      fetchUnreadNotificationsCount,
      isSidebarCollapsed,
      toggleSidebar,
      getLinkIcon,
      showEditModal,
      editForm,
      updating,
      openEditModal,
      closeEditModal,
      saveProfile,
      toast,
      hideToast,
      currentTheme,
      toggleTheme: handleToggleTheme,
      getThemeText,
      getThemeIcon,
      getThemeTitle
    }
  }
}
</script>

<style scoped>
.profile-container {
  display: flex;
  min-height: 100vh;
  width: 100vw;
  background: var(--bg-primary);
}

.sidebar {
  width: 250px;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  padding: 20px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 70px;
  padding: 20px 10px;
}

.sidebar-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: flex-end;
}

.toggle-btn {
  background: var(--sidebar-hover);
  border: none;
  color: var(--sidebar-text);
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.3s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.user-info {
  margin-bottom: 30px;
  text-align: center;
  transition: opacity 0.3s;
}

.sidebar.collapsed .user-info h2,
.sidebar.collapsed .user-info p:not(.role-badge) {
  display: none;
}

.role-badge {
  display: inline-block;
  padding: 3px 8px;
  background: var(--color-primary);
  color: white;
  border-radius: 10px;
  font-size: 12px;
  margin-top: 5px;
}

.logout-btn {
  margin-top: 15px;
  background: var(--color-danger);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

nav {
  display: flex;
  flex-direction: column;
}

.nav-link {
  color: var(--sidebar-text);
  text-decoration: none;
  padding: 10px 15px;
  margin: 5px 0;
  border-radius: 4px;
  transition: all 0.3s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}

.sidebar.collapsed .nav-link {
  padding: 10px;
  justify-content: center;
}

.nav-link-icon {
  font-size: 20px;
}

.nav-link:hover {
  background: var(--sidebar-hover);
}

.nav-link.active {
  background: var(--sidebar-active);
}

.nav-link-text {
  flex: 1;
}

/* Стили для баджика уведомлений */
.notification-badge {
  background: var(--color-danger);
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: bold;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 5px rgba(231, 76, 60, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
  }
}

.main-content {
  flex: 1;
  padding: 30px 15px;
  background: var(--bg-primary);
  overflow-y: auto;
}

/* Стили для кнопки редактирования профиля */
.edit-profile-btn {
  margin-top: 10px;
  background: var(--color-info);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  font-size: 0.9em;
  transition: background 0.3s;
}

.edit-profile-btn:hover {
  background: var(--color-info);
  opacity: 0.9;
}

/* Стили для модального окна */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  padding: 30px;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  position: relative;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 1.5em;
  font-weight: 600;
  text-align: center;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.close {
  position: absolute;
  top: 15px;
  right: 20px;
  font-size: 28px;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s;
  line-height: 1;
  background: none;
  border: none;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close:hover {
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px 15px;
  background: var(--input-bg);
  border: 2px solid var(--border-color);
  color: var(--input-text);
  border-radius: 8px;
  font-size: 1em;
  transition: border-color 0.3s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-info);
  box-shadow: 0 0 0 3px rgba(23, 162, 184, 0.1);
}

.form-group input:disabled {
  background-color: var(--bg-tertiary);
  cursor: not-allowed;
}

.form-hint {
  display: block;
  margin-top: 5px;
  font-size: 0.85em;
  color: var(--text-muted);
  font-style: italic;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 25px;
}

.cancel-btn {
  background-color: var(--color-secondary);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.cancel-btn:hover:not(:disabled) {
  background-color: #5a6268;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-btn {
  background-color: var(--color-info);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.save-btn:hover:not(:disabled) {
  background-color: #138ca1;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Стили для тостов */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 300px;
  max-width: 400px;
  z-index: 2000;
  animation: slideIn 0.3s ease-out;
}

.toast-success {
  background: var(--color-success);
  border-left: 4px solid #1e7e34;
}

.toast-error {
  background: var(--color-danger);
  border-left: 4px solid #c82333;
}

.toast-info {
  background: var(--color-info);
  border-left: 4px solid #138496;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.5em;
  cursor: pointer;
  margin-left: 15px;
  opacity: 0.8;
}

.toast-close:hover {
  opacity: 1;
}

.theme-toggle-btn {
  margin-top: 10px;
  background: var(--color-warning);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  font-size: 0.9em;
  transition: background 0.3s;
}

.theme-toggle-btn:hover {
  opacity: 0.9;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>