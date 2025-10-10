<template>
  <div class="tasks-container">
    <!-- Тосты для уведомлений -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <div class="tasks-header">
      <h2>Задачи</h2>
      <button v-if="user.role === 'ROLE_TEACHER'" @click="showCreateModal = true" class="create-btn">
        Создать задачу
      </button>
    </div>

    <div class="filters">
      <select v-model="sortField" class="filter-select">
        <option value="deadline">По дате</option>
        <option value="priority">По приоритету</option>
      </select>
    </div>

    <div class="tasks-list">
      <div v-for="task in filteredTasks" :key="task.id" class="task-card">
        <h3>{{ task.title }}</h3>
        <p>{{ task.description }}</p>
        <div class="task-meta">
          <span class="deadline">До: {{ formatDate(task.deadline) }}</span>
          <span class="priority">Приоритет: {{ getPriorityText(task.priority) }}</span>
          <span
              v-if="user.role === 'ROLE_STUDENT'"
              class="status" :class="'status-' + task.userStatus.toLowerCase()">
            {{ getStatusText(task.userStatus) }}
          </span>
        </div>
        <div class="task-actions">
          <button @click="viewTask(task.id)" class="action-btn view">Просмотр</button>
          <button
              v-if="user.role === 'ROLE_STUDENT' && task.userStatus !== 'OVERDUE'"
              @click="openStatusModal(task)"
              class="action-btn update"
          >
            Обновить статус
          </button>

          <span
              v-else-if="user.role === 'ROLE_STUDENT' && task.userStatus === 'OVERDUE'"
              class="status-locked"
          >
            Статус недоступен
          </span>
          <button
              v-if="user.role === 'ROLE_STUDENT' && task.userStatus !== 'OVERDUE'"
              @click="openShareModal(task)"
              class="action-btn share"
          >
            Поделиться
          </button>

          <span
              v-else-if="user.role === 'ROLE_STUDENT' && task.userStatus === 'OVERDUE'"
              class="status-locked"
          >
            Нельзя поделиться
          </span>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания задачи -->
    <div v-if="showCreateModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showCreateModal = false">&times;</span>
        <h3>Создать новую задачу</h3>
        <form @submit.prevent="createTask">
          <div class="form-group">
            <label>Название:</label>
            <input v-model="newTask.title" type="text" required>
          </div>
          <div class="form-group">
            <label>Описание:</label>
            <textarea v-model="newTask.description" required></textarea>
          </div>
          <div class="form-group">
            <label>Дедлайн:</label>
            <input v-model="newTask.deadline" type="datetime-local" required>
          </div>
          <div class="form-group">
            <label>Приоритет:</label>
            <select v-model="newTask.priority" required>
              <option value="LOW">Низкий</option>
              <option value="MEDIUM">Средний</option>
              <option value="HIGH">Высокий</option>
            </select>
          </div>
          <button type="submit" class="submit-btn">Создать</button>
        </form>
      </div>
    </div>

    <!-- Модальное окно изменения статуса -->
    <div v-if="showStatusModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showStatusModal = false">&times;</span>
        <h3>Изменить статус задачи</h3>
        <form @submit.prevent="updateTaskStatus">
          <div class="form-group">
            <label>Текущий статус:</label>
            <span class="current-status" :class="'status-' + currentTask.userStatus.toLowerCase()">
              {{ getStatusText(currentTask.userStatus) }}
            </span>
          </div>
          <div class="form-group">
            <label>Новый статус:</label>
            <select v-model="selectedStatus" required>
              <option value="NOT_STARTED">Не начата</option>
              <option value="IN_PROGRESS">В процессе</option>
              <option value="COMPLETED">Завершена</option>
            </select>
          </div>
          <button type="submit" class="submit-btn">Обновить</button>
        </form>
      </div>
    </div>

    <div v-if="showShareModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showShareModal = false">&times;</span>
        <h3>Поделиться задачей: {{ taskToShare?.title }}</h3>
        <div v-if="groupMembersLoading || usersWithTaskLoading" class="loading-members">
          <div class="spinner"></div>
          <p>Загрузка списка группы...</p>
        </div>

        <div v-else>
          <div class="members-list">
            <div
                v-for="member in filteredMembers"
                :key="member.id"
                class="member-item"
                :class="{
              selected: selectedMember === member.id,
              'has-task': usersWithSharedTask.some(user => user.id === member.id)
            }"
                @click="selectMember(member)"
            >
              <div class="member-avatar">
                {{ getInitials(member.username) }}
              </div>
              <div class="member-info">
                <h4>{{ member.username }}</h4>
                <p>{{ member.email }}</p>
                <p v-if="usersWithSharedTask.some(user => user.id === member.id)" class="task-assigned">
                  ✓ Задача уже назначена
                </p>
                <p v-else class="task-not-assigned">
                  Можно поделиться
                </p>
              </div>
            </div>

            <div v-if="filteredMembers.length === 0" class="no-members">
              Нет подходящих участников
            </div>
          </div>

          <button
              @click="shareTask"
              class="submit-btn"
              :disabled="!selectedMember || sharingInProgress || isSelectedMemberHasTask"
          >
            <span v-if="sharingInProgress">Отправка...</span>
            <span v-else-if="isSelectedMemberHasTask">Задача уже назначена</span>
            <span v-else>Поделиться</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from "@/api/index.js";

export default {
  name: 'Tasks',
  setup() {
    const router = useRouter();
    const tasks = ref([]);
    const filterStatus = ref('all');
    const sortField = ref('deadline');
    const showCreateModal = ref(false);
    const showStatusModal = ref(false);
    const showShareModal = ref(false);
    const currentTask = ref({});
    const selectedStatus = ref('NOT_STARTED');
    const usersWithSharedTask = ref([]);
    const usersWithTaskLoading = ref(false);

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

    const newTask = ref({
      title: '',
      description: '',
      deadline: '',
      priority: 'MEDIUM'
    });
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Переменные для функционала "Поделиться"
    const groupMembers = ref([]);
    const groupMembersLoading = ref(false);
    const memberSearch = ref('');
    const selectedMember = ref(null);
    const sharingInProgress = ref(false);
    const taskToShare = ref(null);

    const fetchTasks = async () => {
      try {
        if (user.role === 'ROLE_TEACHER') {
          const response = await api.getTasks();
          tasks.value = response.data;
        } else {
          const response = await api.getMyTasks();
          tasks.value = response.data;
        }
      } catch (error) {
        console.error('Ошибка при получении задач:', error);
        showToast('Не удалось загрузить задачи', 'error');
      }
    };

    const fetchUsersWithTask = async (taskId) => {
      usersWithTaskLoading.value = true;
      try {
        const response = await api.getUsersWithTask(taskId);
        usersWithSharedTask.value = response.data;
      } catch (error) {
        console.error('Ошибка при получении пользователей с задачей:', error);
        usersWithSharedTask.value = [];
        showToast('Не удалось загрузить информацию о назначениях', 'error');
      } finally {
        usersWithTaskLoading.value = false;
      }
    };

    const fetchGroupMembers = async () => {
      groupMembersLoading.value = true;
      try {
        const token = localStorage.getItem('jwt-token');

        // 1. Получаем информацию о группе пользователя
        const groupResponse = await api.getGroupData();

        const groupId = groupResponse.data.id;
        if (!groupId) {
          throw new Error('Пользователь не состоит в группе');
        }

        // 2. Получаем участников группы
        const membersResponse = await api.getGroupStudents(groupId);

        // Сохраняем участников группы, исключая текущего пользователя
        groupMembers.value = membersResponse.data.filter(member =>
            member.id !== user.id
        );

      } catch (error) {
        console.error('Ошибка при получении данных группы:', error);
        showToast('Не удалось загрузить список одногруппников', 'error');
        groupMembers.value = [];
      } finally {
        groupMembersLoading.value = false;
      }
    };

    onMounted(() => {
      fetchTasks();
    });

    const filteredTasks = computed(() => {
      let result = [...tasks.value];

      if (filterStatus.value !== 'all') {
        result = result.filter(task => task.userStatus === filterStatus.value);
      }

      result.sort((a, b) => {
        if (sortField.value === 'deadline') {
          return new Date(a.deadline) - new Date(b.deadline);
        } else {
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
      });

      return result;
    });

    const filteredMembers = computed(() => {
      let members = groupMembers.value;

      if (memberSearch.value) {
        const search = memberSearch.value.toLowerCase();
        members = members.filter(member =>
            member.name.toLowerCase().includes(search) ||
            member.email.toLowerCase().includes(search)
        );
      }

      return members;
    });
    const isSelectedMemberHasTask = computed(() => {
      if (!selectedMember.value) return false;
      return usersWithSharedTask.value.some(user => user.id === selectedMember.value);
    });

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    const getStatusText = (status) => {
      const statusMap = {
        'NOT_STARTED': 'Не начата',
        'IN_PROGRESS': 'В процессе',
        'COMPLETED': 'Завершено',
        'OVERDUE': 'Просрочена'
      };
      return statusMap[status] || status;
    };

    const getPriorityText = (priority) => {
      const priorityMap = {
        'LOW': 'Низкий',
        'MEDIUM': 'Средний',
        'HIGH': 'Высокий'
      };
      return priorityMap[priority] || priority;
    };

    const getInitials = (name) => {
      if (!name) return '';
      const parts = name.split(' ');
      return parts.map(part => part[0]).join('').toUpperCase();
    };

    const viewTask = (taskId) => {
      router.push(`/profile/tasks/${taskId}`);
    };

    const openStatusModal = (task) => {
      currentTask.value = task;
      selectedStatus.value = task.userStatus;
      showStatusModal.value = true;
    };

    const openShareModal = async (task) => {
      taskToShare.value = task;
      selectedMember.value = null;
      memberSearch.value = '';

      // Параллельно загружаем одногруппников и пользователей с задачей
      await Promise.all([
        fetchGroupMembers(),
        fetchUsersWithTask(task.id)
      ]);

      showShareModal.value = true;
    };

    const selectMember = (member) => {
      // Запрещаем выбор пользователей, у которых уже есть задача
      const memberHasTask = usersWithSharedTask.value.some(user => user.id === member.id);
      if (!memberHasTask) {
        selectedMember.value = member.id;
      }
    };

    const updateTaskStatus = async () => {
      try {
        await api.updateTaskStatus(currentTask.value.id, selectedStatus.value);

        showStatusModal.value = false;
        showToast('Статус задачи успешно обновлен');
        await fetchTasks();
      } catch (error) {
        console.error('Ошибка при обновлении статуса:', error);
        showToast('Не удалось обновить статус задачи', 'error');
      }
    };

    const shareTask = async () => {
      if (!taskToShare.value || !selectedMember.value) return;

      sharingInProgress.value = true;
      try {
        const response = await api.shareTask(
            taskToShare.value.id, selectedMember.value
        );

        if (response.status === 200) {
          showToast('Задача успешно отправлена!');
          showShareModal.value = false;
        } else {
          throw new Error('Не удалось отправить задачу');
        }
      } catch (error) {
        console.error('Ошибка при отправке задачи:', error);
        let errorMessage = 'Произошла ошибка при отправке задачи';

        if (error.response) {
          if (error.response.status === 403) {
            errorMessage = 'У вас нет прав для выполнения этого действия';
          } else if (error.response.data?.message) {
            errorMessage = error.response.data.message;
          }
        }

        showToast(errorMessage, 'error');
      } finally {
        sharingInProgress.value = false;
      }
    };

    const createTask = async () => {
      try {
        await api.createTask(newTask.value);
        showCreateModal.value = false;
        showToast('Задача успешно создана');
        await fetchTasks();
        newTask.value = {
          title: '',
          description: '',
          deadline: '',
          priority: 'MEDIUM'
        };
      } catch (error) {
        console.error('Ошибка при создании задачи:', error);
        showToast('Не удалось создать задачу', 'error');
      }
    };

    const assignTask = (taskId) => {
      console.log('Назначить задачу', taskId);
    };

    return {
      tasks,
      filteredTasks,
      filterStatus,
      sortField,
      showCreateModal,
      showStatusModal,
      showShareModal,
      currentTask,
      selectedStatus,
      newTask,
      user,
      groupMembers,
      groupMembersLoading,
      memberSearch,
      selectedMember,
      filteredMembers,
      sharingInProgress,
      taskToShare,
      formatDate,
      getStatusText,
      getPriorityText,
      getInitials,
      viewTask,
      openStatusModal,
      openShareModal,
      selectMember,
      updateTaskStatus,
      shareTask,
      createTask,
      assignTask,
      isSelectedMemberHasTask,
      usersWithSharedTask,
      usersWithTaskLoading,
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

/* Остальные стили без изменений */
.tasks-container {
  padding: 20px;
}

.tasks-header {
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
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.filter-select {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.task-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
}

.status {
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.status-not_started {
  background-color: #FFF3CD;
  color: #856404;
}
.status-overdue {
  background-color: #f8d7da;
  color: #721c24;
}
.status-in_progress {
  background-color: #D1ECF1;
  color: #0C5460;
}

.status-completed {
  background-color: #D4EDDA;
  color: #155724;
}

.task-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.view {
  background-color: #018101;
  color: white;
}

.update {
  background-color: #FFC107;
  color: black;
}
.status-locked {
  font-size: 0.8em;
  color: #6c757d;
  background-color: #e9ecef;
  padding: 5px 10px;
  border-radius: 4px;
  margin-top: 5px;
  display: inline-block;
}

.share {
  background-color: #9c27b0;
  color: white;
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
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.current-status {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 4px;
  font-weight: bold;
  margin-left: 10px;
}

.submit-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* Стили для модального окна "Поделиться" */
.loading-members {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.search-box {
  margin-bottom: 15px;
}

.search-box input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
}

.members-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.member-item:hover {
  background-color: #f5f5f5;
}

.member-item.selected {
  background-color: #e3f2fd;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #4CAF50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-info h4 {
  margin: 0 0 3px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-info p {
  margin: 0;
  color: #666;
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-members {
  padding: 20px;
  text-align: center;
  color: #666;
}
.member-item.has-task {
  background-color: #f5f5f5;
  border-color: #ddd;
  cursor: not-allowed;
  opacity: 0.7;
}

.member-item.has-task:hover {
  background-color: #f5f5f5;
  border-color: #ddd;
}

.member-item.has-task.selected {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  box-shadow: none;
  animation: none;
}

.task-assigned {
  color: #28a745;
  font-size: 0.8em;
  font-weight: bold;
  margin: 2px 0 0 0;
}

.task-not-assigned {
  color: #6c757d;
  font-size: 0.8em;
  margin: 2px 0 0 0;
}
</style>