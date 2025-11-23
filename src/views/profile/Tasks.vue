<template>
  <div class="tasks-container">
    <!-- Тосты для уведомлений (без изменений) -->
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
      <!-- Фильтр по тегам -->
      <select v-model="selectedTagFilter" class="filter-select" @change="applyTagFilter">
        <option value="">Все теги</option>
        <option v-for="tag in availableTags" :key="tag.id" :value="tag.name">
          {{ tag.name }}
        </option>
      </select>

      <label class="hide-expired-checkbox">
        <input
            type="checkbox"
            v-model="hideExpiredTasks"
            @change="applyExpiredFilter"
        >
        <span class="checkmark"></span>
        Скрыть прошедшие задачи
      </label>
    </div>

    <div class="tasks-list">
      <div v-for="task in filteredTasks" :key="task.id" class="task-card">
        <h3>{{ task.title }}</h3>
        <p>{{ task.description }}</p>

        <!-- Блок тегов -->
        <div class="task-tags" v-if="task.tags && task.tags.length > 0">
          <span
              v-for="tag in task.tags"
              :key="tag"
              class="tag"
              :class="getTagClass(tag)"
          >
            {{ typeof tag === 'string' ? tag : tag.name }}
          </span>
        </div>
        <div v-else class="no-tags">
          <span class="no-tags-text">Нет тегов</span>
        </div>

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
              v-if="user.role === 'ROLE_STUDENT' && !isTaskExpired(task)"
              @click="openStatusModal(task)"
              class="action-btn update"
          >
            Обновить статус
          </button>

          <span
              v-else-if="user.role === 'ROLE_STUDENT' && isTaskExpired(task)"
              class="status-locked"
          >
            Статус недоступен
          </span>
          <button
              v-if="user.role === 'ROLE_STUDENT' && !isTaskExpired(task)"
              @click="openShareModal(task)"
              class="action-btn share"
          >
            Поделиться
          </button>

          <span
              v-else-if="user.role === 'ROLE_STUDENT' && isTaskExpired(task)"
              class="status-locked"
          >
            Нельзя поделиться
          </span>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания задачи с тегами -->
    <div v-if="showCreateModal" class="modal" @click.self="showCreateModal = false">
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

          <!-- Блок тегов при создании -->
          <div class="form-group">
            <label>Теги:</label>
            <div class="tags-selection">
              <div class="available-tags-container">
                <div class="available-tags-header">
                  <span>Доступные теги ({{ availableTags.length }})</span>
                  <div class="tags-search" v-if="availableTags.length > 5">
                    <input
                        v-model="tagSearch"
                        type="text"
                        placeholder="Поиск тега..."
                        class="tag-search-input"
                    >
                  </div>
                </div>

                <div class="available-tags-scrollable">
                  <div v-if="filteredAvailableTags.length === 0" class="no-tags-available">
                    {{ tagSearch ? 'Теги не найдены' : 'Нет доступных тегов' }}
                  </div>
                  <span
                      v-else
                      v-for="tag in filteredAvailableTags"
                      :key="tag.id"
                      class="tag-selectable"
                      :class="{
            selected: newTask.selectedTagIds.includes(tag.id),
            'search-match': tagSearch && tag.name.toLowerCase().includes(tagSearch.toLowerCase())
          }"
                      @click="toggleTagSelection(tag.id)"
                  >
          {{ tag.name }}
          <span v-if="newTask.selectedTagIds.includes(tag.id)" class="selected-indicator">✓</span>
        </span>
                </div>
              </div>

              <!-- Блок добавления новых тегов -->
              <div class="custom-tags-section">
                <div class="tag-input-container">
                  <input
                      v-model="newTask.customTag"
                      type="text"
                      placeholder="Добавить новый тег..."
                      @keydown.enter.prevent="addCustomTag"
                      class="tag-input"
                  >
                  <button type="button" @click="addCustomTag" class="add-tag-btn">+</button>
                </div>

                <div v-if="newTask.customTags.length > 0" class="custom-tags">
                  <span class="custom-tags-label">Новые теги:</span>
                  <span
                      v-for="tag in newTask.customTags"
                      :key="tag"
                      class="tag custom-tag"
                  >
          {{ tag }}
          <span @click="removeCustomTag(tag)" class="remove-tag">×</span>
        </span>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" class="submit-btn">Создать</button>
        </form>
      </div>
    </div>

    <!-- Модальное окно изменения статуса -->
    <div v-if="showStatusModal" class="modal" @click.self="showStatusModal = false">
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

    <div v-if="showShareModal" class="modal" @click.self="showShareModal = false">
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

    // Новые переменные для тегов
    const availableTags = ref([]);
    const selectedTagFilter = ref('');
    const tagSearch = ref('');
    const hideExpiredTasks = ref(false);
    const filteredAvailableTags = computed(() => {
      if (!tagSearch.value) {
        return availableTags.value;
      }

      const searchTerm = tagSearch.value.toLowerCase();
      return availableTags.value.filter(tag =>
          tag.name.toLowerCase().includes(searchTerm)
      );
    });
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
      priority: 'MEDIUM',
      selectedTagIds: [],     // ID выбранных тегов
      customTags: [],         // Пользовательские теги
      customTag: ''           // Поле для ввода нового тега
    });

    const user = JSON.parse(localStorage.getItem('user') || '{}');




    const isTaskExpired = (task) => {
      return new Date(task.deadline) < new Date();
    };

    const filteredTasks = computed(() => {
      let result = [...tasks.value];

      // Фильтрация по статусу
      if (filterStatus.value !== 'all') {
        result = result.filter(task => task.userStatus === filterStatus.value);
      }

      // Фильтрация по тегу
      if (selectedTagFilter.value) {
        result = result.filter(task => {
          if (!task.tags || task.tags.length === 0) return false;

          return task.tags.some(tag => {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            return tagName === selectedTagFilter.value;
          });
        });
      }

      // Новая фильтрация: скрытие прошедших задач
      if (hideExpiredTasks.value) {
        result = result.filter(task => !isTaskExpired(task));
      }

      // Сортировка
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

    // Новый метод для применения фильтра прошедших задач
    const applyExpiredFilter = () => {
      // Фильтрация применяется автоматически через computed свойство
      console.log('Скрытие прошедших задач:', hideExpiredTasks.value);
    };
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

    const fetchAvailableTags = async () => {
      try {
        const response = await api.getAvailableTags();
        console.log('Полученные теги с бэкенда:', response.data); // Для дебага
        availableTags.value = response.data;
      } catch (error) {
        console.error('Ошибка при загрузке тегов:', error);
        showToast('Не удалось загрузить список тегов', 'error');
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
      fetchAvailableTags(); // Загружаем теги при монтировании
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

    // Новые методы для работы с тегами
    const getTagClass = (tag) => {
      // Получаем имя тега (может быть объектом или строкой)
      const tagName = typeof tag === 'string' ? tag : tag.name || '';

      // Генерируем класс на основе имени тега для разных цветов
      const tagColors = [
        'tag-primary', 'tag-secondary', 'tag-success',
        'tag-warning', 'tag-danger', 'tag-info'
      ];
      const index = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % tagColors.length;
      return tagColors[index];
    };

    const toggleTagSelection = (tagId) => {
      const index = newTask.value.selectedTagIds.indexOf(tagId);
      if (index > -1) {
        newTask.value.selectedTagIds.splice(index, 1);
      } else {
        newTask.value.selectedTagIds.push(tagId);
      }
    };

    const addCustomTag = () => {
      const tagName = newTask.value.customTag.trim();

      if (tagName && !newTask.value.customTags.includes(tagName)) {
        // Проверяем, нет ли уже такого тега в доступных тегах
        const existingTag = availableTags.value.find(tag => tag.name === tagName);

        if (existingTag) {
          // Если тег уже существует, добавляем его ID в выбранные
          if (!newTask.value.selectedTagIds.includes(existingTag.id)) {
            newTask.value.selectedTagIds.push(existingTag.id);
          }
          showToast(`Тег "${tagName}" уже существует и был добавлен к задаче`);
        } else {
          // Добавляем новый кастомный тег
          newTask.value.customTags.push(tagName);
        }

        newTask.value.customTag = '';
      }
    };

    const removeCustomTag = (tagToRemove) => {
      newTask.value.customTags = newTask.value.customTags.filter(tag => tag !== tagToRemove);
    };

    const applyTagFilter = () => {
      // Фильтрация применяется автоматически через computed свойство
    };

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
        // Сначала создаем новые кастомные теги, если они есть
        const createdTagIds = [];

        if (newTask.value.customTags.length > 0) {
          for (const tagName of newTask.value.customTags) {
            try {
              const response = await api.createTag({ name: tagName });
              createdTagIds.push(response.data.id);
              console.log(`Создан тег: ${tagName} с ID: ${response.data.id}`);
            } catch (error) {
              console.error(`Ошибка при создании тега ${tagName}:`, error);
              // Если тег уже существует, просто продолжаем
              if (error.response?.status === 400) {
                // Можно попробовать найти существующий тег по имени
                const existingTag = availableTags.value.find(tag => tag.name === tagName);
                if (existingTag) {
                  createdTagIds.push(existingTag.id);
                }
              }
            }
          }
        }

        // Объединяем выбранные теги и созданные кастомные теги
        const allTagIds = [...newTask.value.selectedTagIds, ...createdTagIds];

        console.log('Все ID тегов для задачи:', allTagIds);
        console.log('Имена кастомных тегов:', newTask.value.customTags);

        const taskData = {
          title: newTask.value.title,
          description: newTask.value.description,
          deadline: newTask.value.deadline,
          priority: newTask.value.priority,
          tagIds: allTagIds,
          tagNames: newTask.value.customTags.length > 0 ? newTask.value.customTags : null
        };

        console.log('Данные для создания задачи:', taskData);

        await api.createTask(taskData);
        showCreateModal.value = false;
        showToast('Задача успешно создана');
        await fetchTasks();

        // Сброс формы
        newTask.value = {
          title: '',
          description: '',
          deadline: '',
          priority: 'MEDIUM',
          selectedTagIds: [],
          customTags: [],
          customTag: ''
        };

        // Обновляем список доступных тегов
        await fetchAvailableTags();

      } catch (error) {
        console.error('Ошибка при создании задачи:', error);
        let errorMessage = 'Не удалось создать задачу';

        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }

        showToast(errorMessage, 'error');
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
      availableTags,
      selectedTagFilter,
      formatDate,
      getStatusText,
      getPriorityText,
      getInitials,
      getTagClass,
      toggleTagSelection,
      addCustomTag,
      removeCustomTag,
      applyTagFilter,
      viewTask,
      openStatusModal,
      openShareModal,
      selectMember,
      updateTaskStatus,
      shareTask,
      createTask,
      assignTask,
      filteredAvailableTags,
      tagSearch,
      isSelectedMemberHasTask,
      usersWithSharedTask,
      usersWithTaskLoading,
      toast,
      hideToast,
      applyExpiredFilter,
      hideExpiredTasks,
      isTaskExpired
    };
  }
};
</script>

<style scoped>
/* Базовые стили */
.tasks-container {
  padding: 20px;
}

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

/* Заголовок и кнопки */
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

/* Фильтры */
.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-select {
  padding: 10px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-select:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.filter-select:hover {
  border-color: #bdbdbd;
}

.filter-select:not([value=""]) {
  border-color: #4CAF50;
  background-color: #f8fff9;
}

/* Список задач */
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

/* Мета-информация задачи */
.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
}

/* Статусы */
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

.status-locked {
  font-size: 0.8em;
  color: #6c757d;
  background-color: #e9ecef;
  padding: 5px 10px;
  border-radius: 4px;
  margin-top: 5px;
  display: inline-block;
}

/* Действия с задачами */
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

.share {
  background-color: #9c27b0;
  color: white;
}

/* Теги */
.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 10px 0;
}

.tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 500;
  color: white;
}

/* Цвета для тегов */
.tag-primary { background-color: #007bff; }
.tag-secondary { background-color: #6c757d; }
.tag-success { background-color: #28a745; }
.tag-warning { background-color: #ffc107; color: #000; }
.tag-danger { background-color: #dc3545; }
.tag-info { background-color: #17a2b8; }

.no-tags {
  margin: 10px 0;
}

.no-tags-text {
  font-size: 0.9em;
  color: #6c757d;
  font-style: italic;
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
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.close {
  float: right;
  font-size: 24px;
  cursor: pointer;
}

/* Формы */
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

.member-item.has-task {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.member-item.has-task:hover,
.member-item.has-task.selected {
  background-color: #f5f5f5;
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

.no-members {
  padding: 20px;
  text-align: center;
  color: #666;
}

/* Стили для выбора тегов при создании */
.tags-selection {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.available-tags-container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fafafa;
  margin-bottom: 15px;
}

.available-tags-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.9em;
  font-weight: 500;
  color: #666;
}

.tags-search {
  flex-shrink: 0;
}

.tag-search-input {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85em;
  width: 150px;
}

.tag-search-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.available-tags-scrollable {
  max-height: 150px;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Кастомный скроллбар */
.available-tags-scrollable::-webkit-scrollbar {
  width: 6px;
}

.available-tags-scrollable::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.available-tags-scrollable::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.available-tags-scrollable::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Выбираемые теги */
.tag-selectable {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: white;
  user-select: none;
  flex-shrink: 0;
}

.tag-selectable:hover {
  background-color: #f8f9fa;
  border-color: #bdbdbd;
  transform: translateY(-1px);
}

.tag-selectable.selected {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.tag-selectable.search-match {
  background-color: #fff3cd;
  border-color: #ffc107;
}

.selected-indicator {
  font-weight: bold;
  font-size: 0.9em;
}

/* Блок кастомных тегов */
.custom-tags-section {
  border-top: 1px solid #e0e0e0;
  padding-top: 15px;
}

.tag-input-container {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tag-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9em;
}

.tag-input:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.add-tag-btn {
  padding: 8px 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.add-tag-btn:hover {
  background-color: #218838;
}

.custom-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.custom-tags-label {
  font-size: 0.85em;
  color: #6c757d;
  margin-right: 8px;
  font-weight: 500;
}

.custom-tag {
  position: relative;
  padding: 6px 25px 6px 12px;
  background-color: #17a2b8;
  color: white;
  border-radius: 20px;
  font-size: 0.85em;
  display: inline-flex;
  align-items: center;
}

.remove-tag {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  font-weight: bold;
  font-size: 1.1em;
  opacity: 0.8;
}

.remove-tag:hover {
  opacity: 1;
}

.no-tags-available {
  padding: 10px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
  background-color: #f8f9fa;
  border-radius: 4px;
  width: 100%;
}

/* Адаптивность */
@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-select {
    min-width: auto;
    width: 100%;
  }

  .available-tags-header {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .tags-search {
    width: 100%;
  }

  .tag-search-input {
    width: 100%;
  }

  .available-tags-scrollable {
    max-height: 120px;
  }

  .task-tags {
    gap: 3px;
  }

  .tag {
    font-size: 0.7em;
    padding: 2px 6px;
  }

  .tag-selectable {
    font-size: 0.8em;
    padding: 3px 8px;
  }
}
.hide-expired-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  user-select: none;
}

.hide-expired-checkbox input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 2px solid #4CAF50;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.checkmark:after {
  content: "✓";
  color: white;
  font-size: 12px;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.hide-expired-checkbox input[type="checkbox"]:checked + .checkmark {
  background-color: #4CAF50;
  border-color: #4CAF50;
}

.hide-expired-checkbox input[type="checkbox"]:checked + .checkmark:after {
  opacity: 1;
}

.hide-expired-checkbox:hover .checkmark {
  border-color: #45a049;
}

.hide-expired-checkbox input[type="checkbox"]:checked:hover + .checkmark {
  background-color: #45a049;
  border-color: #45a049;
}

/* Стиль для просроченных задач */
.deadline.expired {
  color: #dc3545;
  font-weight: bold;
}

.expired-badge {
  background-color: #dc3545;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7em;
  margin-left: 5px;
}

/* Адаптивность для нового элемента */
@media (max-width: 768px) {
  .hide-expired-checkbox {
    width: 100%;
    justify-content: flex-start;
    margin-top: 10px;
  }
}
</style>