<template>
  <div class="group-detail">
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
        <button @click="backToGroups" class="back-btn">← Назад к списку групп</button>

        <div class="students-list">
          <div v-for="student in students" :key="student.id" class="student-card">
            <div class="student-info">
              <h4>{{ student.name }}</h4>
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
                @click="removeStudent(student.id)"
                class="remove-btn"
            >
              Удалить
            </button>
          </div>
        </div>

        <div v-if="user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER'" class="add-student">
          <select v-model="selectedStudent" class="student-select">
            <option value="" disabled>Выберите студента</option>
            <option v-for="student in availableStudents" :key="student.id" :value="student.id">
              {{ student.name }} ({{ student.email }})
            </option>
          </select>
          <button @click="addStudent" class="add-btn">Добавить</button>
        </div>
      </div>

      <!-- Вкладка: Задачи студента -->
      <div v-else-if="activeTab === 'student-tasks'" class="tasks-tab">
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
import { ref, onMounted } from 'vue';
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

    // --- Новые переменные ---
    const currentStudent = ref(null);        // текущий выбранный студент
    const studentTasks = ref([]);            // задачи студента
    const loadingTasks = ref(false);         // индикатор загрузки задач

    // --- Получение данных группы ---
    const fetchGroupData = async () => {
      try {
        // Информация о группе
        const groupResponse = await api.getGroupInfo(route.params.groupId);
        group.value = groupResponse.data;

        // Студенты группы
        const studentsResponse = await api.getGroupStudents(route.params.groupId);
        students.value = studentsResponse.data;

        // Доступные студенты (для добавления)
        if (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER') {
          const availableResponse = await api.getUsersByRole('STUDENT');
          availableStudents.value = availableResponse.data;
        }

        // Задачи группы (если нужно)
        try {
          const tasksResponse = await api.getGroupTasks(route.params.groupId);
          // groupTasks.value = tasksResponse.data; // если используешь
        } catch (error) {
          console.log('Не удалось получить задачи группы:', error);
        }
      } catch (error) {
        console.error('Ошибка при получении данных группы:', error);
      } finally {
        loading.value = false;
      }
    };

    onMounted(fetchGroupData);

    // --- Новый метод: просмотр задач студента ---
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
        alert('Не удалось загрузить задачи студента.');
      } finally {
        loadingTasks.value = false;
      }
    };

    // --- Возврат к списку студентов ---
    const backToStudents = () => {
      activeTab.value = 'students';
      currentStudent.value = null;
      studentTasks.value = [];
    };

    const backToGroups = () => {
      router.push('/profile/groups');
    }

    // --- Форматирование даты ---
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

    // --- Управление студентами ---
    const addStudent = async () => {
      if (!selectedStudent.value) return;
      try {
        await api.addStudentToGroup(route.params.groupId, selectedStudent.value);
        await fetchGroupData();
        selectedStudent.value = '';
      } catch (error) {
        console.error('Ошибка при добавлении студента:', error);
        alert('Не удалось добавить студента.');
      }
    };

    const removeStudent = async (studentId) => {
      try {
        await api.removeStudentFromGroup(route.params.groupId, studentId);
        await fetchGroupData();
      } catch (error) {
        console.error('Ошибка при удалении студента:', error);
        alert('Не удалось удалить студента.');
      }
    };

    return {
      // данные
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

      // методы
      formatDate,
      getStatusText,
      addStudent,
      removeStudent,
      checkStudentTask,
      backToStudents,
      backToGroups
    };
  }
};
</script>

<style scoped>
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
</style>