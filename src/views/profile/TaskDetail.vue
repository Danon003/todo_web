<template>
  <div class="task-detail">
    <!-- Тосты для уведомлений -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <!-- Модалка подтверждения удаления задачи -->
    <div v-if="showDeleteConfirm" class="modal">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить задачу "{{ task?.title }}"?</p>
        <div class="modal-actions">
          <button @click="confirmDeleteTask" class="delete-btn">Удалить</button>
          <button @click="cancelDeleteTask" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="task" class="task-content">
      <div class="task-header">
        <h2>{{ task.title }}</h2>
        <span class="priority" :class="'priority-' + task.priority.toLowerCase()">
          {{ getPriorityText(task.priority) }}
        </span>
        <button @click="backToTasks" class="back-btn">← Назад к списку задач</button>
      </div>

      <div class="task-body">
        <p class="description">{{ task.description }}</p>

        <div class="task-info">
          <div class="info-item">
          </div>
          <div class="info-item">
            <span class="label">Дедлайн:</span>
            <span class="value">{{ formatDate(task.deadline) }}</span>
          </div>
        </div>

        <div class="task-actions">
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="assignToOthers"
                  class="action-btn">
            Назначить задачу
          </button>
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="assignToStudent"
                  class="action-btn">
            Назначить задачу
          </button>
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="openDeleteConfirm"
                  class="action-btn delete">
            Удалить
          </button>
        </div>
      </div>
    </div>
    <div v-else class="not-found">
      Задача не найдена
    </div>

    <!-- Модальное окно выбора группы -->
    <div v-if="showGroupModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showGroupModal = false">&times;</span>
        <h3>Назначить задачу группе</h3>

        <div v-if="groupsLoading" class="loading-groups">Загрузка групп...</div>
        <div v-else>
          <div class="group-list">
            <div
                v-for="group in groups"
                :key="group.id"
                class="group-item"
                :class="{
        selected: selectedGroupId === group.id,
        'has-task': groupsWithTask.includes(group.id)
      }"
                @click="selectGroup(group)"
            >
              <div class="group-avatar">
                {{ getInitials(group.name) }}
              </div>
              <div class="group-info">
                <h4>{{ group.name }}</h4>
                <p v-if="groupsWithTask.includes(group.id)" class="task-assigned">
                  ✓ Задача назначена всей группе
                </p>
                <p v-else class="task-not-assigned">
                  Можно назначить
                </p>
                <p class="group-stats">
                  Студентов: {{ getGroupStudentCount(group.id) }} |
                  С задачей: {{ getGroupStudentsWithTaskCount(group.id) }}
                </p>
              </div>
            </div>
          </div>

          <button
              @click="confirmAssignment"
              class="submit-btn"
              :disabled="!selectedGroupId || assignmentLoading"
          >
            <span v-if="assignmentLoading">Назначение...</span>
            <span v-else>Назначить выбранной группе</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно выбора студента -->
    <div v-if="showStudentModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showStudentModal = false">&times;</span>
        <h3>Назначить задачу студенту</h3>

        <div v-if="studentsLoading" class="loading-students">Загрузка студентов...</div>
        <div v-else-if="studentsError" class="error-message">
          Ошибка загрузки: {{ studentsError }}
          <button @click="fetchStudents" class="retry-btn">Повторить</button>
        </div>
        <div v-else>
          <div class="students-list">
            <div
                v-for="student in filteredStudents"
                :key="student.id"
                class="student-item"
                :class="{
                  selected: selectedStudentId === student.id,
                  'has-task': usersWithTask.some(u => u.id === student.id)
                }"
                @click="selectStudent(student)"
            >
              <div class="student-avatar">
                {{ getInitials(student.username) }}
              </div>
              <div class="student-info">
                <h4>{{ student.username }}</h4>
                <p>{{ student.email }}</p>
                <p v-if="usersWithTask.some(u => u.id === student.id)" class="task-assigned">
                  ✓ Задача уже назначена
                </p>
                <p v-else class="task-not-assigned">
                  Можно назначить
                </p>
              </div>
            </div>

            <div v-if="filteredStudents.length === 0" class="no-students">
              Нет подходящих студентов
            </div>
          </div>

          <button
              @click="confirmStudentAssignment"
              class="submit-btn"
              :disabled="!selectedStudentId || studentAssignmentLoading || isSelectedStudentHasTask"
          >
            <span v-if="studentAssignmentLoading">Назначение...</span>
            <span v-else-if="isSelectedStudentHasTask">Задача уже назначена</span>
            <span v-else>Назначить выбранному студенту</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from "@/api/index.js";
import axios from "axios";

export default {
  name: 'TaskDetail',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const task = ref(null);
    const loading = ref(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Переменные для уведомлений
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    });

    // Переменные для подтверждения удаления
    const showDeleteConfirm = ref(false);

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

    const openDeleteConfirm = () => {
      showDeleteConfirm.value = true;
    };

    const confirmDeleteTask = async () => {
      try {
        await api.deleteTask(route.params.taskId);
        showToast('Задача успешно удалена');
        router.push('/profile/tasks');
      } catch (error) {
        console.error('Ошибка при удалении задачи:', error);
        showToast('Не удалось удалить задачу', 'error');
      } finally {
        cancelDeleteTask();
      }
    };

    const cancelDeleteTask = () => {
      showDeleteConfirm.value = false;
    };

    const usersWithTask = ref([]);
    const groupsWithTask = ref([]);
    const usersWithTaskLoading = ref(false);
    const groupStudents = ref({});

    // Переменные для модального окна назначения
    const showGroupModal = ref(false);
    const selectedGroupId = ref(null);
    const groups = ref([]);
    const groupsLoading = ref(false);
    const assignmentLoading = ref(false);

    const fetchUsersWithTask = async () => {
      usersWithTaskLoading.value = true;
      try {
        // Загружаем пользователей с задачей
        const usersResponse = await api.getUsersWithTask(route.params.taskId);
        usersWithTask.value = usersResponse.data;

        // Загружаем все группы преподавателя
        const groupsResponse = await api.getGroups();
        const allGroups = groupsResponse.data;

        groupsWithTask.value = [];
        groupStudents.value = {}; // Очищаем предыдущие данные

        // Для каждой группы загружаем студентов и проверяем задачу
        for (const group of allGroups) {
          try {
            // Загружаем студентов группы
            const groupUsersResponse = await api.getGroupStudents(group.id);
            const groupUsers = groupUsersResponse.data;

            // Сохраняем студентов группы
            groupStudents.value[group.id] = groupUsers;

            // Проверяем, есть ли задача у ВСЕХ пользователей группы
            const allUsersHaveTask = groupUsers.length > 0 && groupUsers.every(groupUser =>
                usersWithTask.value.some(userWithTask => userWithTask.id === groupUser.id)
            );

            if (allUsersHaveTask) {
              groupsWithTask.value.push(group.id);
            }
          } catch (error) {
            console.error(`Ошибка при получении пользователей группы ${group.id}:`, error);
            groupStudents.value[group.id] = []; // Сохраняем пустой массив в случае ошибки
          }
        }
      } catch (error) {
        console.error('Ошибка при получении данных о назначениях:', error);
        showToast('Не удалось загрузить данные о назначениях', 'error');
      } finally {
        usersWithTaskLoading.value = false;
      }
    };

    const fetchTask = async () => {
      try {
        if (user.role === 'ROLE_TEACHER') {
          const response = await api.getTask(route.params.taskId);
          task.value = response.data;
          // Загружаем информацию о пользователях с задачей
          await fetchUsersWithTask();
        } else {
          const response = await api.getMyTask(route.params.taskId);
          task.value = response.data;
        }
      } catch (error) {
        console.error('Ошибка при получении задачи:', error);
        showToast('Не удалось загрузить задачу', 'error');
      } finally {
        loading.value = false;
      }
    };

    const selectGroup = (group) => {
      if (!groupsWithTask.value.includes(group.id)) {
        selectedGroupId.value = group.id;
      }
    };

    const selectStudent = (student) => {
      if (!usersWithTask.value.some(u => u.id === student.id)) {
        selectedStudentId.value = student.id;
      }
    };

    // Computed свойства для проверки выбранных элементов
    const isSelectedGroupHasTask = computed(() => {
      return selectedGroupId.value ? groupsWithTask.value.includes(selectedGroupId.value) : false;
    });

    const isSelectedStudentHasTask = computed(() => {
      return selectedStudentId.value ? usersWithTask.value.some(u => u.id === selectedStudentId.value) : false;
    });
    const getGroupStudentCount = (groupId) => {
      const students = groupStudents.value[groupId];
      return students ? students.length : 0;
    };

// Получить количество студентов в группе с задачей
    const getGroupStudentsWithTaskCount = (groupId) => {
      const students = groupStudents.value[groupId];
      if (!students) return 0;

      return students.filter(student =>
          usersWithTask.value.some(userWithTask => userWithTask.id === student.id)
      ).length;
    };
    // Модифицированные методы открытия модальных окон
    const assignToOthers = () => {
      selectedGroupId.value = null;
      fetchGroups();
      showGroupModal.value = true;
    };

    const assignToStudent = () => {
      selectedStudentId.value = null;
      studentSearch.value = '';
      fetchStudents();
      showStudentModal.value = true;
    };

    const fetchGroups = async () => {
      groupsLoading.value = true;
      try {
        const token = localStorage.getItem('jwt-token');
        const response = await api.getGroups();
        groups.value = response.data;
      } catch (error) {
        console.error('Ошибка при получении групп:', error);
        showToast('Не удалось загрузить список групп', 'error');
      } finally {
        groupsLoading.value = false;
      }
    };

    onMounted(fetchTask);

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    const getStatusText = (status) => {
      const statusMap = {
        'NOT_STARTED': 'Не начата',
        'IN_PROGRESS': 'В процессе',
        'COMPLETED': 'Завершена',
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

    const updateStatus = async () => {
      try {
        const token = localStorage.getItem('jwt-token');
        await api.updateTaskStatus(route.params.taskId, {status: ''});
        await fetchTask();
      } catch (error) {
        console.error('Ошибка при обновлении статуса:', error);
        showToast('Не удалось обновить статус', 'error');
      }
    };

    const confirmAssignment = async () => {
      if (!selectedGroupId.value) {
        showToast('Выберите группу', 'warning');
        return;
      }

      assignmentLoading.value = true;
      try {
        await api.assignTaskToGroup(route.params.taskId, selectedGroupId.value, {})

        showToast('Задача успешно назначена группе');
        showGroupModal.value = false;
        await fetchTask();
      } catch (error) {
        console.error('Ошибка при назначении задачи:', error);
        showToast(`Ошибка: ${error.response?.data?.message || error.message}`, 'error');
      } finally {
        assignmentLoading.value = false;
      }
    };

    const backToTasks = () => {
      router.push('/profile/tasks')
    }

    const showStudentModal = ref(false);
    const students = ref([]);
    const studentsLoading = ref(false);
    const studentsError = ref(null);
    const studentSearch = ref('');
    const selectedStudentId = ref(null);
    const studentAssignmentLoading = ref(false);

    const fetchStudents = async () => {
      studentsLoading.value = true;
      studentsError.value = null;
      try {
        const token = localStorage.getItem('jwt-token');
        const response = await api.getMyUsers()

        // Проверяем структуру ответа
        if (Array.isArray(response.data)) {
          students.value = response.data;
        } else if (response.data?.students) {
          students.value = response.data.students;
        } else {
          throw new Error('Неверный формат данных студентов');
        }
      } catch (error) {
        console.error('Ошибка при получении списка студентов:', error);
        studentsError.value = error.response?.data?.message || error.message;
        showToast('Не удалось загрузить список студентов', 'error');
      } finally {
        studentsLoading.value = false;
      }
    };

    const filteredStudents = computed(() => {
      if (!studentSearch.value) return students.value;

      const search = studentSearch.value.toLowerCase();
      return students.value.filter(student =>
          student.name.toLowerCase().includes(search) ||
          student.email.toLowerCase().includes(search)
      );
    });


    const confirmStudentAssignment = async () => {
      if (!selectedStudentId.value) {
        showToast('Выберите студента', 'warning');
        return;
      }

      studentAssignmentLoading.value = true;
      try {
        await api.assignTaskToUser(route.params.taskId, selectedStudentId.value, {})
        showToast('Задача успешно назначена студенту!');
        showStudentModal.value = false;
        await fetchTask(); // Обновляем данные задачи
      } catch (error) {
        console.error('Ошибка при назначении задачи:', error);
        showToast(`Ошибка: ${error.response?.data?.message || error.message}`, 'error');
      } finally {
        studentAssignmentLoading.value = false;
      }
    };

    const getInitials = (name) => {
      if (!name) return '';
      const parts = name.split(' ');
      return parts.map(part => part[0]).join('').toUpperCase();
    };

    return {
      task,
      loading,
      user,
      showGroupModal,
      selectedGroupId,
      groups,
      groupsLoading,
      assignmentLoading,
      formatDate,
      getStatusText,
      getPriorityText,
      updateStatus,
      assignToOthers,
      confirmAssignment,
      openDeleteConfirm,
      confirmDeleteTask,
      cancelDeleteTask,
      showDeleteConfirm,
      showStudentModal,
      students,
      studentsLoading,
      studentsError,
      studentSearch,
      selectedStudentId,
      filteredStudents,
      studentAssignmentLoading,
      assignToStudent,
      confirmStudentAssignment,
      getInitials,
      backToTasks,
      toast,
      hideToast,

      usersWithTask,
      groupsWithTask,
      isSelectedGroupHasTask,
      isSelectedStudentHasTask,
      selectGroup,
      selectStudent,
      getGroupStudentCount,
      getGroupStudentsWithTaskCount
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
.task-detail {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.loading,
.not-found {
  text-align: center;
  padding: 50px;
  font-size: 1.2em;
}

/* Заголовок задачи */
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

/* Тело задачи */
.description {
  margin-bottom: 20px;
  line-height: 1.6;
}
.back-btn {
  background: #7fb3e0;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}
.task-info {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  margin-bottom: 10px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: bold;
  width: 120px;
}

.value {
  flex: 1;
}

/* Кнопки действий */
.task-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: #17A2B8;
  color: white;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: #138496;
}

.action-btn.delete {
  background-color: #DC3545;
}

.action-btn.delete:hover {
  background-color: #C82333;
}

/* Общие стили статусов и приоритетов */
.status,
.priority {
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
  .status-not_started {
    background-color: #FFF3CD;
    color: #856404;
  }
  .status-overdue {
    background-color: #f8d7da;
    color: #721c24;
  }
}

/* Стили статусов */

.status-in_progress {
  background-color: #D1ECF1;
  color: #0C5460;
}

.status-completed {
  background-color: #D4EDDA;
  color: #155724;
}

/* Стили приоритетов */
.priority-low {
  background-color: #D4EDDA;
  color: #155724;
}

.priority-medium {
  background-color: #FFF3CD;
  color: #856404;
}

.priority-high {
  background-color: #F8D7DA;
  color: #721C24;
}

/* Общие стили модальных окон */
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
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

.modal h3 {
  margin-top: 0;
  color: #333;
  font-size: 1.4rem;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.close {
  float: right;
  font-size: 28px;
  cursor: pointer;
  color: #888;
  transition: color 0.2s;
  line-height: 1;
}

.close:hover {
  color: #333;
}

/* Стили для списков (групп и студентов) */
.group-list,
.students-list {
  max-height: 400px;
  overflow-y: auto;
  margin: 20px 0;
  padding-right: 5px;
}

/* Общие стили элементов списка */
.group-item,
.student-item {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e0e0e0;
  background-color: #fff;
}

.group-item:hover,
.student-item:hover {
  background-color: #f5f5f5;
  border-color: #bdbdbd;
}

.group-item.selected,
.student-item.selected {
  background-color: #e3f2fd;
  border: 1px solid #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
  animation: pulse 0.5s ease;
}

/* Аватарки */
.group-avatar,
.student-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
  flex-shrink: 0;
}

.group-avatar {
  background-color: #9C27B0; /* Фиолетовый для групп */
}

.student-avatar {
  background-color: #4CAF50; /* Зеленый для студентов */
}

/* Информация об элементах */
.group-info,
.student-info {
  flex: 1;
  min-width: 0;
}

.group-info h4,
.student-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-info p,
.student-info p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Поле поиска */
.search-box {
  margin-bottom: 15px;
}

.search-box input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  transition: border-color 0.3s;
}

.search-box input:focus {
  border-color: #2196F3;
  outline: none;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

/* Сообщения об отсутствии данных */
.no-groups,
.no-students {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

/* Кнопка подтверждения */
.submit-btn {
  background-color: #4CAF50;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  width: 100%;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.3s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.submit-btn:hover {
  background-color: #43A047;
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* Индикаторы загрузки */
.loading-groups,
.loading-students {
  text-align: center;
  padding: 20px;
}

/* Кастомный скроллбар */
.group-list::-webkit-scrollbar,
.students-list::-webkit-scrollbar {
  width: 6px;
}

.group-list::-webkit-scrollbar-track,
.students-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.group-list::-webkit-scrollbar-thumb,
.students-list::-webkit-scrollbar-thumb {
  background: #bdbdbd;
  border-radius: 3px;
}

.group-list::-webkit-scrollbar-thumb:hover,
.students-list::-webkit-scrollbar-thumb:hover {
  background: #9e9e9e;
}

/* Анимация pulse */
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(33, 150, 243, 0); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
}
.group-item.has-task,
.student-item.has-task {
  background-color: #f5f5f5;
  border-color: #ddd;
  cursor: not-allowed;
  opacity: 0.7;
}

.group-item.has-task:hover,
.student-item.has-task:hover {
  background-color: #f5f5f5;
  border-color: #ddd;
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

/* Обновляем стили для выбранных элементов с задачей */
.group-item.has-task.selected,
.student-item.has-task.selected {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  box-shadow: none;
  animation: none;
}
</style>