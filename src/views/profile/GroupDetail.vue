<template>
  <div class="group-detail">
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <!-- Модалка подтверждения удаления студента -->
    <div v-if="showDeleteStudentConfirm" class="modal" @click.self="cancelRemoveStudent">
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
        <div class="button-back">
          <button @click="backToGroups" class="back-btn">← Назад к списку групп</button>
        </div>

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
          <div class="custom-dropdown">
            <div
                class="dropdown-header"
                :class="{ 'dropdown-open': isDropdownOpen, 'has-selection': selectedStudent }"
                @click="toggleDropdown"
            >
          <span v-if="selectedStudent" class="selected-student">
            {{ getSelectedStudentName() }}
          </span>
              <span v-else class="dropdown-placeholder">Выберите студента</span>
              <span class="dropdown-arrow">▼</span>
            </div>

            <div v-if="isDropdownOpen" class="dropdown-content" @click.stop>
              <div v-if="availableStudentsLoading" class="dropdown-loading">
                Загрузка студентов...
              </div>
              <div v-else-if="availableStudentsError" class="dropdown-error">
                Ошибка загрузки: {{ availableStudentsError }}
                <button @click="fetchAvailableStudents" class="retry-btn">Повторить</button>
              </div>
              <div v-else class="students-dropdown-list">
                <div
                    v-for="student in availableStudents"
                    :key="student.id"
                    class="dropdown-student-item"
                    :class="{
                selected: selectedStudent === student.id,
                'in-current-group': isStudentInCurrentGroup(student.id),
                'in-other-group': isStudentInAnyGroup(student.id) && !isStudentInCurrentGroup(student.id)
              }"
                    @click="selectStudent(student)"
                >
                  <div class="student-avatar">
                    {{ getInitials(student.username) }}
                  </div>
                  <div class="student-info">
                    <h4>{{ student.username }}</h4>
                    <p>{{ student.email }}</p>
                    <p v-if="isStudentInCurrentGroup(student.id)" class="status-text status-current">
                      ⚠️ Уже в этой группе
                    </p>
                    <p v-else-if="isStudentInAnyGroup(student.id)" class="status-text status-other">
                      ⚠️ Уже в другой группе
                    </p>
                    <p v-else class="status-text status-available">
                      ✓ Можно добавить
                    </p>
                  </div>
                </div>

                <div v-if="availableStudents.length === 0" class="no-students">
                  Нет доступных студентов
                </div>
              </div>
            </div>
          </div>

          <div class="selected-student-info">
        <span v-if="selectedStudent && isStudentInCurrentGroup(selectedStudent)" class="warning-text">
          ⚠️ Этот студент уже в этой группе
        </span>
            <span v-else-if="selectedStudent && isStudentInAnyGroup(selectedStudent)" class="warning-text">
          ⚠️ Этот студент уже в другой группе
        </span>
            <span v-else-if="selectedStudent" class="success-text">
          ✓ Можно добавить в группу
        </span>
          </div>

          <button
              @click="addStudent"
              class="add-btn"
              :disabled="!selectedStudent || isStudentInAnyGroup(selectedStudent)"
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
import {ref, onMounted, onUnmounted, computed} from 'vue';
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
    const studentsInGroups = ref([]);

    // Новые переменные для управления состоянием загрузки
    const availableStudentsLoading = ref(false);
    const availableStudentsError = ref('');

    const isDropdownOpen = ref(false);
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

    const fetchGroupData = async () => {
      try {
        const groupResponse = await api.getGroupInfo(route.params.groupId);
        group.value = groupResponse.data;

        const studentsResponse = await api.getGroupStudents(route.params.groupId);
        students.value = studentsResponse.data;

        // Загружаем доступных студентов отдельно
        await fetchAvailableStudents();

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




    const toggleDropdown = () => {
      isDropdownOpen.value = !isDropdownOpen.value;
    };

    const selectStudent = (student) => {
      if (!isStudentInAnyGroup(student.id)) {
        selectedStudent.value = student.id;
        isDropdownOpen.value = false;
      }
    };

    const getSelectedStudentName = () => {
      if (!selectedStudent.value) return '';
      const student = availableStudents.value.find(s => s.id === selectedStudent.value);
      return student ? student.username : '';
    };

    const handleClickOutside = (event) => {
      const dropdown = document.querySelector('.custom-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        isDropdownOpen.value = false;
      }
    };

    onMounted(() => {
      fetchGroupData();
      document.addEventListener('click', handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside);
    });

    const getInitials = (username) => {
      if (!username) return '??';
      return username
          .split(' ')
          .map(name => name.charAt(0).toUpperCase())
          .join('')
          .slice(0, 2);
    };

    onMounted(() => {
      fetchGroupData();
      document.addEventListener('click', handleClickOutside);
    });

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

    const isStudentInAnyGroup = (studentId) => {
      return studentsInGroups.value.some(student => student.id === studentId);
    };

    const isStudentInCurrentGroup = (studentId) => {
      return students.value.some(student => student.id === studentId);
    };

    const canAddStudent = (studentId) => {
      return !isStudentInAnyGroup(studentId) && !isStudentInCurrentGroup(studentId);
    };

    const fetchStudentsInGroups = async () => {
      try {
        const response = await api.getStudentsHasGroup();
        studentsInGroups.value = response.data;
      } catch (error) {
        console.error('Ошибка при загрузке студентов в группах:', error);
        showToast('Не удалось загрузить информацию о студентах в группах', 'error');
      }
    };

    // Обновленный метод для загрузки доступных студентов
    const fetchAvailableStudents = async () => {
      if (user.role !== 'ROLE_ADMIN' && user.role !== 'ROLE_TEACHER') return;

      availableStudentsLoading.value = true;
      availableStudentsError.value = '';

      try {
        // Загружаем всех студентов системы
        const availableResponse = await api.getUsersByRole('STUDENT');
        availableStudents.value = availableResponse.data;

        // Параллельно загружаем информацию о том, кто уже в группах
        await fetchStudentsInGroups();
      } catch (error) {
        console.error('Ошибка при загрузке доступных студентов:', error);
        availableStudentsError.value = error.message || 'Неизвестная ошибка';
        showToast('Не удалось загрузить список студентов', 'error');
      } finally {
        availableStudentsLoading.value = false;
      }
    };

    const selectAvailableStudent = (student) => {
      if (canAddStudent(student.id)) {
        selectedStudent.value = student.id;
      }
    };

    const addStudent = async () => {
      if (!selectedStudent.value) {
        showToast('Выберите студента для добавления', 'warning');
        return;
      }

      if (isStudentInAnyGroup(selectedStudent.value)) {
        showToast('Этот студент уже состоит в другой группе', 'warning');
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
      availableStudentsLoading,
      availableStudentsError,
      availableStudents,
      isDropdownOpen,


      // computed свойства
      filteredAvailableStudents,
      isStudentInGroup,
      isSelectedStudentInGroup: computed(() => isStudentInCurrentGroup(selectedStudent.value)),

      // методы
      isStudentInAnyGroup,
      isStudentInCurrentGroup,
      selectAvailableStudent,
      fetchAvailableStudents,
      formatDate,
      getStatusText,
      addStudent,
      openRemoveStudentConfirm,
      confirmRemoveStudent,
      cancelRemoveStudent,
      checkStudentTask,
      backToStudents,
      backToGroups,
      hideToast,
      getInitials,
      toggleDropdown,
      selectStudent,
      getSelectedStudentName,
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

/* НОВЫЕ СТИЛИ ДЛЯ ИНТЕРФЕЙСА ДОБАВЛЕНИЯ СТУДЕНТОВ */
.add-student-section {
  margin-top: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.add-student-title {
  margin: 0 0 20px 0;
  color: #495057;
  font-size: 1.3em;
}

.available-students-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.student-select-item {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.student-select-item:hover {
  border-color: #17A2B8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.student-select-item.selected {
  border-color: #28a745;
  background-color: #f8fff9;
}

.student-select-item.in-group {
  border-color: #ffc107;
  background-color: #fffcf3;
  cursor: not-allowed;
}

.student-select-item.in-group:hover {
  transform: none;
  box-shadow: none;
  border-color: #ffc107;
}

.student-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #17A2B8, #6f42c1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9em;
  flex-shrink: 0;
}

.student-info {
  flex: 1;
}

.student-info h4 {
  margin: 0 0 5px 0;
  color: #495057;
  font-size: 1em;
}

.student-info p {
  margin: 0;
  font-size: 0.85em;
}

.student-info .already-in-group {
  color: #e0a800;
  font-weight: 500;
  margin-top: 5px;
}

.student-info .can-add {
  color: #28a745;
  font-weight: 500;
  margin-top: 5px;
}

.loading-students {
  text-align: center;
  padding: 20px;
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

.no-students {
  text-align: center;
  padding: 30px;
  color: #6c757d;
  font-style: italic;
  grid-column: 1 / -1;
}

.add-student-btn {
  width: 100%;
  padding: 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1em;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.add-student-btn:hover:not(:disabled) {
  background: #218838;
}

.add-student-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* Остальные существующие стили без изменений */
.group-detail {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  overflow: visible;
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

.button-back {
  margin-left: auto;
  display: flex;
  justify-content: right;
  margin-bottom: 20px;
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
.add-student {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
  position: relative;
  overflow: visible;
}

.custom-dropdown {
  position: relative;
  width: 100%;
  overflow: visible;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 50px;
}

.dropdown-header:hover {
  border-color: #17A2B8;
}

.dropdown-header.dropdown-open {
  border-color: #17A2B8;
  box-shadow: 0 2px 8px rgba(23, 162, 184, 0.2);
}

.dropdown-header.has-selection {
  border-color: #28a745;
  background-color: #f8fff9;
}

.dropdown-placeholder {
  color: #999;
}

.selected-student {
  font-weight: 500;
  color: #495057;
}

.dropdown-arrow {
  transition: transform 0.3s ease;
  color: #666;
}

.dropdown-open .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 2px solid #17A2B8;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: min(300px, calc(100vh - 200px));
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1000;
}

.students-dropdown-list {
  padding: 8px 0;
}

.dropdown-student-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-student-item:last-child {
  border-bottom: none;
}

.dropdown-student-item:hover {
  background-color: #f8f9fa;
}

.dropdown-student-item.selected {
  background-color: #e8f5e8;
}

.dropdown-student-item.in-current-group {
  background-color: #fffcf3;
  cursor: not-allowed;
}

.dropdown-student-item.in-other-group {
  background-color: #fff5f5;
  cursor: not-allowed;
}

.dropdown-student-item.in-current-group:hover,
.dropdown-student-item.in-other-group:hover {
  background-color: inherit;
}

.student-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #17A2B8, #6f42c1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8em;
  flex-shrink: 0;
  margin-top: 2px;
}

.student-info {
  flex: 1;
  min-width: 0;
}

.student-info h4 {
  margin: 0 0 4px 0;
  color: #495057;
  font-size: 0.95em;
  font-weight: 500;
}

.student-info p {
  margin: 0;
  font-size: 0.8em;
  color: #666;
}

.status-text {
  font-size: 0.75em !important;
  font-weight: 500;
  margin-top: 4px !important;
}

.status-available {
  color: #28a745;
}

.status-current {
  color: #e0a800;
}

.status-other {
  color: #dc3545;
}

.dropdown-loading,
.dropdown-error,
.no-students {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.dropdown-error {
  color: #dc3545;
  background-color: #f8d7da;
  margin: 8px;
  border-radius: 4px;
  padding: 15px;
}

.retry-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
  font-size: 0.8em;
}

.selected-student-info {
  min-height: 20px;
  padding: 0 5px;
}

.warning-text {
  color: #dc3545;
  font-size: 0.9em;
  font-weight: 500;
}

.success-text {
  color: #28a745;
  font-size: 0.9em;
  font-weight: 500;
}

.add-btn {
  background-color: #28A745;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: 500;
  transition: background-color 0.3s;
  align-self: flex-start;
}

.add-btn:hover:not(:disabled) {
  background-color: #218838;
}

.add-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

/* Адаптивность */
@media (max-width: 768px) {
  .dropdown-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 400px;
    max-height: min(70vh, calc(100vh - 100px));
    border-radius: 8px;
    border: 2px solid #17A2B8;
  }

  .dropdown-student-item {
    padding: 15px;
  }
}
/* Адаптивность */
@media (max-width: 768px) {
  .available-students-list {
    grid-template-columns: 1fr;
  }

  .student-select-item {
    flex-direction: column;
    text-align: center;
  }

  .student-avatar {
    align-self: center;
  }
}
</style>