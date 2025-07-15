<template>
  <div class="users-container">
    <div class="users-header">
      <h2>Управление пользователями</h2>
      <button @click="showCreateModal = true" class="create-btn">
        Создать пользователя
      </button>
    </div>

    <div class="filters">
      <select v-model="filterRole" class="filter-select" @change="fetchUsers">
        <option value="all">Все пользователи</option>
        <option value="STUDENT">Студенты</option>
        <option value="TEACHER">Преподаватели</option>
        <option value="ADMIN">Администраторы</option>
      </select>
    </div>

    <div class="users-list">
      <div v-for="user in filteredUsers" :key="user.id" class="user-card">
        <div class="user-info">
          <h3>{{ user.name }}</h3>
          <p>{{ user.email }}</p>
          <span class="role-badge" :class="user.role.toLowerCase()">
            {{ getRoleText(user.role) }}
          </span>
        </div>
        <div class="user-actions">
          <select v-model="user.newRole" @change="updateUserRole(user)" class="role-select">
            <option value="STUDENT">Студент</option>
            <option value="TEACHER">Преподаватель</option>
            <option value="ADMIN">Администратор</option>
          </select>
          <button @click="deleteUser(user.id)" class="delete-btn">Удалить</button>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания пользователя -->
    <div v-if="showCreateModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showCreateModal = false">&times;</span>
        <h3>Создать нового пользователя</h3>
        <form @submit.prevent="createUser">
          <div class="form-group">
            <label>Имя:</label>
            <input v-model="newUser.name" type="text" required>
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input v-model="newUser.email" type="email" required>
          </div>
          <div class="form-group">
            <label>Логин:</label>
            <input v-model="newUser.username" type="text" required>
          </div>
          <div class="form-group">
            <label>Пароль:</label>
            <input v-model="newUser.password" type="password" required>
          </div>
          <div class="form-group">
            <label>Роль:</label>
            <select v-model="newUser.role" required>
              <option value="STUDENT">Студент</option>
              <option value="TEACHER">Преподаватель</option>
              <option value="ADMIN">Администратор</option>
            </select>
          </div>
          <button type="submit" class="submit-btn">Создать</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

export default {
  name: 'Users',
  setup() {
    const users = ref([]);
    const filterRole = ref('all');
    const showCreateModal = ref(false);
    const newUser = ref({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'STUDENT'
    });

    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('jwt-token');
        let url = 'http://localhost:8080/admin/users';

        if (filterRole.value !== 'all') {
          url = `http://localhost:8080/admin/users/by-role?role=${filterRole.value}`;
        }

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        users.value = response.data.map(user => ({
          ...user,
          role: user.role.replace('ROLE_', ''),
          newRole: user.role.replace('ROLE_', '')
        }));

      } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        alert('Ошибка при загрузке пользователей: ' + (error.response?.data?.message || error.message));
      }
    };

    onMounted(fetchUsers);

    const filteredUsers = computed(() => {
      if (filterRole.value === 'all') {
        return users.value;
      }
      return users.value.filter(user => user.role === filterRole.value);
    });

    const getRoleText = (role) => {
      const roleMap = {
        'STUDENT': 'Студент',
        'TEACHER': 'Преподаватель',
        'ADMIN': 'Администратор'
      };
      return roleMap[role] || role;
    };

    const createUser = async () => {
      try {
        const token = localStorage.getItem('jwt-token');
        await axios.post('http://localhost:8080/admin/users', newUser.value, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        showCreateModal.value = false;
        await fetchUsers();
        newUser.value = {
          name: '',
          email: '',
          username: '',
          password: '',
          role: 'STUDENT'
        };
      } catch (error) {
        console.error('Ошибка при создании пользователя:', error);
        alert('Ошибка при создании пользователя: ' + (error.response?.data?.message || error.message));
      }
    };

    const updateUserRole = async (user) => {
      try {
        const token = localStorage.getItem('jwt-token');
        await axios.post(`http://localhost:8080/admin/users/${user.id}/role?role=${user.newRole}`, {
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        await fetchUsers();
      } catch (error) {
        console.error('Ошибка при обновлении роли:', error);
        const originalUser = users.value.find(u => u.id === user.id);
        if (originalUser) {
          user.newRole = originalUser.role;
        }
        alert('Ошибка при обновлении роли: ' + (error.response?.data?.message || error.message));
      }
    };

    const deleteUser = async (userId) => {
      if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

      try {
        const token = localStorage.getItem('jwt-token');
        await axios.delete(`http://localhost:8080/admin/users/${userId}/delete`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        await fetchUsers();
      } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        alert('Ошибка при удалении пользователя: ' + (error.response?.data?.message || error.message));
      }
    };

    return {
      users,
      filteredUsers,
      filterRole,
      showCreateModal,
      newUser,
      getRoleText,
      createUser,
      updateUserRole,
      deleteUser,
      fetchUsers
    };
  }
};
</script>

<style scoped>
.users-container {
  padding: 20px;
}

.users-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.create-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.filters {
  margin-bottom: 20px;
}

.filter-select {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  width: 200px;
}

.users-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.user-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
}

.user-info {
  flex: 1;
}

.user-info h3 {
  margin: 0 0 5px 0;
}

.user-info p {
  margin: 0 0 5px 0;
  color: #666;
}

.role-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: bold;
}

.role-student {
  background-color: #D4EDDA;
  color: #155724;
}

.role-teacher {
  background-color: #D1ECF1;
  color: #0C5460;
}

.role-admin {
  background-color: #F8D7DA;
  color: #721C24;
}

.user-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.role-select {
  padding: 5px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.delete-btn {
  background-color: #DC3545;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

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
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 500px;
  max-width: 90%;
}

.close {
  float: right;
  font-size: 24px;
  cursor: pointer;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.submit-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>