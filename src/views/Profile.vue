<template>
  <div class="profile-container">
    <div class="sidebar">
      <div class="user-info" v-if="user">
        <h2>{{ user.username }}</h2>
        <p>{{ user.email }}</p>
        <p class="role-badge">{{ getRoleText(user.role) }}</p>
        <button @click="logout" class="logout-btn">Выйти</button>
      </div>
      <div v-else class="user-info">
        <p>Загрузка...</p>
      </div>
      <nav>
        <router-link
            v-for="link in availableLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            active-class="active"
        >
          <span class="nav-link-text">{{ link.title }}</span>
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
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from "@/api/index.js";

export default {
  name: 'Profile',
  setup() {
    const router = useRouter()

    // Правильно инициализируем user с начальными значениями
    const user = ref({
      username: '',
      email: '',
      role: ''
    })

    const availableLinks = ref([])
    const unreadNotificationsCount = ref(0)
    const loading = ref(true)

    const getRoleText = (role) => {
      const roleMap = {
        'ROLE_ADMIN': 'Администратор',
        'ROLE_TEACHER': 'Преподаватель',
        'ROLE_STUDENT': 'Студент'
      }
      return roleMap[role] || role
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
          { path: '/profile/notifications', title: 'Уведомления', name: 'notifications' }
        ],
        'ROLE_STUDENT': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/tasks', title: 'Мои задачи', name: 'tasks' },
          { path: '/profile/calendar', title: 'Календарь', name: 'calendar' },
          { path: '/profile/my-group', title: 'Моя группа', name: 'my-group' },
          { path: '/profile/notifications', title: 'Уведомления', name: 'notifications' }
        ]
      };

      availableLinks.value = linksMap[role] || [];
    };

    onMounted(() => {
      fetchUserData()
    })

    return {
      user,
      availableLinks,
      unreadNotificationsCount,
      loading,
      logout,
      getRoleText,
      fetchUnreadNotificationsCount
    }
  }
}
</script>

<style scoped>
.profile-container {
  display: flex;
  min-height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 250px;
  background: #2c3e50;
  color: white;
  padding: 20px;
}

.user-info {
  margin-bottom: 30px;
  text-align: center;
}

.role-badge {
  display: inline-block;
  padding: 3px 8px;
  background: #4a90e2;
  border-radius: 10px;
  font-size: 12px;
  margin-top: 5px;
}

.logout-btn {
  margin-top: 15px;
  background: #e74c3c;
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
  color: white;
  text-decoration: none;
  padding: 10px 15px;
  margin: 5px 0;
  border-radius: 4px;
  transition: background 0.3s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-link.active {
  background: #4a90e2;
}

.nav-link-text {
  flex: 1;
}

/* Стили для баджика уведомлений */
.notification-badge {
  background: #e74c3c;
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
  background: #f5f7fa;
}
</style>