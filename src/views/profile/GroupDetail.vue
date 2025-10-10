<template>
  <div class="group-detail">
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <!-- Модалка подтверждения удаления студента -->
    <div v-if="showDeleteStudentConfirm" class="modal">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить студента "{{ studentToDelete?.username }}" из группы?</p>
        <div class="modal-actions">
          <button @click="confirmRemoveStudent" class="delete-btn">Удалить</button>
          <button @click="cancelRemoveStudent" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="group" class="group-content">
      <div class="group-header">
        <h2>{{ group.name }}</h2>
        <p class="description">{{ group.description }}</p>
      </div>

      <!-- Вкладки -->
      <div class="tabs">
        <button :class="{ active: activeTab === 'students' }" @click="activeTab = 'students'">
          Студенты
        </button>
      </div>

      <!-- Вкладка: Студенты -->
      <div v-if="activeTab === 'students'" class="students-tab">
      <div class="button-back">  <button @click="backToGroups" class="back-btn">← Назад к списку групп</button></div>

        <div class="students-list">
          <div v-for="student in students" :key="student.id" class="student-card">
            <div class="student-info">
              <h4>{{ student.username }}</h4>
              <p>{{ student.email }}</p>
            </div>

            <button
                v-if="user.role === 'ROLE_TEACHER'"
                @click="checkStudentTask(student.id)"
                class="check-btn"
            >
              Назначенные задачи
            </button>
            <button
                v-if="user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER'"
                @click="openRemoveStudentConfirm(student)"
                class="remove-btn"
            >
              Удалить
            </button>
          </div>
        </div>

        <div v-if="user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER'" class="add-student">
          <div class="student-select-container">
            <select
                v-model="selectedStudent"
                class="student-select"
                :class="{ 'already-in-group': isSelectedStudentInGroup }"
            >
              <option value="" disabled>Выберите студента</option>
              <option
                  v-for="student in filteredAvailableStudents"
                  :key="student.id"
                  :value="student.id"
                  :disabled="isStudentInGroup(student.id)"
                  :class="{ 'disabled-option': isStudentInGroup(student.id) }"
              >
                {{ student.username }}
                <span v-if="isStudentInGroup(student.id)" class="already-in-group-text">
                (уже в группе)
              </span>
              </option>
            </select>

            <div class="student-select-info">
            <span v-if="isSelectedStudentInGroup" class="warning-text">
              ⚠️ Этот студент уже в группе
            </span>
              <span v-else-if="selectedStudent" class="success-text">
              ✓ Можно добавить
            </span>
            </div>
          </div>

          <button
              @click="addStudent"
              class="add-btn"
              :disabled="!selectedStudent || isSelectedStudentInGroup"
          >
            Добавить
          </button>
        </div>
      </div>

      <!-- Вкладка: Задачи студента -->
      <div v-else-if="activeTab === 'student-tasks'">
        <div class="student-header">
          <h3>Задачи студента: {{ currentStudent?.username }}</h3>
          <button @click="backToStudents" class="back-btn">← Назад к списку студентов</button>
        </div>

        <div v-if="loadingTasks" class="loading">Загрузка задач...</div>
        <div v-else-if="studentTasks.length === 0" class="no-tasks">
          У студента пока нет назначенных задач.
        </div>
        <div v-else class="tasks-list">
          <div v-for="task in studentTasks" :key="task.id" class="task-card">
            <h4>{{ task.title }}</h4>
            <p class="description" v-if="task.description">{{ task.description }}</p>
            <p class="deadline">Дедлайн: {{ formatDate(task.deadline) }}</p>
            <span
                class="status"
                :class="{
                  'status-not_started': task.userStatus === 'NOT_STARTED',
                  'status-in_progress': task.userStatus === 'IN_PROGRESS',
                  'status-completed': task.userStatus === 'COMPLETED',
                  'status-overdue': task.userStatus === 'OVERDUE'
                }"
            >
              {{ getStatusText(task.userStatus) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="not-found">
      Группа не найдена
    </div>
  </div>
</template>

<script>
import {ref, onMounted, computed} from 'vue';
import { useRoute } from 'vue-router';
import api from "@/api/index.js";
import router from "@/router/index.js";

export default {
  name: 'GroupDetail',
  setup() {
    const route = useRoute();
    const group = ref(null);
    const students = ref([]);
    const availableStudents = ref([]);
    const selectedStudent = ref('');
    const activeTab = ref('students');
    const loading = ref(true);
    const user = JSON.parse(localStorage.getItem('user') || {});

    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    });

    // Переменные для подтверждения удаления
    const showDeleteStudentConfirm = ref(false);
    const studentToDelete = ref(null);

    const currentStudent = ref(null);
    const studentTasks = ref([]);
    const loadingTasks = ref(false);

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
    const filteredAvailableStudents = computed(() => {
      return availableStudents.value.filter(student =>
          !students.value.some(groupStudent => groupStudent.id === student.id)
      );
    });

    const isStudentInGroup = (studentId) => {
      return students.value.some(student => student.id === studentId);
    };

    const isSelectedStudentInGroup = computed(() => {
      if (!selectedStudent.value) return false;
      return isStudentInGroup(selectedStudent.value);
    });
    // Методы для подтверждения удаления студента
    const openRemoveStudentConfirm = (student) => {
      studentToDelete.value = student;
      showDeleteStudentConfirm.value = true;
    };

    const confirmRemoveStudent = async () => {
      if (!studentToDelete.value) return;

      try {
        await api.removeStudentFromGroup(route.params.groupId, studentToDelete.value.id);
        await fetchGroupData();
        showToast('Студент успешно удален из группы');
      } catch (error) {
        console.error('Ошибка при удалении студента:', error);
        showToast('Не удалось удалить студента', 'error');
      } finally {
        cancelRemoveStudent();
      }
    };

    const cancelRemoveStudent = () => {
      showDeleteStudentConfirm.value = false;
      studentToDelete.value = null;
    };

    // --- Получение данных группы ---
    const fetchGroupData = async () => {
      try {
        const groupResponse = await api.getGroupInfo(route.params.groupId);
        group.value = groupResponse.data;

        const studentsResponse = await api.getGroupStudents(route.params.groupId);
        students.value = studentsResponse.data;

        if (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER') {
          const availableResponse = await api.getUsersByRole('STUDENT');
          availableStudents.value = availableResponse.data;
        }

        try {
          const tasksResponse = await api.getGroupTasks(route.params.groupId);
        } catch (error) {
          console.log('Не удалось получить задачи группы:', error);
        }
      } catch (error) {
        console.error('Ошибка при получении данных группы:', error);
        showToast('Не удалось загрузить данные группы', 'error');
      } finally {
        loading.value = false;
      }
    };

    onMounted(fetchGroupData);

    const checkStudentTask = async (studentId) => {
      loadingTasks.value = true;
      try {
        // Находим студента по ID
        const student = students.value.find(s => s.id === studentId);
        currentStudent.value = student;

        // Загружаем его задачи
        const response = await api.getStudentTasks(studentId);
        studentTasks.value = response.data;

        // Переключаемся на вкладку с задачами
        activeTab.value = 'student-tasks';
      } catch (error) {
        console.error('Ошибка при загрузке задач студента:', error);
        showToast('Не удалось загрузить задачи студента', 'error');
      } finally {
        loadingTasks.value = false;
      }
    };
    const backToStudents = () => {
      activeTab.value = 'students';
      currentStudent.value = null;
      studentTasks.value = [];
    };

    const backToGroups = () => {
      router.push('/profile/groups');
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString();
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

    const addStudent = async () => {
      if (!selectedStudent.value) {
        showToast('Выберите студента для добавления', 'warning');
        return;
      }

      try {
        await api.addStudentToGroup(route.params.groupId, selectedStudent.value);
        await fetchGroupData();
        selectedStudent.value = '';
        showToast('Студент успешно добавлен в группу');
      } catch (error) {
        console.error('Ошибка при добавлении студента:', error);
        showToast('Не удалось добавить студента', 'error');
      }
    };

    return {
      group,
      students,
      availableStudents,
      selectedStudent,
      activeTab,
      loading,
      user,
      currentStudent,
      studentTasks,
      loadingTasks,
      toast,
      showDeleteStudentConfirm,
      studentToDelete,

      // computed свойства
      filteredAvailableStudents,
      isSelectedStudentInGroup,
      isStudentInGroup,

      // методы
      formatDate,
      getStatusText,
      addStudent,
      openRemoveStudentConfirm,
      confirmRemoveStudent,
      cancelRemoveStudent,
      checkStudentTask,
      backToStudents,
      backToGroups,
      hideToast
    };
  }
};
</script>

<style scoped>
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
.group-detail {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.loading, .not-found {
  text-align: center;
  padding: 50px;
  font-size: 1.2em;
}

.group-header {
  margin-bottom: 20px;
}

.description {
  color: #666;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 20px;
}
.tabs button {
  display: block;
  padding: 10px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1em;
  border-bottom: 3px solid transparent;
}

.tabs button.active {
  border-bottom-color: #17A2B8;
  font-weight: bold;
}

.students-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.student-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  justify-content: space-between;
  align-items: center;
}

.student-info h4 {
  margin: 0 0 5px 0;
}

.student-info p {
  margin: 0;
  color: #666;
  font-size: 0.9em;
}

.remove-btn {
  background-color: #DC3545;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.check-btn {
  background-color: #bb8213;
  color: white;
  padding: 5px 10px;
  margin-right: 5px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-student {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.button-back{
  margin-left: auto;
  display: flex;
  justify-content: right;
  margin-bottom: 20px;
}
.student-select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-btn {
  background-color: #28A745;
  color: white;
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.task-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.task-card h4 {
  margin: 0 0 10px 0;
}

.deadline {
  color: #666;
  font-size: 0.9em;
  margin: 5px 0;
}

.status {
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
  display: inline-block;
  margin: 5px 0;
}

.status-pending {
  background-color: #FFF3CD;
  color: #856404;
}

.status-in_progress {
  background-color: #D1ECF1;
  color: #0C5460;
}

.status-completed {
  background-color: #D4EDDA;
  color: #155724;
}

.assign-btn {
  background-color: #17A2B8;
  color: white;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.student-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #ffffff;
  padding-bottom: 10px;
}

.back-btn {
  background: #7fb3e0;
  color: white;
  display: flex;
  align-items: center;
  justify-content: right;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.no-tasks {
  text-align: center;
  color: #666;
  padding: 20px;
  font-style: italic;
}
.status {
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
  display: inline-block;
  font-size: 0.85em;
}

.status-not_started,
.status-NOT_STARTED {
  background-color: #FFF3CD;
  color: #856404;
}

.status-in_progress,
.status-IN_PROGRESS {
  background-color: #D1ECF1;
  color: #0C5460;
}

.status-completed,
.status-COMPLETED {
  background-color: #D4EDDA;
  color: #155724;
}

.status-overdue,
.status-OVERDUE {
  background-color: #f8d7da;
  color: #721c24;
}

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
.student-select-container {
  flex: 1;
  position: relative;
}

.student-select {
  width: 100%;
  padding: 10px 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  background-color: white;
  transition: border-color 0.3s, background-color 0.3s;
}

.student-select:focus {
  border-color: #4CAF50;
  outline: none;
}

.student-select.already-in-group {
  border-color: #ff9800;
  background-color: #fff3e0;
}

.disabled-option {
  background-color: #f5f5f5;
  color: #999;
  font-style: italic;
}

.already-in-group-text {
  color: #ff9800;
  font-size: 0.9em;
  font-style: italic;
}

.student-select-info {
  margin-top: 5px;
  min-height: 20px;
}

.warning-text {
  color: #ff9800;
  font-size: 0.9em;
  font-weight: 500;
}

.success-text {
  color: #4CAF50;
  font-size: 0.9em;
  font-weight: 500;
}

.add-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.add-btn:disabled:hover {
  background-color: #cccccc;
}

/* Улучшенные стили для контейнера добавления студента */
.add-student {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  align-items: flex-start;
}

/* Адаптивность */
@media (max-width: 768px) {
  .add-student {
    flex-direction: column;
  }

  .student-select-container {
    width: 100%;
  }
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