<template>
  <div class="groups-container">
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>
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

    <div
        v-if="groupsTotalPages > 1"
        class="pagination groups-pagination"
    >
      <button
          class="pagination-btn"
          @click="prevGroupsPage"
          :disabled="groupsCurrentPage === 1"
      >
        ← Назад
      </button>
      <span class="pagination-info">
        Страница {{ groupsCurrentPage }} из {{ groupsTotalPages }}
        (всего: {{ groupsTotalElements }} групп)
      </span>
      <button
          class="pagination-btn"
          @click="nextGroupsPage"
          :disabled="groupsCurrentPage === groupsTotalPages"
      >
        Вперёд →
      </button>
      <select
          v-model="groupsPageSize"
          @change="changeGroupsPageSize"
          class="page-size-select"
      >
        <option :value="6">6 на странице</option>
        <option :value="12">12 на странице</option>
        <option :value="24">24 на странице</option>
      </select>
    </div>
    <!-- Модалка подтверждения удаления -->
    <div v-if="showDeleteConfirm" class="modal">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить группу "{{ groupToDelete?.name }}"?</p>
        <div class="modal-actions">
          <button @click="confirmDelete" class="delete-btn">Удалить</button>
          <button @click="cancelDelete" class="cancel-btn">Отмена</button>
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
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from "@/api/index.js";

export default {
  name: 'Groups',
  setup() {
    const router = useRouter();
    const groups = ref([]);
    const groupsCurrentPage = ref(1);
    const groupsPageSize = ref(12);
    const groupsTotalElements = ref(0);
    const studentsByGroup = ref({});
    const teachers = ref([]);
    const showCreateModal = ref(false);
    const showAssignTeacherModal = ref(false);
    const selectedGroup = ref(null);
    const selectedTeacher = ref(null);
    const showDeleteConfirm = ref(false);
    const groupToDelete = ref(null);
    const toast = ref({
      show: false,
      message: '',
      type: 'success' // success, error, warning
    });
    const newGroup = ref({
      name: '',
      description: ''
    });

    const user = JSON.parse(localStorage.getItem('user') || {});

    const showToast = (message, type = 'success') => {
      toast.value = {
        show: true,
        message,
        type
      };

      // Автоматически скрыть через 4 секунды
      setTimeout(() => {
        hideToast();
      }, 4000);
    };

    const hideToast = () => {
      toast.value.show = false;
    };

    onMounted(() => {
      fetchTeachers(); // Сначала загружаем преподавателей
      fetchGroups();
    });
    const fetchStudentsForGroup = async (groupId) => {
      try {
        const response = await api.getGroupStudents(groupId);
        const students = Array.isArray(response.data) ? response.data : [];
        studentsByGroup.value = {
          ...studentsByGroup.value,
          [groupId]: students
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
        const response = await api.getGroups(groupsCurrentPage.value - 1, groupsPageSize.value);
        const data = response.data;

        if (data && Array.isArray(data.content)) {
          groups.value = data.content;
          groupsTotalElements.value = data.totalElements ?? data.content.length;
        } else if (Array.isArray(data)) {
          groups.value = data;
          groupsTotalElements.value = data.length;
        } else {
          groups.value = [];
          groupsTotalElements.value = 0;
        }

        groups.value.forEach(group => {
          fetchStudentsForGroup(group.id);
        });
      } catch (error) {
        console.error('Ошибка при получении групп:', error);
        showToast('Не удалось загрузить список групп', 'error');
      }
    };

    const fetchTeachers = async () => {
      try {
        const response = await api.getUsersByRole('TEACHER', 0, 1000); // Загружаем всех преподавателей
        const data = response.data;

        // Обрабатываем пагинированный ответ
        if (data && Array.isArray(data.content)) {
          teachers.value = data.content;
        } else if (Array.isArray(data)) {
          teachers.value = data;
        } else {
          teachers.value = [];
        }
      } catch (error) {
        console.error('Ошибка при получении преподавателей:', error);
        showToast('Не удалось загрузить список преподавателей', 'error');
        teachers.value = [];
      }
    };

    const getTeacherName = (teacherId) => {
      if (!teacherId) return null;
      if (!Array.isArray(teachers.value)) return `Преподаватель #${teacherId}`;
      const teacher = teachers.value.find(t => t.id === teacherId);
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

    const confirmDelete = async () => {
      if (!groupToDelete.value) return;

      try {
        await api.deleteGroup(groupToDelete.value.id);
        await fetchGroups();
        showToast('Группа успешно удалена');
      } catch (error) {
        console.error('Ошибка при удалении группы:', error);
        showToast('Не удалось удалить группу', 'error');
      } finally {
        cancelDelete();
      }
    };

    const cancelDelete = () => {
      showDeleteConfirm.value = false;
      groupToDelete.value = null;
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
        showToast('Преподаватель успешно назначен!');
      } catch (error) {
        console.error('Ошибка при назначении преподавателя:', error);
        showToast('Произошла ошибка при назначении преподавателя', 'error');
      }
    };

    // Вычисляем количество студентов для группы
    const studentCount = (groupId) => {
      return studentsByGroup.value[groupId]?.length || 0;
    };

    const groupsTotalPages = computed(() => {
      return groupsPageSize.value > 0
          ? Math.ceil(groupsTotalElements.value / groupsPageSize.value)
          : 0;
    });

    const nextGroupsPage = () => {
      if (groupsCurrentPage.value < groupsTotalPages.value) {
        groupsCurrentPage.value += 1;
        fetchGroups();
      }
    };

    const prevGroupsPage = () => {
      if (groupsCurrentPage.value > 1) {
        groupsCurrentPage.value -= 1;
        fetchGroups();
      }
    };

    const changeGroupsPageSize = () => {
      groupsCurrentPage.value = 1;
      fetchGroups();
    };

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
        showToast('Группа успешно создана');
      } catch (error) {
        console.error('Ошибка при создании группы:', error);
        if (error.response?.status === 403) {
          showToast('У вас нет прав для создания групп', 'error');
        } else {
          showToast('Произошла ошибка при создании группы', 'error');
        }
      }
    };

    const deleteGroup = async (groupId) => {
      // Находим группу для показа названия в модалке
      const group = groups.value.find(g => g.id === groupId);
      groupToDelete.value = group;
      showDeleteConfirm.value = true;
    };

    return {
      groups,
      groupsCurrentPage,
      groupsPageSize,
      groupsTotalElements,
      groupsTotalPages,
      nextGroupsPage,
      prevGroupsPage,
      changeGroupsPageSize,
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
      assignTeacher,
      toast,
      hideToast,
      showDeleteConfirm,
      groupToDelete,
      confirmDelete,
      cancelDelete,
    };
  }
};
</script>

<style scoped>
.groups-container {
  padding: 20px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.create-btn {
  background-color: var(--btn-success-bg);
  color: var(--btn-success-text);
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.create-btn:hover {
  background-color: var(--btn-success-hover);
}

.groups-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  padding: 15px 0;
  border-top: 1px solid var(--border-color);
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
  color: #999;
  cursor: not-allowed;
}

.pagination-info {
  color: var(--text-muted);
  font-size: 0.9em;
}

.page-size-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);
  font-size: 0.9em;
}

@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
}

.group-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 15px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.3s, box-shadow 0.3s;
}

.group-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.group-card h3 {
  margin: 0 0 10px 0;
  color: var(--text-primary);
}

.group-card p {
  margin: 0 0 10px 0;
  color: var(--text-secondary);
}

.group-meta {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin: 10px 0;
  font-size: 0.9em;
  color: var(--text-secondary);
}

.group-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.3s;
}

.view {
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.view:hover {
  background-color: var(--btn-primary-hover);
}

.delete {
  background-color: var(--btn-danger-bg);
  color: var(--btn-danger-text);
}

.delete:hover {
  background-color: var(--btn-danger-hover);
}

.assign {
  background-color: var(--color-success);
  color: white;
}

.assign:hover {
  background-color: var(--color-success-dark);
}

/* Модальные окна */
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
  background: var(--bg-card);
  padding: 20px;
  border-radius: var(--border-radius);
  width: 500px;
  max-width: 90%;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.modal-content h3 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
}

.modal-content p {
  margin: 0 0 20px 0;
  color: var(--text-secondary);
}

.modal-subtitle {
  margin-bottom: 20px;
  font-weight: bold;
  color: var(--text-primary);
}

.close {
  float: right;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
}

.close:hover {
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: var(--text-secondary);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--input-text);
  border-radius: 4px;
}

.form-group textarea {
  min-height: 100px;
  resize: vertical;
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
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-card);
}

.teacher-card:hover {
  background: var(--bg-hover);
}

.teacher-card.selected {
  border-color: var(--color-success);
  background: rgba(40, 167, 69, 0.1);
}

.teacher-info h4 {
  margin: 0 0 5px 0;
  color: var(--text-primary);
}

.teacher-info p {
  margin: 0 0 5px 0;
  color: var(--text-secondary);
  font-size: 0.9em;
}

.groups-count {
  font-size: 0.8em;
  color: var(--text-muted);
}

.teacher-check {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.teacher-card.selected .teacher-check {
  border-color: var(--color-success);
  background-color: var(--color-success);
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
  background-color: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background-color: var(--btn-secondary-hover);
}

.submit-btn {
  background-color: var(--btn-success-bg);
  color: var(--btn-success-text);
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:hover:not(:disabled) {
  background-color: var(--btn-success-hover);
}

.submit-btn:disabled {
  background-color: var(--color-secondary);
  cursor: not-allowed;
}

.no-teacher {
  color: var(--color-danger);
  font-style: italic;
}

.teacher-info {
  color: var(--color-success);
  font-weight: 500;
}

/* Тосты */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 300px;
  max-width: 400px;
  z-index: 1000;
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
  color: #856404;
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
</style>