<template>
  <div class="profile-container">
    <div class="sidebar">
      <div class="user-info">
        <h2>{{ user.username }}</h2>
        <p>{{ user.email }}</p>
        <p class="role-badge">{{ getRoleText(user.role) }}</p>
        <button @click="logout" class="logout-btn">Выйти</button>
      </div>
      <nav>
        <router-link
            v-for="link in availableLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            active-class="active"
        >
          {{ link.title }}
        </router-link>
      </nav>
    </div>

    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import api from "@/api/index.js";

export default {
  name: 'Profile',
  setup() {
    const router = useRouter()
    const user = ref({
      name: '',
      email: '',
      role: ''
    })
    const availableLinks = ref([])

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
        const token = localStorage.getItem('jwt-token')
        const response = await api.getUserInfo()

        user.value = response.data
        localStorage.setItem('user', JSON.stringify(response.data))
        setAvailableLinks(response.data.role)
      } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error)
      }
    }

    const setAvailableLinks = (role) => {
      const linksMap = {
        'ROLE_ADMIN': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/groups', title: 'Управление группами', name: 'groups' },
          { path: '/profile/users', title: 'Управление пользователями', name: 'users' },
          {path: '/profile/notifications', title: 'Уведомления', name: 'notifications'}
        ],
        'ROLE_TEACHER': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/tasks', title: 'Задачи', name: 'tasks' },
          { path: '/profile/groups', title: 'Группы', name: 'groups' },
          {path: '/profile/notifications', title: 'Уведомления', name: 'notifications'}
        ],
        'ROLE_STUDENT': [
          { path: '/profile', title: 'Обзор', name: 'profile-overview' },
          { path: '/profile/tasks', title: 'Мои задачи', name: 'tasks' },
          { path: '/profile/calendar', title: 'Календарь', name: 'calendar' },
          { path: '/profile/my-group', title: 'Моя группа', name: 'my-group' },
          {path: '/profile/notifications', title: 'Уведомления', name: 'notifications'}
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
      logout,
      getRoleText
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
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-link.active {
  background: #4a90e2;
}

.main-content {
  flex: 1;
  padding: 30px 15px;
  background: #f5f7fa;
}
</style>