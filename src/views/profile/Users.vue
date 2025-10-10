<template>
  <div class="users-container">
    <!-- Тосты для уведомлений -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <!-- Модалка подтверждения удаления пользователя -->
    <div v-if="showDeleteConfirm" class="modal">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить пользователя "{{ userToDelete?.username }}"?</p>
        <div class="modal-actions">
          <button @click="confirmDeleteUser" class="delete-btn">Удалить</button>
          <button @click="cancelDeleteUser" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>

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
          <h3>{{ user.username }}</h3>
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
          <button @click="openDeleteConfirm(user)" class="delete-btn">Удалить</button>
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

          <button type="submit" class="submit-btn">Создать</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import api from "@/api/index.js";

export default {
  name: 'Users',
  setup() {
    const users = ref([]);
    const filterRole = ref('all');
    const showCreateModal = ref(false);
    const showDeleteConfirm = ref(false);
    const userToDelete = ref(null);

    // Переменные для уведомлений
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    });

    const showToast = (message, type = 'success') => {
      toast.value = {
        show: true,
        message,
        type
      };

      setTimeout(() => {
        hideToast();
      }, 4000);
    };

    const hideToast = () => {
      toast.value.show = false;
    };

    const newUser = ref({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'STUDENT'
    });

    const fetchUsers = async () => {
      try {
        let response;

        if (filterRole.value !== 'all') {
          response = await api.getUsersByRole(filterRole.value);
        } else {
          response = await api.getUsers();
        }

        users.value = response.data.map(user => ({
          ...user,
          role: user.role.replace('ROLE_', ''),
          newRole: user.role.replace('ROLE_', '')
        }));

      } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        showToast('Ошибка при загрузке пользователей', 'error');
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
        await api.createUser(newUser.value);

        showCreateModal.value = false;
        showToast('Пользователь успешно создан');
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
        showToast('Ошибка при создании пользователя', 'error');
      }
    };

    const updateUserRole = async (user) => {
      try {
        await api.updateUserRole(user.id, user.newRole);
        showToast('Роль пользователя успешно обновлена');
        await fetchUsers();
      } catch (error) {
        console.error('Ошибка при обновлении роли:', error);

        const originalUser = users.value.find(u => u.id === user.id);
        if (originalUser) {
          user.newRole = originalUser.role;
        }

        showToast('Ошибка при обновлении роли', 'error');
      }
    };

    const openDeleteConfirm = (user) => {
      userToDelete.value = user;
      showDeleteConfirm.value = true;
    };

    const confirmDeleteUser = async () => {
      if (!userToDelete.value) return;

      try {
        await api.deleteUser(userToDelete.value.id);
        showToast('Пользователь успешно удален');
        await fetchUsers();
      } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        showToast('Ошибка при удалении пользователя', 'error');
      } finally {
        cancelDeleteUser();
      }
    };

    const cancelDeleteUser = () => {
      showDeleteConfirm.value = false;
      userToDelete.value = null;
    };

    return {
      users,
      filteredUsers,
      filterRole,
      showCreateModal,
      showDeleteConfirm,
      userToDelete,
      newUser,
      getRoleText,
      createUser,
      updateUserRole,
      openDeleteConfirm,
      confirmDeleteUser,
      cancelDeleteUser,
      fetchUsers,
      toast,
      hideToast
    };
  }
};
</script>

<style scoped>
/* Стили для тостов */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 300px;
  max-width: 400px;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

.toast-success {
  background: #28a745;
  border-left: 4px solid #1e7e34;
}

.toast-error {
  background: #dc3545;
  border-left: 4px solid #c82333;
}

.toast-warning {
  background: #ffc107;
  color: #856404;
  border-left: 4px solid #e0a800;
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

/* Стили для модалки подтверждения */
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
  padding: 25px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  text-align: center;
}

.modal-content h3 {
  margin: 0 0 15px 0;
  color: #dc3545;
}

.modal-content p {
  margin: 0 0 20px 0;
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn:hover {
  background-color: #c82333;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background-color: #5a6268;
}

/* Остальные стили без изменений */
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