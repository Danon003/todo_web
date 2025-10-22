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

    <!-- Модальное окно редактирования задачи -->
    <div v-if="showEditModal" class="modal">
      <div class="modal-content large-modal">
        <span class="close" @click="closeEditModal">&times;</span>
        <h3>Редактировать задачу</h3>
        <form @submit.prevent="updateTask">
          <div class="form-group">
            <label>Название:</label>
            <input v-model="editTask.title" type="text" required>
          </div>
          <div class="form-group">
            <label>Описание:</label>
            <textarea v-model="editTask.description" required></textarea>
          </div>
          <div class="form-group">
            <label>Дедлайн:</label>
            <input v-model="editTask.deadline" type="datetime-local" required>
          </div>
          <div class="form-group">
            <label>Приоритет:</label>
            <select v-model="editTask.priority" required>
              <option value="LOW">Низкий</option>
              <option value="MEDIUM">Средний</option>
              <option value="HIGH">Высокий</option>
            </select>
          </div>

          <!-- Блок тегов при редактировании -->
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
                        selected: editTask.selectedTagIds.includes(tag.id),
                        'search-match': tagSearch && tag.name.toLowerCase().includes(tagSearch.toLowerCase())
                      }"
                      @click="toggleTagSelection(tag.id)"
                  >
                    {{ tag.name }}
                    <span v-if="editTask.selectedTagIds.includes(tag.id)" class="selected-indicator">✓</span>
                  </span>
                </div>
              </div>

              <!-- Блок добавления новых тегов -->
              <div class="custom-tags-section">
                <div class="tag-input-container">
                  <input
                      v-model="editTask.customTag"
                      type="text"
                      placeholder="Добавить новый тег..."
                      @keydown.enter.prevent="addCustomTag"
                      class="tag-input"
                  >
                  <button type="button" @click="addCustomTag" class="add-tag-btn">+</button>
                </div>

                <div v-if="editTask.customTags.length > 0" class="custom-tags">
                  <span class="custom-tags-label">Новые теги:</span>
                  <span
                      v-for="tag in editTask.customTags"
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

          <div class="form-actions">
            <button type="button" @click="closeEditModal" class="cancel-btn">Отмена</button>
            <button type="submit" class="submit-btn" :disabled="updatingTask">
              {{ updatingTask ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Модальное окно прикрепления файла -->
    <div v-if="showAttachModal" class="modal">
      <div class="modal-content">
        <span class="close" @click="closeAttachModal">&times;</span>
        <h3>Прикрепить файл к задаче</h3>

        <div class="file-upload-section">
          <div
              class="file-dropzone"
              @click="triggerFileInput"
              @drop="handleFileDrop"
              @dragover.prevent
              @dragenter.prevent
          >
            <div class="dropzone-content">
              <span class="upload-icon">📎</span>
              <p>Перетащите файл сюда или нажмите для выбора</p>
              <small>Максимальный размер: 10MB</small>
            </div>
            <input
                type="file"
                ref="fileInput"
                @change="handleFileSelect"
                style="display: none"
            >
          </div>

          <div v-if="selectedFile" class="file-preview">
            <div class="file-info">
              <span class="file-name">{{ selectedFile.name }}</span>
              <span class="file-size">({{ formatFileSize(selectedFile.size) }})</span>
              <button @click="removeFile" class="remove-file-btn">×</button>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" @click="closeAttachModal" class="cancel-btn">Отмена</button>
          <button
              @click="uploadFile"
              class="submit-btn"
              :disabled="!selectedFile || uploadingFile"
          >
            {{ uploadingFile ? 'Загрузка...' : 'Прикрепить файл' }}
          </button>
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

        <div class="task-info">
          <div class="info-item">
            <span class="label">Дедлайн:</span>
            <span class="value">{{ formatDate(task.deadline) }}</span>
          </div>
          <div class="info-item" v-if="task.files && task.files.length > 0">
            <span class="label">Файлов:</span>
            <span class="value">{{ task.files.length }}</span>
          </div>
        </div>
        <!-- Прикрепленные файлы - ОСНОВНОЙ БЛОК -->
        <div v-if="task.files && task.files.length > 0" class="attached-files-list">
          <h4>Прикрепленные файлы:</h4>
          <div v-for="file in task.files" :key="file.id" class="file-item">
            <span class="file-icon">📎</span>
            <span class="file-name">{{ file.originalFileName }}</span>
            <a :href="file.url" target="_blank" class="download-link">Скачать</a>
            <button
                v-if="user.role === 'ROLE_TEACHER'"
                @click="deleteFile(file.id)"
                class="delete-file-btn"
            >
              Удалить
            </button>
          </div>
        </div>

        <div v-if="showSolutionsModal" class="modal">
          <div class="modal-content large-modal">
            <span class="close" @click="showSolutionsModal = false">&times;</span>
            <h3>Решения студентов</h3>

            <div v-if="solutionsLoading" class="loading">Загрузка решений...</div>
            <div v-else class="solutions-list">
              <div v-for="solution in solutions" :key="solution.studentId" class="solution-item">
                <div class="student-info">
                  <div class="student-avatar">
                    {{ getInitials(solution.studentName) }}
                  </div>
                  <div class="student-details">
                    <h4>{{ solution.studentName }}</h4>
                    <div v-if="solution.fileName" class="solution-file">
                      <span class="file-icon">📄</span>
                      <span class="file-name">{{ solution.fileName }}</span>
                      <span class="file-size">({{ formatFileSize(solution.fileSize) }})</span>
                      <a @click="downloadStudentSolution(solution.studentId)" class="download-link">Скачать</a>
                    </div>
                    <div v-else class="no-solution">
                      <span class="no-solution-text">Решение не загружено</span>
                    </div>
                  </div>
                </div>

                <div class="grading-section">
                  <div class="grade-input">
                    <label>Оценка:</label>
                    <input
                        v-model="solution.grade"
                        type="number"
                        min="0"
                        max="100"
                        @change="updateGrade(solution)"
                        class="grade-field"
                    >
                  </div>
                  <div class="comment-input">
                    <label>Комментарий:</label>
                    <textarea
                        v-model="solution.teacherComment"
                        @change="updateGrade(solution)"
                        placeholder="Комментарий преподавателя..."
                        class="comment-field"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div v-if="solutions.length === 0" class="no-solutions">
                Нет назначенных студентов или решений
              </div>
            </div>
          </div>
        </div>

        <!-- блок для студента -->
        <div v-if="user.role === 'ROLE_STUDENT'" class="student-solution-section">
          <div class="solution-header">
            <h3>📝 Решение задачи</h3>
            <p class="solution-description">Загрузите файл с вашим решением. Преподаватель получит уведомление о новой работе.</p>
          </div>

          <!-- Состояние: решение уже загружено -->
          <div v-if="studentSolution" class="solution-uploaded">
            <div class="uploaded-header">
              <h4>✅ Решение загружено</h4>
              <span class="upload-date">{{ formatDate(studentSolution.uploadedAt) }}</span>
            </div>

            <div class="solution-file-card">
              <div class="file-info">
                <div class="file-icon-name">
                  <span class="file-icon">📄</span>
                  <div class="file-details">
                    <span class="file-name">{{ studentSolution.fileName }}</span>
                    <span class="file-size">{{ formatFileSize(studentSolution.fileSize) }}</span>
                  </div>
                </div>
                <div class="file-actions">
                  <a :href="studentSolution.downloadUrl" target="_blank" class="download-btn">
                    📥 Скачать
                  </a>
                  <button @click="deleteStudentSolution" class="delete-btn" title="Удалить решение">
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            <!-- Оценка преподавателя -->
            <div v-if="studentSolution.grade !== null || studentSolution.teacherComment" class="teacher-feedback">
              <h5>📊 Обратная связь от преподавателя:</h5>

              <div v-if="studentSolution.grade !== null" class="grade-badge">
                <span class="grade-label">Оценка:</span>
                <span class="grade-value">{{ studentSolution.grade }}/100</span>
              </div>

              <div v-if="studentSolution.teacherComment" class="comment-box">
                <span class="comment-label">Комментарий:</span>
                <p class="comment-text">{{ studentSolution.teacherComment }}</p>
              </div>
            </div>

            <div v-else class="waiting-feedback">
              <p>⏳ Ожидайте оценку от преподавателя...</p>
            </div>
          </div>

          <!-- Состояние: решение не загружено -->
          <div v-else class="solution-upload">
            <div class="upload-area">
              <div
                  class="upload-zone"
                  @click="triggerSolutionFileInput"
                  @drop="handleSolutionFileDrop"
                  @dragover.prevent
                  @dragenter.prevent
              >
                <div class="upload-content">
                  <div class="upload-icon">📤</div>
                  <h4>Загрузить решение</h4>
                  <p>Перетащите файл сюда или нажмите для выбора</p>
                  <div class="upload-hint">
                    <small>📎 Поддерживаемые форматы: PDF, DOC, DOCX, ZIP</small>
                    <small>⚡ Максимальный размер: 10MB</small>
                  </div>
                </div>
                <input
                    type="file"
                    ref="solutionFileInput"
                    @change="handleSolutionFileSelect"
                    style="display: none"
                >
              </div>

              <!-- Предпросмотр выбранного файла -->
              <div v-if="selectedSolutionFile" class="file-preview-card">
                <div class="preview-header">
                  <span class="preview-title">Выбранный файл:</span>
                  <button @click="removeSolutionFile" class="remove-preview-btn" title="Удалить файл">
                    ×
                  </button>
                </div>
                <div class="preview-content">
                  <span class="file-icon">📄</span>
                  <div class="file-details">
                    <span class="file-name">{{ selectedSolutionFile.name }}</span>
                    <span class="file-size">{{ formatFileSize(selectedSolutionFile.size) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
                @click="uploadStudentSolution"
                class="upload-submit-btn"
                :disabled="!selectedSolutionFile || uploadingSolution"
                :class="{ 'loading': uploadingSolution }"
            >
      <span v-if="uploadingSolution">
        ⏳ Загрузка...
      </span>
              <span v-else>
        ✅ Отправить решение
      </span>
            </button>
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
                  @click="openAttach"
                  class="action-btn attach">
            Прикрепить файл
          </button>
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="openSolutionsModal"
                  class="action-btn solutions">
            Просмотр решений
          </button>
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="openEdit"
                  class="action-btn change">
            Редактировать
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

export default {
  name: 'TaskDetail',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const task = ref(null);
    const loading = ref(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const availableTags = ref([]);
    const tagSearch = ref('');
    const updatingTask = ref(false);
    const showSolutionsModal = ref(false);
    const solutions = ref([]);
    const solutionsLoading = ref(false);
    const studentSolution = ref(null);
    const selectedSolutionFile = ref(null);
    const solutionFileInput = ref(null);
    const uploadingSolution = ref(false);

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
        await router.push('/profile/tasks');
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
    const showEditModal = ref(false);
    const editTask = ref({
      title: '',
      description: '',
      deadline: '',
      priority: 'MEDIUM',
      selectedTagIds: [],
      customTags: [],
      customTag: ''
    });

    const showAttachModal = ref(false);
    const selectedFile = ref(null);
    const fileInput = ref(null);
    const uploadingFile = ref(false);
    const attachedFiles = ref([]);

    // ИСПРАВЛЕННЫЙ МЕТОД ЗАГРУЗКИ ЗАДАЧИ
    const fetchTask = async () => {
      try {
        let response;
        if (user.role === 'ROLE_TEACHER') {
          response = await api.getTask(route.params.taskId);
        } else {
          response = await api.getMyTask(route.params.taskId);
        }

        task.value = response.data;
        console.log('Загруженная задача:', task.value);

        // ОБЯЗАТЕЛЬНО загружаем файлы отдельно, если их нет в ответе
        if (!task.value.files || task.value.files.length === 0) {
          await fetchTaskFiles();
        }

        if (user.role === 'ROLE_TEACHER') {
          await fetchUsersWithTask();
        }
      } catch (error) {
        console.error('Ошибка при получении задачи:', error);
        showToast('Не удалось загрузить задачу', 'error');
      } finally {
        loading.value = false;
      }
    };

    // НОВЫЙ МЕТОД ДЛЯ ЗАГРУЗКИ ФАЙЛОВ ЗАДАЧИ
    const fetchTaskFiles = async () => {
      try {
        const response = await api.getTaskFiles(route.params.taskId);
        console.log('Загруженные файлы задачи:', response.data);

        // Обновляем файлы с правильными URL для скачивания
        const filesWithUrls = await Promise.all(
            response.data.map(async (file) => {
              try {
                // Получаем URL для скачивания для каждого файла
                const downloadResponse = await api.getFileDownloadUrl(route.params.taskId, file.id);
                return {
                  ...file,
                  url: downloadResponse.data,
                  downloadUrl: downloadResponse.data
                };
              } catch (error) {
                console.error(`Не удалось получить URL для файла ${file.id}:`, error);
                return {
                  ...file,
                  url: null,
                  downloadUrl: null
                };
              }
            })
        );

        // Обновляем файлы в задаче
        if (task.value) {
          task.value.files = filesWithUrls;
        }

        // Также обновляем attachedFiles для модального окна
        attachedFiles.value = filesWithUrls;
      } catch (error) {
        console.error('Ошибка при загрузке файлов задачи:', error);
      }
    };

    const fetchUsersWithTask = async () => {
      usersWithTaskLoading.value = true;
      try {
        const usersResponse = await api.getUsersWithTask(route.params.taskId);
        usersWithTask.value = usersResponse.data;

        const groupsResponse = await api.getGroups();
        const allGroups = groupsResponse.data;

        groupsWithTask.value = [];
        groupStudents.value = {};

        for (const group of allGroups) {
          try {
            const groupUsersResponse = await api.getGroupStudents(group.id);
            const groupUsers = groupUsersResponse.data;

            groupStudents.value[group.id] = groupUsers;

            const allUsersHaveTask = groupUsers.length > 0 && groupUsers.every(groupUser =>
                usersWithTask.value.some(userWithTask => userWithTask.id === groupUser.id)
            );

            if (allUsersHaveTask) {
              groupsWithTask.value.push(group.id);
            }
          } catch (error) {
            console.error(`Ошибка при получении пользователей группы ${group.id}:`, error);
            groupStudents.value[group.id] = [];
          }
        }
      } catch (error) {
        console.error('Ошибка при получении данных о назначениях:', error);
        showToast('Не удалось загрузить данные о назначениях', 'error');
      } finally {
        usersWithTaskLoading.value = false;
      }
    };
    const openSolutionsModal = async () => {
      showSolutionsModal.value = true;
      await fetchSolutions();
    };

    const fetchSolutions = async () => {
      solutionsLoading.value = true;
      try {
        const response = await api.getTaskSolutions(route.params.taskId);
        solutions.value = response.data;
      } catch (error) {
        console.error('Ошибка при загрузке решений:', error);
        showToast('Не удалось загрузить решения', 'error');
      } finally {
        solutionsLoading.value = false;
      }
    };

    const downloadStudentSolution = async (studentId) => {
      try {
        const response = await api.downloadStudentSolution(route.params.taskId, studentId);
        const downloadUrl = response.data;
        if (downloadUrl) {
          window.open(downloadUrl, '_blank');
        }
      } catch (error) {
        console.error('Ошибка при скачивании решения:', error);
        showToast('Не удалось скачать решение', 'error');
      }
    };

    const updateGrade = async (solution) => {
      try {
        await api.gradeSolution(route.params.taskId, solution.studentId, {
          grade: solution.grade,
          comment: solution.teacherComment
        });
        showToast('Оценка обновлена');
      } catch (error) {
        console.error('Ошибка при обновлении оценки:', error);
        showToast('Не удалось обновить оценку', 'error');
      }
    };

// Методы для студента
    const fetchStudentSolution = async () => {
      try {
        const solutionResponse = await api.getStudentSolution(route.params.taskId);
        console.log('Данные решения:', solutionResponse.data);

        const solution = solutionResponse.data;
        if (solution && solution.fileName) {
          console.log('Решение найдено через эндпоинт решения');

          studentSolution.value = {
            fileName: solution.fileName,
            fileSize: solution.fileSize,
            uploadedAt: solution.uploadedAt,
            downloadUrl: solution.downloadUrl,
            grade: solution.grade || null,
            teacherComment: solution.teacherComment || null
          };
          return;
        }
      } catch (error) {
        console.log('Не удалось получить данные решения:', error);
      }
    };

    const triggerSolutionFileInput = () => {
      const tempInput = document.createElement('input');
      tempInput.type = 'file';
      tempInput.style.display = 'none';
      tempInput.onchange = (event) => {
        handleSolutionFileSelect(event);
        document.body.removeChild(tempInput);
      };
      document.body.appendChild(tempInput);
      tempInput.click();
    };

    const handleSolutionFileSelect = (event) => {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast('Файл слишком большой. Максимальный размер: 10MB', 'error');
          return;
        }
        selectedSolutionFile.value = file;
      }
    };

    const handleSolutionFileDrop = (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast('Файл слишком большой. Максимальный размер: 10MB', 'error');
          return;
        }
        selectedSolutionFile.value = file;
      }
    };

    const removeSolutionFile = () => {
      selectedSolutionFile.value = null;
      if (solutionFileInput.value) {
        solutionFileInput.value.value = '';
      }
    };

    const uploadStudentSolution = async () => {
      if (!selectedSolutionFile.value) return;

      uploadingSolution.value = true;
      try {
        const formData = new FormData();
        formData.append('file', selectedSolutionFile.value);

        console.log('Начинаем загрузку решения...');
        await api.uploadStudentSolution(route.params.taskId, formData);
        console.log('Решение успешно загружено на сервер');

        showToast('Решение успешно загружено');
        removeSolutionFile();

        // ОБНОВЛЯЕМ ДАННЫЕ ПОСЛЕ ЗАГРУЗКИ
        console.log('Обновляем данные...');
        await fetchStudentSolution(); // Обновляем решение студента
        await fetchTask(); // Обновляем задачу

        console.log('Данные обновлены, studentSolution:', studentSolution.value);

      } catch (error) {
        console.error('Ошибка при загрузке решения:', error);
        console.error('Детали ошибки:', error.response?.data);
        showToast('Не удалось загрузить решение', 'error');
      } finally {
        uploadingSolution.value = false;
      }
    };

    const deleteStudentSolution = async () => {
      try {
        await api.deleteStudentSolution(route.params.taskId);
        showToast('Решение удалено');
        studentSolution.value = null;
      } catch (error) {
        console.error('Ошибка при удалении решения:', error);
        showToast('Не удалось удалить решение', 'error');
      }
    };

// Обновим fetchTask для студента
    onMounted(async () => {
      await fetchTask();
      if (user.role === 'ROLE_STUDENT') {
        console.log('Компонент монтирован, загружаем решение студента...');
        await fetchStudentSolution();
        console.log('Начальное состояние studentSolution:', studentSolution.value);
      }
    });
    const openEdit = () => {
      if (!task.value) return;

      editTask.value = {
        title: task.value.title,
        description: task.value.description,
        deadline: formatDateForInput(task.value.deadline),
        priority: task.value.priority,
        selectedTagIds: task.value.tags ? task.value.tags.map(tag => tag.id || tag) : [],
        customTags: [],
        customTag: ''
      };

      fetchAvailableTags();
      showEditModal.value = true;
    };

    const fetchAvailableTags = async () => {
      try {
        const response = await api.getAvailableTags();
        console.log('Полученные теги с бэкенда:', response.data);
        availableTags.value = response.data;
      } catch (error) {
        console.error('Ошибка при загрузке тегов:', error);
        showToast('Не удалось загрузить список тегов', 'error');
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

    const getTagClass = (tag) => {
      const tagName = typeof tag === 'string' ? tag : tag.name || '';
      const tagColors = [
        'tag-primary', 'tag-secondary', 'tag-success',
        'tag-warning', 'tag-danger', 'tag-info'
      ];
      const index = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % tagColors.length;
      return tagColors[index];
    };

    const getGroupStudentsWithTaskCount = (groupId) => {
      const students = groupStudents.value[groupId];
      if (!students) return 0;

      return students.filter(student =>
          usersWithTask.value.some(userWithTask => userWithTask.id === student.id)
      ).length;
    };

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

    const closeEditModal = () => {
      showEditModal.value = false;
    };

    const filteredAvailableTags = computed(() => {
      if (!tagSearch.value) {
        return availableTags.value;
      }
      const searchTerm = tagSearch.value.toLowerCase();
      return availableTags.value.filter(tag =>
          tag.name.toLowerCase().includes(searchTerm)
      );
    });

    const toggleTagSelection = (tagId) => {
      const index = editTask.value.selectedTagIds.indexOf(tagId);
      if (index > -1) {
        editTask.value.selectedTagIds.splice(index, 1);
      } else {
        editTask.value.selectedTagIds.push(tagId);
      }
    };

    const addCustomTag = () => {
      const tagName = editTask.value.customTag.trim();
      if (tagName && !editTask.value.customTags.includes(tagName)) {
        editTask.value.customTags.push(tagName);
        editTask.value.customTag = '';
      }
    };

    const removeCustomTag = (tagToRemove) => {
      editTask.value.customTags = editTask.value.customTags.filter(tag => tag !== tagToRemove);
    };

    const updateTask = async () => {
      updatingTask.value = true;
      try {
        const taskData = {
          title: editTask.value.title,
          description: editTask.value.description,
          deadline: editTask.value.deadline,
          priority: editTask.value.priority,
          tagIds: editTask.value.selectedTagIds || [],
          tagNames: editTask.value.customTags && editTask.value.customTags.length > 0
              ? editTask.value.customTags
              : []
        };

        console.log('Отправляемые данные:', JSON.stringify(taskData, null, 2));
        await api.updateTask(route.params.taskId, taskData);
        showToast('Задача успешно обновлена');
        closeEditModal();
        await fetchTask();
      } catch (error) {
        console.error('Ошибка при обновлении задачи:', error);
        console.error('Response error:', error.response?.data);
        showToast('Не удалось обновить задачу', 'error');
      } finally {
        updatingTask.value = false;
      }
    };

    // Методы для прикрепления файлов
    const openAttach = () => {
      showAttachModal.value = true;
      fetchAttachedFiles();
    };

    const closeAttachModal = () => {
      showAttachModal.value = false;
      selectedFile.value = null;
    };

    const triggerFileInput = () => {
      fileInput.value?.click();
    };

    const handleFileSelect = (event) => {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast('Файл слишком большой. Максимальный размер: 10MB', 'error');
          return;
        }
        selectedFile.value = file;
      }
    };

    const handleFileDrop = (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          showToast('Файл слишком большой. Максимальный размер: 10MB', 'error');
          return;
        }
        selectedFile.value = file;
      }
    };

    const removeFile = () => {
      selectedFile.value = null;
      if (fileInput.value) {
        fileInput.value.value = '';
      }
    };

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // ИСПРАВЛЕННЫЙ МЕТОД ЗАГРУЗКИ ФАЙЛА
    const uploadFile = async () => {
      if (!selectedFile.value) return;

      uploadingFile.value = true;
      try {
        const formData = new FormData();
        formData.append('file', selectedFile.value);

        await api.uploadTaskFile(route.params.taskId, formData);
        showToast('Файл успешно прикреплен');
        removeFile();

        // ОБНОВЛЯЕМ ФАЙЛЫ В ЗАДАЧЕ И МОДАЛКЕ
        await fetchTaskFiles(); // Обновляем файлы в основной задаче
        await fetchAttachedFiles(); // Обновляем файлы в модалке

      } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        showToast('Не удалось прикрепить файл', 'error');
      } finally {
        uploadingFile.value = false;
      }
    };

    const fetchAttachedFiles = async () => {
      try {
        const response = await api.getTaskFiles(route.params.taskId);
        console.log('Файлы с сервера для модалки:', response.data);
        attachedFiles.value = response.data.map(file => {
          console.log('Файл:', file);
          console.log('URL для скачивания:', file.downloadUrl);
          return file;
        });
      } catch (error) {
        console.error('Ошибка при загрузке файлов задачи:', error);
      }
    };

    // ИСПРАВЛЕННЫЙ МЕТОД УДАЛЕНИЯ ФАЙЛА
    const deleteFile = async (fileId) => {
      try {
        await api.deleteTaskFile(route.params.taskId, fileId);
        showToast('Файл удален');

        // ОБНОВЛЯЕМ ФАЙЛЫ В ЗАДАЧЕ И МОДАЛКЕ
        await fetchTaskFiles(); // Обновляем файлы в основной задаче
        await fetchAttachedFiles(); // Обновляем файлы в модалке

      } catch (error) {
        console.error('Ошибка при удалении файла:', error);
        showToast('Не удалось удалить файл', 'error');
      }
    };

    const formatDateForInput = (dateString) => {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16);
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
        const response = await api.getMyUsers()
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
        await fetchTask();
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

    const downloadFileDirect = async (fileId, fileName) => {
      try {
        const response = await api.getFileDownloadUrl(route.params.taskId, fileId);
        const downloadUrl = response.data;
        if (downloadUrl) {
          window.open(downloadUrl, '_blank');
        }
      } catch (error) {
        console.error('Ошибка при получении ссылки для скачивания:', error);
        showToast('Не удалось получить ссылку для скачивания', 'error');
      }
    };

    return {
      task,
      deleteStudentSolution,
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
      confirmAssignment,
      openDeleteConfirm,
      confirmDeleteTask,
      cancelDeleteTask,
      getTagClass,
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
      downloadFileDirect,
      toast,
      hideToast,
      usersWithTask,
      groupsWithTask,
      isSelectedGroupHasTask,
      isSelectedStudentHasTask,
      solutionsLoading,
      selectGroup,
      selectStudent,
      getGroupStudentCount,
      getGroupStudentsWithTaskCount,
      assignToOthers,
      showEditModal,
      showAttachModal,
      editTask,
      selectedFile,
      fileInput,
      uploadingFile,
      attachedFiles,
      filteredAvailableTags,
      openEdit,
      closeEditModal,
      toggleTagSelection,
      addCustomTag,
      removeCustomTag,
      updateTask,
      openAttach,
      closeAttachModal,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      removeFile,
      formatFileSize,
      uploadFile,
      deleteFile,
      formatDateForInput,
      availableTags,
      tagSearch,
      updatingTask,
      uploadStudentSolution,
      handleSolutionFileDrop,
      handleSolutionFileSelect,
      triggerSolutionFileInput,
      updateGrade,
      downloadStudentSolution,
      openSolutionsModal,
      showSolutionsModal,
      studentSolution,
      selectedSolutionFile,
      removeSolutionFile,
      uploadingSolution,
      solutions
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

/* Стили для выбора тегов при создании */
.tags-selection {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.available-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.tag-selectable {
  display: inline-block;
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 15px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-selectable:hover {
  background-color: #f8f9fa;
}

.tag-selectable.selected {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
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

.action-btn.attach {
  background-color: #5f9827;
}
.action-btn.attach:hover {
  background-color: #548522;
}

.action-btn.change {
  background-color: #a69b91;
}
.action-btn.change:hover {
  background-color: #867c75;
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
/* Стили для больших модальных окон */
.large-modal {
  width: 600px;
  max-width: 95%;
}

/* Стили для загрузки файлов */
.file-upload-section {
  margin: 20px 0;
}

.file-dropzone {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.file-dropzone:hover {
  border-color: #4CAF50;
  background-color: #f0fff0;
}

.dropzone-content {
  color: #666;
}

.upload-icon {
  font-size: 2em;
  display: block;
  margin-bottom: 10px;
}

.file-preview {
  margin-top: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-name {
  font-weight: 500;
}

.file-size {
  color: #666;
  font-size: 0.9em;
}

.remove-file-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 0.8em;
}

/* Стили для списка прикрепленных файлов */
.attached-files-list,
.attached-files {
  margin: 20px 0;
}

.attached-files h4 {
  margin-bottom: 10px;
  color: #333;
}

.file-item,
.attached-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 5px;
}

.file-icon {
  font-size: 1.2em;
}

.download-link,
.download-btn {
  color: #007bff;
  text-decoration: none;
  font-size: 0.9em;
}

.download-link:hover,
.download-btn:hover {
  text-decoration: underline;
}

.delete-file-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8em;
  margin-left: auto;
}

/* Стили для форм */
.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
.student-task-solution-section {
  border-top: 2px solid #4CAF50;
  margin-top: 30px;
  padding-top: 20px;
  position: relative;
}

.student-task-solution-section::before {
  content: "Решение задачи";
  position: absolute;
  top: -12px;
  left: 20px;
  background: white;
  padding: 0 15px;
  color: #4CAF50;
  font-weight: 600;
  font-size: 0.9em;
}

.solutions-list {
  max-height: 600px;
  overflow-y: auto;
}

.solution-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 10px;
  background: #fafafa;
}

.student-info {
  display: flex;
  align-items: flex-start;
  flex: 1;
}

.student-details {
  margin-left: 15px;
}

.student-details h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.solution-file, .no-solution {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
}

.no-solution-text {
  color: #666;
  font-style: italic;
}

.grading-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

.grade-input, .comment-input {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.grade-field {
  width: 80px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.comment-field {
  width: 200px;
  height: 60px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  font-size: 0.9em;
}

/* Стили для студента */
.current-solution {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.grade-info {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.grade-item, .comment-item {
  display: flex;
  margin-bottom: 8px;
}

.grade-item .label, .comment-item .label {
  font-weight: bold;
  min-width: 100px;
}

.grade-value {
  color: #28a745;
  font-weight: bold;
}

.comment-value {
  color: #666;
  font-style: italic;
}

.upload-solution {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

/* Кнопка просмотра решений */
.action-btn.solutions {
  background-color: #9C27B0;
}

.action-btn.solutions:hover {
  background-color: #7B1FA2;
}
/* Стили для блока решения студента */
.student-solution-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px;
  margin: 20px 0;
  border: 1px solid #e9ecef;
}

.solution-header h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 1.4em;
}

.solution-description {
  color: #6c757d;
  margin: 0;
  font-size: 0.95em;
}

/* Состояние: решение загружено */
.solution-uploaded {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #d1ecf1;
}

.uploaded-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9ecef;
}

.uploaded-header h4 {
  margin: 0;
  color: #28a745;
}

.upload-date {
  color: #6c757d;
  font-size: 0.9em;
}

.solution-file-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-icon-name {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 1.5em;
}

.file-details {
  display: flex;
  flex-direction: column;
}

.file-name {
  font-weight: 600;
  color: #2c3e50;
}

.file-size {
  color: #6c757d;
  font-size: 0.85em;
}

.file-actions {
  display: flex;
  gap: 8px;
}

.download-btn {
  background: #007bff;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.download-btn:hover {
  background: #0056b3;
}

.delete-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.delete-btn:hover {
  background: #c82333;
}

/* Обратная связь преподавателя */
.teacher-feedback {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 16px;
}

.teacher-feedback h5 {
  margin: 0 0 12px 0;
  color: #856404;
}

.grade-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: white;
  padding: 8px 12px;
  border-radius: 20px;
  margin-bottom: 12px;
}

.grade-label {
  color: #6c757d;
  font-size: 0.9em;
}

.grade-value {
  color: #28a745;
  font-weight: bold;
  font-size: 1.1em;
}

.comment-box {
  background: white;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #17a2b8;
}

.comment-label {
  display: block;
  color: #6c757d;
  font-size: 0.9em;
  margin-bottom: 4px;
}

.comment-text {
  margin: 0;
  color: #2c3e50;
  line-height: 1.4;
}

.waiting-feedback {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  background: #f8f9fa;
  border-radius: 8px;
}

/* Состояние: загрузка решения */
.solution-upload {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.upload-area {
  margin-bottom: 20px;
}

.upload-zone {
  border: 2px dashed #dee2e6;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
  margin-bottom: 16px;
}

.upload-zone:hover {
  border-color: #007bff;
  background: #f0f8ff;
  transform: translateY(-2px);
}

.upload-content h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.upload-content p {
  margin: 0 0 12px 0;
  color: #6c757d;
}

.upload-icon {
  font-size: 3em;
  margin-bottom: 12px;
}

.upload-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upload-hint small {
  color: #868e96;
}

/* Предпросмотр файла */
.file-preview-card {
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #d1ecf1;
  border-bottom: 1px solid #bee5eb;
}

.preview-title {
  font-weight: 600;
  color: #0c5460;
}

.remove-preview-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  color: #dc3545;
  padding: 4px 8px;
  border-radius: 4px;
}

.remove-preview-btn:hover {
  background: #f8d7da;
}

.preview-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

/* Кнопка отправки */
.upload-submit-btn {
  width: 100%;
  background: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-submit-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
}

.upload-submit-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.upload-submit-btn.loading {
  background: #ffc107;
  color: #856404;
}

/* Адаптивность */
@media (max-width: 768px) {
  .student-solution-section {
    padding: 16px;
  }

  .file-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .file-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .uploaded-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
.no-solutions {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}
/* Адаптивность */
@media (max-width: 768px) {
  .large-modal {
    width: 95%;
  }

  .form-actions {
    flex-direction: column;
  }

  .file-item,
  .attached-file {
    flex-wrap: wrap;
  }
}
</style>