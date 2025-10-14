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
    <!-- Вкладки -->
    <div class="tabs">
      <button
          :class="{ active: activeTab === 'users' }"
          @click="switchTab('users')"
      >
        Пользователи
      </button>
      <button
          :class="{ active: activeTab === 'audit' }"
          @click="switchTab('audit')"
      >
        История изменений ролей
      </button>
    </div>

    <!-- Вкладка: Пользователи -->
    <div v-if="activeTab === 'users'" class="users-tab">
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
              <label>Логин:</label>
              <input v-model="newUser.username" type="text" required>
            </div>
            <div class="form-group">
              <label>Email:</label>
              <input v-model="newUser.email" type="email" required>
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

    <!-- Вкладка: История изменений ролей -->
    <div v-if="activeTab === 'audit'" class="audit-tab">
      <div class="audit-header">
        <h3>История изменений ролей пользователей</h3>
        <div class="audit-controls">
          <select v-model="sortOrder" @change="applySorting" class="sort-select">
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
          </select>
          <button @click="fetchAuditLogs" class="refresh-btn" :disabled="auditLoading">
            {{ auditLoading ? 'Загрузка...' : 'Обновить' }}
          </button>
        </div>
      </div>

      <div v-if="auditLoading" class="loading">Загрузка истории...</div>
      <div v-else-if="auditError" class="error-message">
        Ошибка загрузки: {{ auditError }}
        <button @click="fetchAuditLogs" class="retry-btn">Повторить</button>
      </div>
      <div v-else-if="sortedAuditLogs.length === 0" class="no-data">
        История изменений ролей пуста
      </div>
      <div v-else>
        <!-- Список записей -->
        <div class="audit-list">
          <div
              v-for="log in paginatedAuditLogs"
              :key="log.id"
              class="audit-card"
          >
            <div class="audit-info">
              <div class="user-info">
                <strong>{{ log.user.username }}</strong>
                <span class="user-email">{{ log.user.email }}</span>
              </div>
              <div class="role-changes">
                <span class="old-role">{{ getRoleText(log.oldRole) }}</span>
                <span class="arrow">→</span>
                <span class="new-role">{{ getRoleText(log.newRole) }}</span>
              </div>
              <div class="change-date">
                {{ formatDateTime(log.changedAt) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Пагинация -->
        <div class="pagination">
          <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="pagination-btn"
          >
            ← Назад
          </button>

          <span class="pagination-info">
            Страница {{ currentPage }} из {{ totalPages }}
            (всего записей: {{ sortedAuditLogs.length }})
          </span>

          <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="pagination-btn"
          >
            Вперед →
          </button>
        </div>

        <!-- Селектор количества записей на странице -->
        <div class="page-size-selector">
          <label>Записей на странице:</label>
          <select v-model="pageSize" @change="onPageSizeChange" class="page-size-select">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { ref, computed, onMounted } from 'vue';
import api from "@/api/index.js";

export default {
  name: 'Users',
  setup() {
    const users = ref([]);
    const auditLogs = ref([]);
    const filterRole = ref('all');
    const activeTab = ref('users');
    const showCreateModal = ref(false);
    const showDeleteConfirm = ref(false);
    const userToDelete = ref(null);
    const auditLoading = ref(false);
    const auditError = ref('');

    // Пагинация и сортировка
    const currentPage = ref(1);
    const pageSize = ref(20);
    const sortOrder = ref('newest'); // 'newest' или 'oldest'

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
      username: '',
      email: '',
      password: ''
    });

    // Вычисляемые свойства для пагинации и сортировки
    const sortedAuditLogs = computed(() => {
      const logs = [...auditLogs.value];

      if (sortOrder.value === 'newest') {
        return logs.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
      } else {
        return logs.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
      }
    });

    const totalPages = computed(() => {
      return Math.ceil(sortedAuditLogs.value.length / pageSize.value);
    });

    const paginatedAuditLogs = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value;
      const end = start + pageSize.value;
      return sortedAuditLogs.value.slice(start, end);
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

    const fetchAuditLogs = async () => {
      auditLoading.value = true;
      auditError.value = '';
      currentPage.value = 1; // Сбрасываем на первую страницу при новой загрузке

      try {
        const response = await api.getRoleAuditLog();
        auditLogs.value = response.data;
      } catch (error) {
        console.error('Ошибка при загрузке истории изменений:', error);
        auditError.value = error.response?.data?.message || 'Не удалось загрузить историю';
        showToast('Ошибка при загрузке истории изменений', 'error');
      } finally {
        auditLoading.value = false;
      }
    };

    // Методы пагинации
    const nextPage = () => {
      if (currentPage.value < totalPages.value) {
        currentPage.value++;
      }
    };

    const prevPage = () => {
      if (currentPage.value > 1) {
        currentPage.value--;
      }
    };

    const applySorting = () => {
      currentPage.value = 1; // Сбрасываем на первую страницу при изменении сортировки
    };

    const onPageSizeChange = () => {
      currentPage.value = 1; // Сбрасываем на первую страницу при изменении размера страницы
    };

    const switchTab = (tabName) => {
      activeTab.value = tabName;
      if (tabName === 'audit') {
        fetchAuditLogs();
      }
    };

    onMounted(() => {
      fetchUsers();
      if (activeTab.value === 'audit') {
        fetchAuditLogs();
      }
    });

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
        'ADMIN': 'Администратор',
        'ROLE_STUDENT': 'Студент',
        'ROLE_TEACHER': 'Преподаватель',
        'ROLE_ADMIN': 'Администратор'
      };
      return roleMap[role] || role;
    };

    const formatDateTime = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const createUser = async () => {
      try {
        await api.createUser(newUser.value);

        showCreateModal.value = false;
        showToast('Пользователь успешно создан');
        await fetchUsers();

        newUser.value = {
          username: '',
          email: '',
          password: ''
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
        // После изменения роли обновляем историю
        if (activeTab.value === 'audit') {
          await fetchAuditLogs();
        }
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
      auditLogs,
      filteredUsers,
      filterRole,
      activeTab,
      showCreateModal,
      showDeleteConfirm,
      userToDelete,
      newUser,
      auditLoading,
      auditError,
      // Пагинация и сортировка
      currentPage,
      pageSize,
      sortOrder,
      sortedAuditLogs,
      totalPages,
      paginatedAuditLogs,
      getRoleText,
      formatDateTime,
      createUser,
      updateUserRole,
      openDeleteConfirm,
      confirmDeleteUser,
      cancelDeleteUser,
      fetchUsers,
      fetchAuditLogs,
      nextPage,
      prevPage,
      applySorting,
      onPageSizeChange,
      toast,
      switchTab,
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
.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
}

.tabs button {
  padding: 12px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1em;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tabs button.active {
  border-bottom-color: #17A2B8;
  font-weight: bold;
  color: #17A2B8;
}

.tabs button:hover:not(.active) {
  background-color: #f8f9fa;
}

/* Стили для вкладки аудита */
.audit-tab {
  padding: 20px 0;
}

.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.audit-header h3 {
  margin: 0;
  color: #495057;
}

.refresh-btn {
  background-color: #17A2B8;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #138496;
}

.refresh-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #17A2B8;
}

.audit-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.user-info {
  flex: 1;
}

.user-info strong {
  display: block;
  margin-bottom: 4px;
  color: #495057;
}

.user-email {
  font-size: 0.9em;
  color: #6c757d;
}

.role-changes {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.old-role {
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  color: #6c757d;
  font-size: 0.9em;
}

.arrow {
  color: #17A2B8;
  font-weight: bold;
}

.new-role {
  padding: 4px 8px;
  background-color: #e8f5e8;
  border-radius: 4px;
  color: #155724;
  font-size: 0.9em;
}

.change-date {
  color: #6c757d;
  font-size: 0.85em;
  white-space: nowrap;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-style: italic;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 15px;
  text-align: center;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-style: italic;
}

.retry-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
}

.retry-btn:hover {
  background: #c82333;
}
.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
}

.tabs button {
  padding: 12px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1em;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tabs button.active {
  border-bottom-color: #17A2B8;
  font-weight: bold;
  color: #17A2B8;
}

.tabs button:hover:not(.active) {
  background-color: #f8f9fa;
}

/* Стили для вкладки аудита */
.audit-tab {
  padding: 20px 0;
}

.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.audit-header h3 {
  margin: 0;
  color: #495057;
}

.audit-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.sort-select {
  padding: 8px 12px;
  border: 1px solid #ffffff;
  border-radius: 4px;
  background: #97d0b7;
  font-size: 0.9em;
}

.refresh-btn {
  background-color: #17A2B8;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #138496;
}

.refresh-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.audit-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #17A2B8;
}

.audit-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.user-info {
  flex: 1;
}

.user-info strong {
  display: block;
  margin-bottom: 4px;
  color: #495057;
}

.user-email {
  font-size: 0.9em;
  color: #6c757d;
}

.role-changes {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.old-role {
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  color: #6c757d;
  font-size: 0.9em;
}

.arrow {
  color: #17A2B8;
  font-weight: bold;
}

.new-role {
  padding: 4px 8px;
  background-color: #e8f5e8;
  border-radius: 4px;
  color: #155724;
  font-size: 0.9em;
}

.change-date {
  color: #6c757d;
  font-size: 0.85em;
  white-space: nowrap;
}

/* Пагинация */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  padding: 15px 0;
  border-top: 1px solid #eee;
}

.pagination-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #17A2B8;
  color: white;
  border-color: #17A2B8;
}

.pagination-btn:disabled {
  background-color: #f8f9fa;
  color: #416381;
  cursor: not-allowed;
}

.pagination-info {
  color: #6c757d;
  font-size: 0.9em;
}

/* Селектор количества записей */
.page-size-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.page-size-selector label {
  font-size: 0.9em;
  color: #6c757d;
}

.page-size-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 0.9em;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-style: italic;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 15px;
  text-align: center;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-style: italic;
}

.retry-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
}

.retry-btn:hover {
  background: #c82333;
}

/* Адаптивность */
@media (max-width: 768px) {
  .audit-header {
    flex-direction: column;
    align-items: stretch;
  }

  .audit-controls {
    justify-content: space-between;
  }

  .audit-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .pagination {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .role-changes {
    align-self: stretch;
    justify-content: center;
  }
}
</style>