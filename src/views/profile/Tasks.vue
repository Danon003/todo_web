<template>
  <div class="tasks-container">
    <!-- Тосты для уведомлений (без изменений) -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <div class="tasks-header">
      <h2>Задачи</h2>
      <div class="header-actions">
        <button v-if="user.role === 'ROLE_TEACHER'" @click="showCreateModal = true" class="create-btn">
        Создать задачу
        </button>
        <button v-if="user.role === 'ROLE_STUDENT'"
              @click="clearOverdueTasks"
              class="clear-overdue-btn"
              :disabled="clearOverdueTasks">
        🗑️ Очистить просроченные
        </button>
        <button v-if="user.role === 'ROLE_TEACHER'"
                @click="openBulkAssignModal"
                class="action-btn bulk-assign">
          Массовое назначение
        </button>
      </div>
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
            @change="onHideExpiredChange"
        >
        <span class="checkmark"></span>
        Скрыть просроченные задачи
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
          <div v-if="user.role === 'ROLE_STUDENT' && !isTaskExpired(task)" class="priority-select">
            <select
                v-model="task.priority"
                @change="changePriority(task)"
                class="priority-selector"
                :class="{
                      'priority-high': task.priority === 'HIGH',
                      'priority-medium': task.priority === 'MEDIUM',
                       'priority-low': task.priority === 'LOW'
                     }"
                >
              <option value="HIGH">🔴 Высокий</option>
              <option value="MEDIUM">🟡 Средний</option>
              <option value="LOW">🟢 Низкий</option>
            </select>
          </div>
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

    <div
        v-if="tasksTotalPages > 1"
        class="pagination tasks-pagination"
    >
      <button
          class="pagination-btn"
          @click="prevTasksPage"
          :disabled="tasksCurrentPage === 1"
      >
        ← Назад
      </button>
      <span class="pagination-info">
        Страница {{ tasksCurrentPage }} из {{ tasksTotalPages }}
        (всего: {{ tasksTotalElements }} задач)
      </span>
      <button
          class="pagination-btn"
          @click="nextTasksPage"
          :disabled="tasksCurrentPage === tasksTotalPages"
      >
        Вперёд →
      </button>
      <select
          v-model="tasksPageSize"
          @change="changeTasksPageSize"
          class="page-size-select"
      >
        <option :value="10">10 на странице</option>
        <option :value="20">20 на странице</option>
        <option :value="50">50 на странице</option>
      </select>
    </div>

    <!-- Модальное окно массового назначения -->
    <div v-if="showBulkAssignModal" class="modal" @click.self="closeBulkAssignModal">
      <div class="modal-content large-modal">
        <span class="close" @click="closeBulkAssignModal">&times;</span>
        <h3>Массовое назначение задач</h3>

        <!-- Выбор задач -->
        <div class="form-group">
          <label>Выберите задачи:</label>
          <div class="tasks-list-select">
            <div v-for="task in availableTasks" :key="task.id" class="task-select-item">
              <label>
                <input type="checkbox" v-model="selectedTaskIds" :value="task.id">
                {{ task.title }} (Дедлайн: {{ formatDate(task.deadline) }})
              </label>
            </div>
          </div>
        </div>

        <!-- Выбор групп -->
        <label>Выберите группы:</label>
        <div class="groups-list-select">
          <div v-for="group in availableGroups" :key="group.id" class="group-select-item">
            <label>
              <input type="checkbox" v-model="selectedGroupIds" :value="group.id">
              {{ group.name }}
            </label>
          </div>
        </div>
      </div><div class="form-group">


        <div class="form-actions">
          <button @click="closeBulkAssignModal" class="cancel-btn">Отмена</button>
          <button @click="executeBulkAssign" class="submit-btn"
                  :disabled="bulkAssignLoading || selectedTaskIds.length === 0 || selectedGroupIds.length === 0">
            {{ bulkAssignLoading ? 'Назначение...' : `Назначить ${selectedTaskIds.length} задач ${selectedGroupIds.length} группам` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания задачи -->
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
    const tasksCurrentPage = ref(1);
    const tasksPageSize = ref(20);
    const tasksTotalElements = ref(0);
    const filterStatus = ref('all');
    const sortField = ref('deadline');
    const showCreateModal = ref(false);
    const showShareModal = ref(false);
    const currentTask = ref({});
    const selectedStatus = ref('NOT_STARTED');
    const usersWithSharedTask = ref([]);
    const usersWithTaskLoading = ref(false);

    // Новые переменные для тегов
    const availableTags = ref([]);
    const selectedTagFilter = ref('');
    const tagSearch = ref('');
    const hideExpiredTasks = ref(true);
    const showPriorityModal = ref(false);
    const selectedPriority = ref('MEDIUM');
    const clearingOverdue = ref(false);
    const updatingPriority = ref(false);
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

    const showBulkAssignModal = ref(false)
    const availableTasks = ref([])
    const availableGroups = ref([])
    const selectedTaskIds = ref([])
    const selectedGroupIds = ref([])
    const bulkAssignLoading = ref(false)

    const openBulkAssignModal = async () => {
      // Загружаем доступные задачи и группы
      await Promise.all([
        fetchAvailableTasks(),
        fetchAvailableGroups()
      ])
      selectedTaskIds.value = []
      selectedGroupIds.value = []
      showBulkAssignModal.value = true
    }

    // const fetchAvailableTasks = async () => {
    //   try {
    //     const response = await api.getTasks(0, 100) // Загружаем все задачи для выбора
    //     const data = response.data
    //     availableTasks.value = data.content || data || []
    //   } catch (error) {
    //     showToast('Не удалось загрузить задачи', 'error')
    //   }
    // }

    const fetchAvailableTasks = async () => {
      try {
        const response = await api.getActiveTasks(0, 20) // Загружаем все задачи для выбора
        const data = response.data
        availableTasks.value = data.content || data || []
      } catch (error) {
        showToast('Не удалось загрузить задачи', 'error')
      }
    }

    const fetchAvailableGroups = async () => {
      try {
        const response = await api.getGroups(0, 100)
        const data = response.data
        availableGroups.value = data.content || data || []
      } catch (error) {
        showToast('Не удалось загрузить группы', 'error')
      }
    }

    const executeBulkAssign = async () => {
      if (selectedTaskIds.value.length === 0 || selectedGroupIds.value.length === 0) {
        showToast('Выберите хотя бы одну задачу и одну группу', 'warning')
        return
      }

      bulkAssignLoading.value = true
      try {
        const response = await api.bulkAssignToGroups(
            selectedTaskIds.value,
            selectedGroupIds.value
        )
        showToast(`Назначено: ${response.data.created} задач, пропущено: ${response.data.skipped}`)
        closeBulkAssignModal()
        // Обновляем список задач при необходимости
      } catch (error) {
        console.error('Ошибка при массовом назначении:', error)
        showToast('Не удалось выполнить массовое назначение', 'error')
      } finally {
        bulkAssignLoading.value = false
      }
    }

    const closeBulkAssignModal = () => {
      showBulkAssignModal.value = false
      selectedTaskIds.value = []
      selectedGroupIds.value = []
    }

    const clearOverdueTasks = async () => {
      if (!confirm('Вы уверены, что хотите удалить все просроченные задачи? Это действие необратимо.')) {
        return
      }

      clearingOverdue.value = true
      try {
        await api.deleteOverdueTasks()
        showToast('Просроченные задачи успешно удалены')
        await fetchTasks() // Обновляем список
      } catch (error) {
        console.error('Ошибка при удалении просроченных задач:', error)
        showToast('Не удалось удалить просроченные задачи', 'error')
      } finally {
        clearingOverdue.value = false
      }
    }
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
      let tasksToProcess = [];

      // Определяем источник задач
      if (useClientPagination.value && hideExpiredTasks.value) {
        tasksToProcess = [...allTasksRaw.value];
      } else {
        tasksToProcess = [...tasks.value];
      }

      // Фильтр по статусу
      if (filterStatus.value !== 'all') {
        tasksToProcess = tasksToProcess.filter(task => task.userStatus === filterStatus.value);
      }

      // Фильтр по тегу
      if (selectedTagFilter.value) {
        tasksToProcess = tasksToProcess.filter(task => {
          if (!task.tags || task.tags.length === 0) return false;
          return task.tags.some(tag => {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            return tagName === selectedTagFilter.value;
          });
        });
      }

      // Фильтр прошедших (уже применён через allTasksRaw, но для единообразия оставим)
      if (hideExpiredTasks.value) {
        tasksToProcess = tasksToProcess.filter(task => !isTaskExpired(task));
      }

      // Сортировка
      tasksToProcess.sort((a, b) => {
        if (sortField.value === 'deadline') {
          return new Date(a.deadline) - new Date(b.deadline);
        } else {
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
      });

      // Клиентская пагинация
      if (useClientPagination.value && hideExpiredTasks.value) {
        const start = (tasksCurrentPage.value - 1) * tasksPageSize.value;
        const end = start + tasksPageSize.value;
        return tasksToProcess.slice(start, end);
      }

      return tasksToProcess;
    });

    // Новый метод для применения фильтра прошедших задач
    const applyExpiredFilter = () => {
      tasksCurrentPage.value = 1;
      fetchTasks(); // перезагрузит все задачи, если фильтр включён
    };
    // Переменные для функционала "Поделиться"
    const groupMembers = ref([]);
    const groupMembersLoading = ref(false);
    const memberSearch = ref('');
    const selectedMember = ref(null);
    const sharingInProgress = ref(false);
    const taskToShare = ref(null);

    const allTasksRaw = ref([]);        // все задачи (для режима с фильтром)
    const useClientPagination = ref(false); // используем клиентскую пагинацию

    const fetchTasks = async () => {
      try {
        let response

        // Для преподавателя
        if (user.role === 'ROLE_TEACHER') {
          if (hideExpiredTasks.value) {
            // Чекбокс включен - показываем только активные задачи
            response = await api.getActiveTasks(tasksCurrentPage.value - 1, tasksPageSize.value)
          } else {
            // Чекбокс выключен - показываем все задачи
            response = await api.getTasks(tasksCurrentPage.value - 1, tasksPageSize.value)
          }

          const data = response.data
          if (data && Array.isArray(data.content)) {
            tasks.value = data.content
            tasksTotalElements.value = data.totalElements ?? data.content.length
            tasksTotalPages.value = data.totalPages ?? 1
          } else if (Array.isArray(data)) {
            tasks.value = data
            tasksTotalElements.value = data.length
            tasksTotalPages.value = 1
          }
          useClientPagination.value = false
          return
        }

        // Для студента
        if (user.role === 'ROLE_STUDENT') {
          if (hideExpiredTasks.value) {
            // Чекбокс включен - показываем только активные задачи
            response = await api.getMyActiveTasks(
                tasksCurrentPage.value - 1,
                tasksPageSize.value
            )
          } else {
            // Чекбокс выключен - показываем все задачи
            response = await api.getMyTasks(
                tasksCurrentPage.value - 1,
                tasksPageSize.value
            )
          }

          const data = response.data
          tasks.value = data.content
          tasksTotalElements.value = data.totalElements
          tasksTotalPages.value = data.totalPages
          useClientPagination.value = false
        }
      } catch (error) {
        console.error('Ошибка при получении задач:', error)
        showToast('Не удалось загрузить задачи', 'error')
      }
    }

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
    const tasksTotalPages = computed(() => {
      return tasksPageSize.value > 0
          ? Math.ceil(tasksTotalElements.value / tasksPageSize.value)
          : 0;
    });

    const nextTasksPage = () => {
      if (tasksCurrentPage.value < tasksTotalPages.value) {
        tasksCurrentPage.value += 1;
        fetchTasks();
      }
    };

    const prevTasksPage = () => {
      if (tasksCurrentPage.value > 1) {
        tasksCurrentPage.value -= 1;
        fetchTasks();
      }
    };

    const changeTasksPageSize = () => {
      tasksCurrentPage.value = 1;
      fetchTasks();
    };


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
    const changePriority = async (task) => {
      const oldPriority = task.priority
      try {
        await api.updateTaskPriority(task.id, task.priority)
        showToast(`Приоритет изменен на ${getPriorityText(task.priority)}`)
      } catch (error) {
        console.error('Ошибка при изменении приоритета:', error)
        // Откатываем изменение
        task.priority = oldPriority
        showToast('Не удалось изменить приоритет', 'error')
      }
    }
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
      // Сохраняем всё состояние
      localStorage.setItem('tasksCurrentPage', tasksCurrentPage.value);
      localStorage.setItem('tasksHideExpired', hideExpiredTasks.value);
      localStorage.setItem('tasksSortField', sortField.value);
      localStorage.setItem('tasksSelectedTag', selectedTagFilter.value);
      localStorage.setItem('tasksPageSize', tasksPageSize.value);


      router.push(`/profile/tasks/${taskId}`);
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

    const onHideExpiredChange = () => {
      tasksCurrentPage.value = 1 // Сбрасываем на первую страницу
      fetchTasks() // Перезагружаем задачи с новым фильтром
    }

    const assignTask = (taskId) => {
      console.log('Назначить задачу', taskId);
    };
    onMounted(async () => {
      const savedPage = localStorage.getItem('tasksCurrentPage');
      const savedHideExpired = localStorage.getItem('tasksHideExpired');
      const savedSortField = localStorage.getItem('tasksSortField');
      const savedSelectedTag = localStorage.getItem('tasksSelectedTag');
      const savedPageSize = localStorage.getItem('tasksPageSize');

      if (savedPage) tasksCurrentPage.value = parseInt(savedPage);
      if (savedSortField) sortField.value = savedSortField;
      if (savedSelectedTag) selectedTagFilter.value = savedSelectedTag;
      if (savedPageSize) tasksPageSize.value = parseInt(savedPageSize);

      await fetchTasks();
      await fetchAvailableTags();
    });

    return {
      tasks,
      tasksCurrentPage,
      tasksPageSize,
      tasksTotalElements,
      tasksTotalPages,
      nextTasksPage,
      prevTasksPage,
      changeTasksPageSize,
      filteredTasks,
      filterStatus,
      sortField,
      showCreateModal,
      showShareModal,
      currentTask,
      selectedStatus,
      newTask,
      user,
      fetchTasks,
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
      changePriority,
      removeCustomTag,
      applyTagFilter,
      viewTask,
      openShareModal,
      selectMember,
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
      clearOverdueTasks,
      applyExpiredFilter,
      hideExpiredTasks,
      isTaskExpired,
      executeBulkAssign,
      closeBulkAssignModal,
      fetchAvailableGroups,
      fetchAvailableTasks,
      openBulkAssignModal,
      onHideExpiredChange,
      showBulkAssignModal,
      availableTasks,
      selectedTaskIds,
      availableGroups,
      selectedGroupIds,
      bulkAssignLoading,
    };
  }
};
</script>

<style scoped>
/* Базовые стили */
.tasks-container {
  padding: 20px;
  background: var(--bg-primary);
  color: var(--text-primary);
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
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 150px;
  box-shadow: var(--shadow-sm);
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-success);
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.15);
}

.filter-select:hover {
  border-color: #bdbdbd;
}

.filter-select:not([value=""]) {
  border-color: var(--color-success);
  background-color: var(--bg-secondary);
}

/* Список задач */
.tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.task-card {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 15px;
  box-shadow: var(--shadow-sm);
}

/* Мета-информация задачи */
.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  font-size: 0.9em;
  color: var(--text-secondary);
}

/* Статусы */
.status {
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.status-not_started {
  background-color: var(--task-not-started);
  color: var(--task-not-started-text);
}

.status-overdue {
  background-color: var(--task-overdue);
  color: var(--task-overdue-text);
}

.status-in_progress {
  background-color: var(--task-in-progress);
  color: var(--task-in-progress-text);
}

.status-completed {
  background-color: var(--task-completed);
  color: var(--task-completed-text);
}

.status-locked {
  font-size: 0.8em;
  color: var(--text-secondary);
  background-color: var(--bg-tertiary);
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
  background: var(--bg-card);
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
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);
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
  border: 1px solid #ffffff;
  border-radius: 4px;
  padding: 10px;
}
.available-tags-container {
  border: 1px solid;
  border-radius: 8px;
  background-color: var(--bg-primary);
  margin-bottom: 15px;
}

.available-tags-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: var(--bg-primary);
  border-bottom: 1px solid #000000;
  font-size: 0.9em;
  font-weight: 500;
  color: var(--text-primary);
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
  border-color: #00ff0b;
}

.available-tags-scrollable {
  max-height: 150px;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--text-primary);
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

.tag-selectable {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #464242;
  border-radius: 20px;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #1f792e;
  user-select: none;
  flex-shrink: 0;
}

.tag-selectable:hover {
  background-color: #9dc05f;
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

/* Пагинация */
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
/* Для кнопки очистки просрочки */
.clear-overdue-btn {
  background-color: #dc3545;
  color: white;
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
}

.clear-overdue-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.clear-overdue-btn:disabled {
  background-color: #e9a2aa;
  cursor: not-allowed;
}

/* Для селектора приоритета */
.priority-selector {
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  cursor: pointer;
}
.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.clear-overdue-btn {
  background-color: #dc3545;
  color: white;
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.clear-overdue-btn:hover:not(:disabled) {
  background-color: #c82333;
}

.clear-overdue-btn:disabled {
  background-color: #e9a2aa;
  cursor: not-allowed;
}

.priority-select {
  margin: 0;
}

.priority-selector {
  padding: 5px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85em;
}

.priority-selector:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.priority-edit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 15px;
}

.priority-edit label {
  font-size: 0.9em;
  color: var(--text-secondary);
}
/* Для массового назначения */
.tasks-list-select,
.groups-list-select {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 10px;
}

.task-select-item,
.group-select-item {
  padding: 5px;
  margin-bottom: 5px;
}

.task-select-item label,
.group-select-item label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.bulk-assign {
  background-color: #4caf50 !important;
}

.bulk-assign:hover {
  background-color: #4caf50 !important;
}
/* Адаптивность для нового элемента */
@media (max-width: 768px) {
  .hide-expired-checkbox {
    width: 100%;
    justify-content: flex-start;
    margin-top: 10px;
  }

  .pagination {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
}


/* ============================================ */
/* Стили для модального окна массового назначения */
/* ============================================ */

/* ============================================ */
/* Стили для модального окна массового назначения */
/* ============================================ */

/* Модальное окно */
.modal-content.large-modal {
  width: 650px;
  max-width: 90vw;
  max-height: 85vh;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

/* Заголовок модалки */
.modal-content.large-modal h3 {
  margin: 0;
  padding: 20px 24px;
  background-color: #4caf50 !important;
  color: white;
  font-size: 1.3rem;
  font-weight: 600;
}

/* Закрыть */
.modal-content.large-modal .close {
  position: absolute;
  top: 16px;
  right: 20px;
  font-size: 28px;
  color: white;
  opacity: 0.8;
  z-index: 10;
  cursor: pointer;
}

.modal-content.large-modal .close:hover {
  opacity: 1;
}

/* Контент модалки (скроллится) */
.modal-content.large-modal > :not(h3) {
  padding: 0 24px;
}

/* Группы форм */
.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

/* Список задач и групп */
.tasks-list-select,
.groups-list-select {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  padding: 8px;
}

/* Стилизация скроллбара */
.tasks-list-select::-webkit-scrollbar,
.groups-list-select::-webkit-scrollbar {
  width: 6px;
}

.tasks-list-select::-webkit-scrollbar-track,
.groups-list-select::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.tasks-list-select::-webkit-scrollbar-thumb,
.groups-list-select::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.tasks-list-select::-webkit-scrollbar-thumb:hover,
.groups-list-select::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Элемент задачи/группы */
.task-select-item,
.group-select-item {
  padding: 10px 12px;
  margin-bottom: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.task-select-item:hover,
.group-select-item:hover {
  background: var(--bg-hover);
  border-color: #4caf50;
  transform: translateX(2px);
}

.task-select-item:last-child,
.group-select-item:last-child {
  margin-bottom: 0;
}

/* Чекбокс и метка */
.task-select-item label,
.group-select-item label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  margin: 0;
  font-weight: normal;
}

.task-select-item input[type="checkbox"],
.group-select-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #4caf50;
  flex-shrink: 0;
}

/* Заголовок задачи */
.task-title {
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  font-size: 0.95rem;
}

/* Дедлайн задачи */
.task-deadline {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 12px;
}

/* Название группы */
.group-select-item label span:first-of-type {
  font-weight: 500;
  color: var(--text-primary);
}

/* Пустой список */
.empty-list {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-style: italic;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

/* Секция с количеством выбранных */
.selection-summary {
  margin: 20px 0;
  padding: 16px;
  background: rgba(76, 175, 80, 0.1);
  border-left: 4px solid #4caf50;
  border-radius: 10px;
}

.selection-summary p {
  margin: 6px 0;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.selection-summary p:first-child {
  margin-top: 0;
}

.selection-summary p:last-child {
  margin-bottom: 0;
}

.selection-summary strong {
  color: #4caf50;
  font-size: 1.05rem;
}

/* Кнопки действий - ВЕРТИКАЛЬНОЕ РАСПОЛОЖЕНИЕ */
.form-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px;
  margin-top: 10px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.form-actions button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

/* Кнопка Отмена */
.cancel-btn {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  order: 2; /* Отмена будет второй (снизу) */
}

.cancel-btn:hover {
  background: var(--border-color);
  transform: translateY(-1px);
}

/* Кнопка Назначить */
.submit-btn {
  background-color: #4caf50 !important;
  color: white;
  order: 1; /* Назначить будет первым (сверху) */
}

.submit-btn:hover:not(:disabled) {
  background-color: #45a049 !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.submit-btn:disabled {
  background-color: #cccccc !important;
  cursor: not-allowed;
  transform: none;
}

/* Кнопка массового назначения на основной странице */
.bulk-assign {
  background-color: #4caf50 !important;
  padding: 10px 20px !important;
  color: white !important;
}

.bulk-assign:hover {
  background-color: #45a049 !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
  color: white !important;
}

/* Анимация для модалки */
.modal {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content.large-modal {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Эффект при выборе чекбокса */
.task-select-item:has(input:checked),
.group-select-item:has(input:checked) {
  background: rgba(76, 175, 80, 0.1);
  border-color: #4caf50;
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .modal-content.large-modal {
    width: 95%;
    max-height: 90vh;
  }

  .modal-content.large-modal h3 {
    padding: 16px 20px;
    font-size: 1.1rem;
  }

  .task-select-item label,
  .group-select-item label {
    flex-wrap: wrap;
    gap: 8px;
  }

  .task-deadline {
    margin-left: 30px;
  }

  .form-actions {
    padding: 16px 20px;
  }

  .form-actions button {
    padding: 10px 20px;
    font-size: 0.95rem;
  }

  .selection-summary {
    padding: 12px;
  }

  .selection-summary p {
    font-size: 0.85rem;
  }

  .tasks-list-select,
  .groups-list-select {
    max-height: 200px;
  }
}
  /* ============================================ */
  /* Стили для выбора приоритета */
  /* ============================================ */

  /* Контейнер для выбора приоритета */
  .priority-select {
    margin: 0;
    display: inline-block;
  }

  /* Селектор приоритета */
  .priority-selector {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--input-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 500;
    transition: all 0.2s ease;
    outline: none;
  }

  .priority-selector:hover {
    border-color: #4caf50;
    background: var(--bg-hover);
  }

  .priority-selector:focus {
    border-color: #4caf50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
  }

  .priority-selector:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Стили для опций приоритета */
  .priority-selector option[value="HIGH"] {
    color: #dc3545;
    font-weight: bold;
  }

  .priority-selector option[value="MEDIUM"] {
    color: #ffc107;
  }

  .priority-selector option[value="LOW"] {
    color: #28a745;
  }

  /* Альтернативный вариант - кнопки для выбора приоритета */
  .priority-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .priority-btn {
    padding: 4px 12px;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-size: 0.8em;
    transition: all 0.2s ease;
  }

  .priority-btn.high {
    color: #dc3545;
  }

  .priority-btn.high.active {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }

  .priority-btn.medium {
    color: #ffc107;
  }

  .priority-btn.medium.active {
    background: #ffc107;
    color: #856404;
    border-color: #ffc107;
  }

  .priority-btn.low {
    color: #28a745;
  }

  .priority-btn.low.active {
    background: #28a745;
    color: white;
    border-color: #28a745;
  }

  .priority-btn:hover:not(.active) {
    background: var(--bg-hover);
    transform: translateY(-1px);
  }

  /* Отображение приоритета в карточке задачи */
  .task-meta .priority {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.75em;
    font-weight: 600;
  }

  /* Цвета для приоритета в мета-информации */
  .task-meta .priority[class*="HIGH"],
  .priority-high {
    background: rgba(220, 53, 69, 0.15);
    color: #dc3545;
  }

  .task-meta .priority[class*="MEDIUM"],
  .priority-medium {
    background: rgba(255, 193, 7, 0.15);
    color: #856404;
  }

  .task-meta .priority[class*="LOW"],
  .priority-low {
    background: rgba(40, 167, 69, 0.15);
    color: #28a745;
  }

  /* Бейдж приоритета в карточке */
  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.7em;
    font-weight: 600;
  }


  /* Анимация при изменении приоритета */
  @keyframes priorityChange {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }

  .priority-selector:active {
    animation: priorityChange 0.2s ease;
  }
/* Улучшенные стили для карточки задачи */
.task-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 18px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid var(--border-color-light);
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Заголовок задачи */
.task-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

/* Описание задачи */
.task-card p {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}



/* Кнопка просмотра */
.action-btn.view {
  background-color: #4caf50;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85em;
}

.action-btn.view:hover {
  background-color: #45a049;
  transform: translateY(-1px);
}

/* Кнопка поделиться */
.action-btn.share {
  background-color: #9c27b0;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85em;
}

.action-btn.share:hover:not(:disabled) {
  background-color: #7b1fa2;
  transform: translateY(-1px);
}

.action-btn.share:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


/* Карточка задачи */
.task-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 18px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

/* Заголовок */
.task-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: var(--text-primary);
  flex-shrink: 0;
}

/* Описание - растягивается */
.task-card p {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex-grow: 1;
}

/* Теги */
.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 10px 0;
  flex-shrink: 0;
}

/* Мета информация */
.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
  font-size: 0.85em;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* Кнопки - всегда внизу */
.task-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border-color-light);
  flex-shrink: 0;
  flex-wrap: nowrap;
}

/* Кнопки сжимаются */
.task-actions .action-btn {
  padding: 6px 8px;
  font-size: 0.75em;
  flex-shrink: 1;
  min-width: 0;
  white-space: nowrap;
}

/* Текст внутри кнопок не переносится */
.action-btn span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.priority-select {
  margin: 0;
  display: inline-block;
}

.priority-selector {
  padding: 10px 15px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-card);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
  box-shadow: var(--shadow-sm);
  color: var(--text-primary);
}

.priority-selector {
  outline: none;
  border-color: var(--color-success);
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.15);
}

.priority-selector:hover {
  border-color: #bdbdbd;
}

.priority-selector {
  padding: 5px 6px;
  font-size: 0.75em;
  flex-shrink: 1;
  min-width: 70px;
  max-width: 100px;
}
/* Цвета для опций приоритета */
.priority-selector option[value="HIGH"] {
  color: #dc3545;
  font-weight: 500;
}

.priority-selector option[value="MEDIUM"] {
  color: #ffc107;
  font-weight: 500;
}

.priority-selector option[value="LOW"] {
  color: #28a745;
  font-weight: 500;
}

/* Отображение текущего выбранного значения с цветом */
.priority-selector.priority-high {
  color: #dc3545;
  font-weight: 500;
}

.priority-selector.priority-medium {
  color: #ffc107;
  font-weight: 500;
}

.priority-selector.priority-low {
  color: #28a745;
  font-weight: 500;
}

/* Адаптивность для мобильных устройств */
@media (max-width: 768px) {
  .priority-selector {
    min-width: auto;
    width: 100%;
    padding: 8px 12px;
    font-size: 12px;
  }

  .task-actions {
    flex-wrap: wrap;
  }

  .priority-select {
    width: 100%;
  }
}

</style>