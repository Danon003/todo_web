<template>
  <div class="group-detail">
    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="group" class="group-content">
      <div class="group-header">
        <h2>{{ group.name }}</h2>
        <p class="description">{{ group.description }}</p>
      </div>

      <div class="tabs">
        <button :class="{ active: activeTab === 'students' }" @click="activeTab = 'students'">
          Студенты
        </button>
        <button :class="{ active: activeTab === 'tasks' }" @click="activeTab = 'tasks'">
          Задачи
        </button>
      </div>

      <div v-if="activeTab === 'students'" class="students-tab">
        <div class="students-list">
          <div v-for="student in students" :key="student.id" class="student-card">
            <div class="student-info">
              <h4>{{ student.name }}</h4>
              <p>{{ student.email }}</p>
            </div>
            <button v-if="user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER'"
                    @click="removeStudent(student.id)"
                    class="remove-btn">
              Удалить
            </button>
          </div>
        </div>

        <div v-if="user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER'" class="add-student">
          <select v-model="selectedStudent" class="student-select">
            <option v-for="student in availableStudents" :key="student.id" :value="student.id">
              {{ student.name }} ({{ student.email }})
            </option>
          </select>
          <button @click="addStudent" class="add-btn">Добавить</button>
        </div>
      </div>

      <div v-if="activeTab === 'tasks'" class="tasks-tab">
        <div class="tasks-list">
          <div v-for="task in groupTasks" :key="task.id" class="task-card">
            <h4>{{ task.title }}</h4>
            <p class="deadline">До: {{ formatDate(task.deadline) }}</p>
            <p class="status" :class="'status-' + task.status.toLowerCase()">
              {{ getStatusText(task.status) }}
            </p>
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
import axios from 'axios';

export default {
  name: 'GroupDetail',
  setup() {
    const route = useRoute();
    const group = ref(null);
    const students = ref([]);
    const availableStudents = ref([]);
    const groupTasks = ref([]);
    const selectedStudent = ref('');
    const activeTab = ref('students');
    const loading = ref(true);
    const user = JSON.parse(localStorage.getItem('user') || {});

    const fetchGroupData = async () => {
      try {
        const token = localStorage.getItem('jwt-token');

        // Получаем информацию о группе
        const groupResponse = await axios.get(`http://localhost:8080/group/${route.params.groupId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        group.value = groupResponse.data;

        // Получаем студентов группы
        const studentsResponse = await axios.get(
            `http://localhost:8080/group/${route.params.groupId}/students`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
        );
        students.value = studentsResponse.data;

        // Получаем доступных студентов (для добавления в группу)
        if (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_TEACHER') {
          const availableResponse = await axios.get(
              'http://localhost:8080/admin/users/by-role?role=STUDENT',
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
          );
          availableStudents.value = availableResponse.data;
        }

        // Получаем задачи группы
        try {
          const tasksResponse = await axios.get(
              `http://localhost:8080/group/${route.params.groupId}/tasks`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
          );
          groupTasks.value = tasksResponse.data;
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

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString();
    };

    const getStatusText = (status) => {
      const statusMap = {
        'NOT_STARTED': 'Не начата',
        'IN_PROGRESS': 'В процессе',
        'COMPLETED': 'Завершено'
      };
      return statusMap[status] || status;
    };

    const addStudent = async () => {
      if (!selectedStudent.value) return;

      try {
        const token = localStorage.getItem('jwt-token');
        await axios.post(
            `http://localhost:8080/group/${route.params.groupId}/students/${selectedStudent.value}`,
            {},
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
        );
        await fetchGroupData();
        selectedStudent.value = '';
      } catch (error) {
        console.error('Ошибка при добавлении студента:', error);
      }
    };

    const removeStudent = async (studentId) => {
      try {
        const token = localStorage.getItem('jwt-token');
        await axios.delete(
            `http://localhost:8080/group/${route.params.groupId}/students/${studentId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
        );
        await fetchGroupData();
      } catch (error) {
        console.error('Ошибка при удалении студента:', error);
      }
    };

    const assignTaskToGroup = async (taskId) => {
      try {
        const token = localStorage.getItem('jwt-token');
        await axios.post(
            `http://localhost:8080/task/assign/${taskId}/group/${route.params.groupId}`, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
        );
        alert('Задача успешно назначена группе');
      } catch (error) {
        console.error('Ошибка при назначении задачи группе:', error);
      }
    };

    return {
      group,
      students,
      availableStudents,
      groupTasks,
      selectedStudent,
      activeTab,
      loading,
      user,
      formatDate,
      getStatusText,
      addStudent,
      removeStudent,
      assignTaskToGroup
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
  display: flex;
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
</style>