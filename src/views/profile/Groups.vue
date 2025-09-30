<template>
  <div class="groups-container">
    <div class="groups-header">
      <h2>{{ user.role === 'ROLE_ADMIN' ? 'Управление группами' : 'Мои группы' }}</h2>
      <button v-if="user.role === 'ROLE_ADMIN'" @click="showCreateModal = true" class="create-btn">
        Создать группу
      </button>
    </div>

    <div class="groups-list">
      <div v-for="group in groups" :key="group.id" class="group-card">
        <h3>{{ group.name }}</h3>
        <p>{{ group.description }}</p>
        <div class="group-meta">
          <span>Студентов: {{ studentCount(group.id) }}</span>
          <span v-if="getTeacherName(group.teacherId)" class="teacher-info">
    Ответственный: {{ getTeacherName(group.teacherId) }}
  </span>
          <span v-else class="no-teacher">
    Ответственный не назначен
  </span>
        </div>
        <div class="group-actions">
          <button @click="viewGroup(group.id)" class="action-btn view">Просмотр</button>
          <button v-if="user.role === 'ROLE_ADMIN'"
                  @click="openAssignTeacherModal(group)"
                  class="action-btn assign">
            {{ group.teacherId ? 'Сменить ответственного' : 'Назначить ответственного' }}
          </button>
          <button v-if="user.role === 'ROLE_ADMIN'"
                  @click="deleteGroup(group.id)"
                  class="action-btn delete">
            Удалить
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания группы -->
    <div v-if="showCreateModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showCreateModal = false">&times;</span>
        <h3>Создать новую группу</h3>
        <form @submit.prevent="createGroup">
          <div class="form-group">
            <label>Название:</label>
            <input v-model="newGroup.name" type="text" required>
          </div>
          <div class="form-group">
            <label>Описание:</label>
            <textarea v-model="newGroup.description"></textarea>
          </div>
          <button type="submit" class="submit-btn">Создать</button>
        </form>
      </div>
    </div>

    <!-- Модальное окно назначения преподавателя -->
    <div v-if="showAssignTeacherModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="showAssignTeacherModal = false">&times;</span>
        <h3>Назначить ответственного преподавателя</h3>
        <p class="modal-subtitle">Группа: {{ selectedGroup?.name }}</p>

        <div class="teachers-list">
          <div v-for="teacher in teachers" :key="teacher.id"
               class="teacher-card"
               :class="{ 'selected': selectedTeacher?.id === teacher.id }"
               @click="selectTeacher(teacher)">
            <div class="teacher-info">
              <h4>{{ teacher.name }}</h4>
              <p>{{ teacher.email }}</p>
            </div>
            <div class="teacher-check">
              <span v-if="selectedTeacher?.id === teacher.id" class="checkmark">✓</span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="assignTeacher"
                  :disabled="!selectedTeacher"
                  class="submit-btn">
            Назначить
          </button>
          <button @click="showAssignTeacherModal = false" class="cancel-btn">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from "@/api/index.js";

export default {
  name: 'Groups',
  setup() {
    const router = useRouter();
    const groups = ref([]);
    const studentsByGroup = ref({});
    const teachers = ref([]);
    const showCreateModal = ref(false);
    const showAssignTeacherModal = ref(false);
    const selectedGroup = ref(null);
    const selectedTeacher = ref(null);

    const newGroup = ref({
      name: '',
      description: ''
    });

    const user = JSON.parse(localStorage.getItem('user') || {});

    // Получаем студентов для конкретной группы
    const fetchStudentsForGroup = async (groupId) => {
      try {
        const response = await api.getGroupStudents(groupId);
        studentsByGroup.value = {
          ...studentsByGroup.value,
          [groupId]: response.data
        };
      } catch (error) {
        console.error(`Ошибка при получении студентов группы ${groupId}:`, error);
        studentsByGroup.value = {
          ...studentsByGroup.value,
          [groupId]: []
        };
      }
    };

    const fetchGroups = async () => {
      try {
        const response = await api.getGroups();
        groups.value = response.data;
        groups.value.forEach(group => {
          fetchStudentsForGroup(group.id);
        });
      } catch (error) {
        console.error('Ошибка при получении групп:', error);
      }
    };

    const fetchTeachers = async () => {
      try {
        const response = await api.getUsersByRole('TEACHER');
        teachers.value = response.data;
        console.log('Loaded teachers:', teachers.value); // Добавь эту строку
      } catch (error) {
        console.error('Ошибка при получении преподавателей:', error);
      }
    };

    const getTeacherName = (teacherId) => {
      if (!teacherId) return null;

      // Используем teachers из модального окна (они уже загружены там)
      const teacher = teachers.value.find(t => t.id === teacherId);

      // Если не нашли, возвращаем заглушку с ID для отладки
      return teacher ? teacher.username : `Преподаватель #${teacherId}`;
    };

    const openAssignTeacherModal = async (group) => {
      selectedGroup.value = group;
      selectedTeacher.value = null;

      await fetchTeachers();

      if (group.teacherId) {
        const currentTeacher = teachers.value.find(t => t.id === group.teacherId);
        if (currentTeacher) {
          selectedTeacher.value = currentTeacher;
        }
      }

      showAssignTeacherModal.value = true;
    };

    const selectTeacher = (teacher) => {
      selectedTeacher.value = teacher;
    };

    const assignTeacher = async () => {
      if (!selectedGroup.value || !selectedTeacher.value) return;

      try {
        await api.assignTeacherToGroup(selectedGroup.value.id, selectedTeacher.value.id);

        const groupIndex = groups.value.findIndex(g => g.id === selectedGroup.value.id);
        if (groupIndex !== -1) {
          groups.value[groupIndex].teacherId = selectedTeacher.value.id;
          groups.value[groupIndex].teacherName = selectedTeacher.value.name;
        }

        showAssignTeacherModal.value = false;
        alert('Преподаватель успешно назначен!');
      } catch (error) {
        console.error('Ошибка при назначении преподавателя:', error);
        alert('Произошла ошибка при назначении преподавателя');
      }
    };

    // Вычисляем количество студентов для группы
    const studentCount = (groupId) => {
      return studentsByGroup.value[groupId]?.length || 0;
    };

    onMounted(() => {
       fetchTeachers(); // Сначала загружаем преподавателей
       fetchGroups();
    });

    const viewGroup = (groupId) => {
      router.push(`/profile/groups/${groupId}`);
    };

    const createGroup = async () => {
      try {
        const groupData = new URLSearchParams();
        groupData.append('name', newGroup.value.name);
        groupData.append('description', newGroup.value.description);

        await api.createGroup(groupData);

        showCreateModal.value = false;
        await fetchGroups();
        newGroup.value = {
          name: '',
          description: ''
        };
      } catch (error) {
        console.error('Ошибка при создании группы:', error);
        if (error.response?.status === 403) {
          alert('У вас нет прав для создания групп');
        } else {
          alert('Произошла ошибка при создании группы');
        }
      }
    };

    const deleteGroup = async (groupId) => {
      if (!confirm('Вы уверены, что хотите удалить эту группу?')) return;

      try {
        await api.deleteGroup(groupId);
        await fetchGroups();
      } catch (error) {
        console.error('Ошибка при удалении группы:', error);
      }
    };

    return {
      groups,
      teachers,
      showCreateModal,
      showAssignTeacherModal,
      newGroup,
      selectedGroup,
      selectedTeacher,
      user,
      studentCount,
      viewGroup,
      createGroup,
      deleteGroup,
      openAssignTeacherModal,
      selectTeacher,
      getTeacherName,
      assignTeacher
    };
  }
};
</script>

<style scoped>
.groups-container {
  padding: 20px;
}

.groups-header {
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

.groups-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.group-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.group-meta {
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
}

.group-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.view {
  background-color: #17A2B8;
  color: white;
}

.delete {
  background-color: #DC3545;
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
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group textarea {
  min-height: 100px;
}

.submit-btn {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.modal-subtitle {
  margin-bottom: 20px;
  font-weight: bold;
  color: #333;
}

.teachers-list {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.teacher-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.teacher-card:hover {
  background-color: #f5f5f5;
}

.teacher-card.selected {
  border-color: #4CAF50;
  background-color: #f0fff0;
}

.teacher-info h4 {
  margin: 0 0 5px 0;
  color: #333;
}

.teacher-info p {
  margin: 0 0 5px 0;
  color: #666;
  font-size: 0.9em;
}

.groups-count {
  font-size: 0.8em;
  color: #888;
}

.teacher-check {
  width: 24px;
  height: 24px;
  border: 2px solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.teacher-card.selected .teacher-check {
  border-color: #4CAF50;
  background-color: #4CAF50;
}

.checkmark {
  color: white;
  font-weight: bold;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.teacher-info {
  flex: 1;
}
.teachers-list {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.teacher-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
}

.teacher-card:hover {
  background-color: #f5f5f5;
}

.teacher-card.selected {
  border-color: #4CAF50;
  background-color: #f0fff0;
}

.teacher-info h4 {
  margin: 0 0 5px 0;
}

.teacher-info p {
  margin: 0;
  color: #666;
}

.teacher-check {
  width: 24px;
  height: 24px;
  border: 2px solid #ddd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.teacher-card.selected .teacher-check {
  border-color: #4CAF50;
  background-color: #4CAF50;
}

.checkmark {
  color: white;
  font-weight: bold;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.submit-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
.no-teacher {
  color: #dc3545;
  font-style: italic;
}

.teacher-info {
  color: #28a745;
  font-weight: 500;
}
</style>