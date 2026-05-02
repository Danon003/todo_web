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

            <div class="student-actions">
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
        const student = students.value.find(s => s.id === studentId);
        currentStudent.value = student;

        const response = await api.getStudentTasks(studentId);
        console.log('Raw response:', response.data);

        // Извлекаем массив задач из пагинированного ответа
        let tasks = [];
        if (response.data && response.data.content && Array.isArray(response.data.content)) {
          tasks = response.data.content;
        } else if (Array.isArray(response.data)) {
          tasks = response.data;
        }

        console.log('Tasks array:', tasks);

        // Трансформируем задачи
        studentTasks.value = tasks.map(task => {
          // Пробуем найти статус в разных местах
          let userStatus = 'NOT_STARTED';

          // Вариант 1: статус прямо в задаче
          if (task.status) {
            userStatus = task.status;
          }
          // Вариант 2: статус в taskAssignment
          else if (task.taskAssignment?.status) {
            userStatus = task.taskAssignment.status;
          }
          // Вариант 3: статус в assignments
          else if (task.assignments && task.assignments.length > 0) {
            // Если есть назначения, берем статус первого (так как задачи уже для конкретного студента)
            userStatus = task.assignments[0]?.status || 'NOT_STARTED';
          }
          // Вариант 4: статус в userStatus
          else if (task.userStatus) {
            userStatus = task.userStatus;
          }

          console.log(`Task ${task.id} status:`, userStatus);

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            deadline: task.deadline,
            userStatus: userStatus,
            rawTask: task // для отладки
          };
        });

        console.log('Processed tasks:', studentTasks.value);
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
        const availableResponse = await api.getUsersByRole('STUDENT', 0, 1000); // Загружаем всех студентов
        const data = availableResponse.data;

        // Обрабатываем пагинированный ответ
        if (data && Array.isArray(data.content)) {
          availableStudents.value = data.content;
        } else if (Array.isArray(data)) {
          availableStudents.value = data;
        } else {
          availableStudents.value = [];
        }

        // Параллельно загружаем информацию о том, кто уже в группах
        await fetchStudentsInGroups();
      } catch (error) {
        console.error('Ошибка при загрузке доступных студентов:', error);
        availableStudentsError.value = error.message || 'Неизвестная ошибка';
        showToast('Не удалось загрузить список студентов', 'error');
        availableStudents.value = [];
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
.group-detail {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

.loading, .not-found {
  text-align: center;
  padding: 50px;
  font-size: 1.2em;
  color: var(--text-primary);
  background: var(--bg-card);
  border-radius: var(--border-radius);
  margin: 20px 0;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--bg-tertiary);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.not-found {
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
  border: 1px solid var(--color-warning);
}

.group-content {
  background: var(--bg-card);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  /* Разрешаем выпадающему списку студентов выходить за пределы карточки */
  overflow: visible;
  box-shadow: var(--shadow-md);
}

.group-header {
  padding: 25px;
  background: linear-gradient(135deg, var(--color-primary-light), var(--color-info-light));
  border-bottom: 1px solid var(--border-color);
}

.group-header h2 {
  margin: 0 0 10px 0;
  color: var(--text-primary);
  font-size: 1.8em;
  font-weight: 600;
}

.group-header .description {
  color: var(--text-secondary);
  font-size: 1.1em;
  margin: 0;
  line-height: 1.5;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  padding: 0 25px;
}

.tabs button {
  display: block;
  padding: 15px 25px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1em;
  color: var(--text-secondary);
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
  font-weight: 500;
  position: relative;
}

.tabs button:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tabs button.active {
  border-bottom-color: var(--color-primary);
  font-weight: 600;
  color: var(--text-primary);
}

.tabs button.active::after {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
  border-radius: 3px 3px 0 0;
}

.students-tab {
  padding: 25px;
  /* Немного увеличиваем “воздух” для списка и дропдауна */
  min-height: 400px;
}

.button-back {
  margin-bottom: 25px;
  display: flex;
  justify-content: flex-end;
}

.back-btn {
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 10px 20px;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.3s ease;
  gap: 8px;
}

.back-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.students-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.student-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.student-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}

.student-info {
  flex: 1;
  min-width: 0;
}

.student-info h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 1.1em;
  font-weight: 600;
}

.student-info p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9em;
}

.student-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.check-btn {
  background-color: var(--color-warning);
  color: var(--btn-warning-text);
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
  flex: 1;
  min-width: 140px;
}

.check-btn:hover {
  background-color: var(--color-warning-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.remove-btn {
  background-color: var(--color-danger);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
  flex: 1;
  min-width: 100px;
}

.remove-btn:hover {
  background-color: var(--color-danger-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.add-student {
  margin-top: 30px;
  padding: 25px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
}

.custom-dropdown {
  position: relative;
  width: 100%;
  margin-bottom: 15px;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--input-bg);
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 50px;
}

.dropdown-header:hover {
  border-color: var(--color-primary);
}

.dropdown-header.dropdown-open {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(23, 162, 184, 0.2);
}

.dropdown-header.has-selection {
  border-color: var(--color-success);
  background-color: rgba(40, 167, 69, 0.1);
}

.dropdown-placeholder {
  color: var(--text-placeholder);
}

.selected-student {
  font-weight: 500;
  color: var(--text-primary);
}

.dropdown-arrow {
  transition: transform 0.3s ease;
  color: var(--text-muted);
}

.dropdown-open .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 2px solid var(--color-primary);
  border-top: none;
  border-radius: 0 0 var(--border-radius) var(--border-radius);
  box-shadow: var(--shadow-lg);
  /* Делаем список заметно выше, чтобы помещалось больше студентов */
  max-height: min(500px, calc(100vh - 200px));
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
  border-bottom: 1px solid var(--border-color-light);
}

.dropdown-student-item:last-child {
  border-bottom: none;
}

.dropdown-student-item:hover {
  background-color: var(--bg-hover);
}

.dropdown-student-item.selected {
  background-color: rgba(40, 167, 69, 0.1);
}

.dropdown-student-item.in-current-group {
  background-color: rgba(255, 193, 7, 0.1);
  cursor: not-allowed;
}

.dropdown-student-item.in-other-group {
  background-color: rgba(220, 53, 69, 0.1);
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
  background: linear-gradient(135deg, var(--color-primary), var(--color-info));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8em;
  flex-shrink: 0;
  margin-top: 2px;
}

.dropdown-student-item .student-info {
  flex: 1;
  min-width: 0;
}

.dropdown-student-item .student-info h4 {
  margin: 0 0 4px 0;
  color: var(--text-primary);
  font-size: 0.95em;
  font-weight: 500;
}

.dropdown-student-item .student-info p {
  margin: 0;
  font-size: 0.8em;
  color: var(--text-secondary);
}

.status-text {
  font-size: 0.75em !important;
  font-weight: 500;
  margin-top: 4px !important;
}

.status-available {
  color: var(--color-success);
}

.status-current {
  color: var(--color-warning);
}

.status-other {
  color: var(--color-danger);
}

.dropdown-loading,
.dropdown-error,
.no-students {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-style: italic;
}

.dropdown-error {
  color: var(--color-danger);
  background-color: var(--color-danger-light);
  margin: 8px;
  border-radius: 4px;
  padding: 15px;
}

.retry-btn {
  background: var(--color-danger);
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
  font-size: 0.8em;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  background: var(--color-danger-dark);
}

.selected-student-info {
  min-height: 20px;
  padding: 0 5px;
  margin-bottom: 15px;
}

.warning-text {
  color: var(--color-danger);
  font-size: 0.9em;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
}

.success-text {
  color: var(--color-success);
  font-size: 0.9em;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
}

.add-btn {
  background-color: var(--color-success);
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 1em;
  font-weight: 500;
  transition: all 0.3s ease;
  width: 100%;
}

.add-btn:hover:not(:disabled) {
  background-color: var(--color-success-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.add-btn:disabled {
  background-color: var(--color-secondary);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.6;
}

/* Student Tasks Tab */
.student-header {
  padding: 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.student-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.4em;
  font-weight: 600;
}

.tasks-list {
  padding: 25px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.task-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.task-card h4 {
  margin: 0 0 10px 0;
  color: var(--text-primary);
  font-size: 1.1em;
  font-weight: 600;
}

.task-card .description {
  color: var(--text-secondary);
  margin: 10px 0;
  font-size: 0.95em;
  line-height: 1.4;
}

.task-card .deadline {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 5px 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.status {
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
  display: inline-block;
  font-size: 0.85em;
  margin-top: 10px;
}

.status-not_started,
.status-NOT_STARTED {
  background-color: var(--task-not-started);
  color: var(--task-not-started-text);
}

.status-in_progress,
.status-IN_PROGRESS {
  background-color: var(--task-in-progress);
  color: var(--task-in-progress-text);
}

.status-completed,
.status-COMPLETED {
  background-color: var(--task-completed);
  color: var(--task-completed-text);
}

.status-overdue,
.status-OVERDUE {
  background-color: var(--task-overdue);
  color: var(--task-overdue-text);
}

.no-tasks {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-style: italic;
  grid-column: 1 / -1;
}

/* Модальное окно подтверждения удаления */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: var(--bg-card);
  padding: 30px;
  border-radius: var(--border-radius);
  width: 450px;
  max-width: 90%;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
}

.modal-content h3 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  font-size: 1.3em;
  font-weight: 600;
  text-align: center;
}

.modal-content p {
  margin: 0 0 25px 0;
  color: var(--text-secondary);
  font-size: 1em;
  line-height: 1.5;
  text-align: center;
}

.modal-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.delete-btn {
  background-color: var(--color-danger);
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 120px;
}

.delete-btn:hover {
  background-color: var(--color-danger-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.cancel-btn {
  background-color: var(--color-secondary);
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  min-width: 120px;
}

.cancel-btn:hover {
  background-color: var(--color-secondary-dark);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Тосты */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: var(--border-radius);
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
  border-left: 4px solid var(--color-success-dark);
}

.toast-error {
  background: var(--color-danger);
  border-left: 4px solid var(--color-danger-dark);
}

.toast-warning {
  background: var(--color-warning);
  color: var(--text-light);
  border-left: 4px solid var(--color-warning-dark);
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.5em;
  cursor: pointer;
  margin-left: 15px;
  opacity: 0.8;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.toast-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
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

/* Адаптивность */
@media (max-width: 768px) {
  .group-detail {
    padding: 15px;
  }

  .group-header,
  .students-tab,
  .student-header {
    padding: 20px;
  }

  .students-list {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .student-card {
    flex-direction: column;
    gap: 10px;
  }

  .student-info {
    width: 100%;
  }

  .student-actions {
    flex-direction: column;
  }

  .check-btn,
  .remove-btn {
    width: 100%;
    min-width: unset;
  }

  .dropdown-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 400px;
    max-height: min(70vh, calc(100vh - 100px));
    border-radius: var(--border-radius);
    border: 2px solid var(--color-primary);
  }

  .tabs {
    padding: 0 15px;
    overflow-x: auto;
    white-space: nowrap;
  }

  .tabs button {
    padding: 12px 20px;
  }

  .tasks-list {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .modal-content {
    padding: 20px;
    margin: 20px;
  }

  .modal-actions {
    flex-direction: column;
  }

  .delete-btn,
  .cancel-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .group-detail {
    padding: 10px;
  }

  .group-header h2 {
    font-size: 1.5em;
  }

  .student-header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .student-header h3 {
    text-align: center;
  }

  .back-btn {
    width: 100%;
  }

  .toast {
    left: 10px;
    right: 10px;
    min-width: auto;
    max-width: none;
  }
}

/* Анимации */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.student-card,
.task-card,
.dropdown-student-item {
  animation: fadeIn 0.3s ease-out;
}

/* Прокрутка */
.dropdown-content,
.tasks-list,
.students-list {
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary) var(--bg-tertiary);
}

.dropdown-content::-webkit-scrollbar,
.tasks-list::-webkit-scrollbar,
.students-list::-webkit-scrollbar {
  width: 6px;
}

.dropdown-content::-webkit-scrollbar-track,
.tasks-list::-webkit-scrollbar-track,
.students-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.dropdown-content::-webkit-scrollbar-thumb,
.tasks-list::-webkit-scrollbar-thumb,
.students-list::-webkit-scrollbar-thumb {
  background: var(--color-primary);
  border-radius: 3px;
}

.dropdown-content::-webkit-scrollbar-thumb:hover,
.tasks-list::-webkit-scrollbar-thumb:hover,
.students-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-dark);
}

/* Иконки */
.warning-text::before {
  content: '⚠️';
}

.success-text::before {
  content: '✓';
}
</style>