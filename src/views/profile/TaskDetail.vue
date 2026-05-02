<template>
  <div class="task-detail">
    <!-- Тосты для уведомлений -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <!-- Модалка подтверждения удаления задачи -->
    <div v-if="showDeleteConfirm" class="modal" @click.self="cancelDeleteTask">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить задачу "{{ task?.title }}"?</p>
        <div class="modal-actions">
          <button @click="confirmDeleteTask" class="delete-btn">Удалить</button>
          <button @click="cancelDeleteTask" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteCommentConfirm" class="modal" @click.self="cancelDeleteComment">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить этот комментарий?</p>
        <div class="modal-actions">
          <button @click="confirmDeleteComment" class="delete-btn">Удалить</button>
          <button @click="cancelDeleteComment" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>

    <!-- Модальное окно редактирования задачи -->
    <div v-if="showEditModal" class="modal" @click.self="closeEditModal">
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
    <div v-if="showAttachModal" class="modal" @click.self="closeAttachModal">
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

        <!-- Модальное окно решений студентов -->
        <div v-if="showSolutionsModal" class="modal" @click.self="showSolutionsModal = false">
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

        <!-- Блок для студента -->
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
            <div v-if="isTaskExpired(task)" class="expired-message">
              <p>Дедлайн задачи истек. Загрузка решения недоступна.</p>
            </div>
            <div v-else class="upload-area">
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
                v-if="!isTaskExpired(task)"
                @click="uploadStudentSolution"
                class="upload-submit-btn"
                :disabled="!selectedSolutionFile || uploadingSolution"
                :class="{ 'loading': uploadingSolution }"
            >
              <span v-if="uploadingSolution">⏳ Загрузка...</span>
              <span v-else>✅ Отправить решение</span>
            </button>
          </div>
        </div>

        <div class="task-actions">
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="assignToOthers"
                  class="action-btn">
            Назначить задачу группе
          </button>
          <button v-if="user.role === 'ROLE_TEACHER'"
                  @click="assignToStudent"
                  class="action-btn">
            Назначить задачу студенту
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

    <!-- Блок комментариев -->
    <div class="comments-section">
      <div class="comments-header">
        <h3>💬 Комментарии</h3>
        <span class="comments-count" v-if="commentsTotalElements > 0">
          {{ commentsTotalElements }} {{ getCommentWord(commentsTotalElements) }}
        </span>
      </div>

      <!-- Список комментариев -->
      <div class="comments-list" v-if="comments.length > 0">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="comment-avatar">
            {{ getInitials(comment.authorName) }}
          </div>
          <div class="comment-content">
            <div class="comment-header">
              <span class="comment-author">{{ comment.authorName }}</span>
              <span class="comment-role" :class="'role-' + comment.authorRole.toLowerCase()">
            {{ getRoleText(comment.authorRole) }}
          </span>
              <span class="comment-time">{{ formatCommentTime(comment.createdAt) }}</span>

              <!-- Действия с комментарием -->
              <div class="comment-actions" v-if="canEditComment(comment)">
                <button
                    v-if="isCommentAuthor(comment)"
                    @click="startEditComment(comment)"
                    class="comment-edit-btn"
                    title="Редактировать"
                >
                  ✏️
                </button>
                <button
                    @click="openDeleteCommentConfirm(comment)"
                    class="comment-delete-btn"
                    :title="isCommentAuthor(comment) ? 'Удалить' : 'Удалить комментарий'"
                >
                  🗑️
                </button>
              </div>
            </div>

            <!-- Редактирование комментария -->
            <div v-if="editingCommentId === comment.id" class="comment-edit">
          <textarea
              v-model="editCommentText"
              class="comment-edit-input"
              rows="3"
              placeholder="Введите текст комментария..."
          ></textarea>
              <div class="comment-edit-actions">
                <button @click="saveCommentEdit(comment.id)" class="save-btn">💾 Сохранить</button>
                <button @click="cancelEdit" class="cancel-btn">❌ Отмена</button>
              </div>
            </div>

            <!-- Отображение комментария -->
            <div v-else class="comment-text">
              {{ comment.content }}
            </div>

            <!-- Счетчик ответов -->
            <div v-if="comment.repliesCount > 0" class="comment-replies-info">
              <span class="replies-count">{{ comment.repliesCount }} {{ getReplyWord(comment.repliesCount) }}</span>
              <button @click="toggleReplies(comment.id)" class="show-replies-btn">
                {{ showReplies[comment.id] ? 'Скрыть' : 'Показать' }}
              </button>
            </div>

            <!-- Ответы на комментарий -->
            <div v-if="showReplies[comment.id] && commentReplies[comment.id]" class="comment-replies">
              <div
                  v-for="reply in commentReplies[comment.id]"
                  :key="reply.id"
                  class="comment-reply"
              >
                <div class="reply-avatar">
                  {{ getInitials(reply.authorName) }}
                </div>
                <div class="reply-content">
                  <div class="reply-header">
                    <span class="reply-author">{{ reply.authorName }}</span>
                    <span class="reply-role" :class="'role-' + reply.authorRole.toLowerCase()">
                  {{ getRoleText(reply.authorRole) }}
                </span>
                    <span class="reply-time">{{ formatCommentTime(reply.createdAt) }}</span>

                    <div class="reply-actions" v-if="canEditComment(reply)">
                      <button
                          v-if="isCommentAuthor(reply)"
                          @click="startEditComment(reply)"
                          class="comment-edit-btn"
                          title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                          @click="openDeleteCommentConfirm(reply)"
                          class="comment-delete-btn"
                          :title="isCommentAuthor(reply) ? 'Удалить' : 'Удалить комментарий'"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div class="reply-text">{{ reply.content }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Пагинация комментариев -->
      <div
          v-if="commentsTotalPages > 1"
          class="pagination comments-pagination"
      >
        <button
            class="pagination-btn"
            @click="prevCommentsPage"
            :disabled="commentsPage === 1 || commentsLoading"
        >
          ← Назад
        </button>
        <span class="pagination-info">
          Страница {{ commentsPage }} из {{ commentsTotalPages }}
          (всего: {{ commentsTotalElements }} {{ getCommentWord(commentsTotalElements) }})
        </span>
        <button
            class="pagination-btn"
            @click="nextCommentsPage"
            :disabled="commentsPage === commentsTotalPages || commentsLoading"
        >
          Вперёд →
        </button>
        <select
            v-model="commentsPageSize"
            @change="changeCommentsPageSize"
            class="page-size-select"
        >
          <option :value="10">10 на странице</option>
          <option :value="20">20 на странице</option>
          <option :value="50">50 на странице</option>
        </select>
      </div>

      <!-- Сообщение об отсутствии комментариев -->
      <div v-if="comments.length === 0 && !commentsLoading" class="no-comments">
        <p>Пока нет комментариев. Будьте первым!</p>
      </div>

      <!-- Форма добавления комментария -->
      <div class="add-comment">
        <div class="comment-input-container">
      <textarea
          v-model="newCommentText"
          class="comment-input"
          placeholder="Напишите комментарий..."
          rows="3"
          @keydown.ctrl.enter="addComment"
      ></textarea>
          <div class="comment-input-hint">
            Ctrl + Enter для отправки
          </div>
        </div>
        <button
            @click="addComment"
            class="send-comment-btn"
            :disabled="!newCommentText.trim() || addingComment"
        >
          {{ addingComment ? '⏳ Отправка...' : '📤 Отправить' }}
        </button>
      </div>
    </div>

    <!-- Модальное окно выбора группы -->
    <div v-if="showGroupModal" class="modal" @click.self="showGroupModal = false">
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
    <div v-if="showStudentModal" class="modal" @click.self="showStudentModal = false">
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
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    });
    const showDeleteConfirm = ref(false);
    const usersWithTask = ref([]);
    const groupsWithTask = ref([]);
    const usersWithTaskLoading = ref(false);
    const groupStudents = ref({});
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
    const showStudentModal = ref(false);
    const students = ref([]);
    const studentsLoading = ref(false);
    const studentsError = ref(null);
    const studentSearch = ref('');
    const selectedStudentId = ref(null);
    const studentAssignmentLoading = ref(false);
    const comments = ref([]);
    const commentsLoading = ref(false);
    const commentsPage = ref(1);
    const commentsPageSize = ref(20);
    const commentsTotalElements = ref(0);
    const newCommentText = ref('');
    const addingComment = ref(false);
    const editingCommentId = ref(null);
    const editCommentText = ref('');
    const showReplies = ref({});
    const commentReplies = ref({});
    const showDeleteCommentConfirm = ref(false);
    const commentToDelete = ref(null);

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
        showToast('Не удалось удалить задачу', 'error');
      } finally {
        cancelDeleteTask();
      }
    };

    const cancelDeleteTask = () => {
      showDeleteConfirm.value = false;
    };

    const fetchTask = async () => {
      try {
        let response;
        if (user.role === 'ROLE_TEACHER') {
          response = await api.getTask(route.params.taskId);
        } else {
          response = await api.getMyTask(route.params.taskId);
        }

        task.value = response.data;

        if (!task.value.files || task.value.files.length === 0) {
          await fetchTaskFiles();
        }

        if (user.role === 'ROLE_TEACHER') {
          await fetchUsersWithTask();
        }
      } catch (error) {
        showToast('Не удалось загрузить задачу', 'error');
      } finally {
        loading.value = false;
      }
    };

    const fetchTaskFiles = async () => {
      try {
        const response = await api.getTaskFiles(route.params.taskId);
        const filesWithUrls = await Promise.all(
            response.data.map(async (file) => {
              try {
                const downloadResponse = await api.getFileDownloadUrl(route.params.taskId, file.id);
                return {
                  ...file,
                  url: downloadResponse.data,
                  downloadUrl: downloadResponse.data
                };
              } catch (error) {
                return {
                  ...file,
                  url: null,
                  downloadUrl: null
                };
              }
            })
        );

        if (task.value) {
          task.value.files = filesWithUrls;
        }
        attachedFiles.value = filesWithUrls;
      } catch (error) {
        // Файлы не загружены, но не показываем ошибку
      }
    };

    const fetchUsersWithTask = async () => {
      usersWithTaskLoading.value = true;
      try {
        const usersResponse = await api.getUsersWithTask(route.params.taskId);
        usersWithTask.value = usersResponse.data;

        const groupsResponse = await api.getGroups(0, 1000); // Загружаем все группы
        const groupsData = groupsResponse.data;

        // Обрабатываем пагинированный ответ
        const allGroups = (groupsData && Array.isArray(groupsData.content))
            ? groupsData.content
            : (Array.isArray(groupsData) ? groupsData : []);

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
            groupStudents.value[group.id] = [];
          }
        }
      } catch (error) {
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
        showToast('Не удалось обновить оценку', 'error');
      }
    };

    const fetchStudentSolution = async () => {
      try {
        const solutionResponse = await api.getStudentSolution(route.params.taskId);
        const solution = solutionResponse.data;
        if (solution && solution.fileName) {
          studentSolution.value = {
            fileName: solution.fileName,
            fileSize: solution.fileSize,
            uploadedAt: solution.uploadedAt,
            downloadUrl: solution.downloadUrl,
            grade: solution.grade || null,
            teacherComment: solution.teacherComment || null
          };
        }
      } catch (error) {
        // Решение не найдено
      }
    };

    const triggerSolutionFileInput = () => {
      if (task.value && isTaskExpired(task.value)) {
        showToast('Нельзя загрузить решение для задачи с истекшим дедлайном', 'error');
        return;
      }
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
      if (task.value && isTaskExpired(task.value)) {
        showToast('Нельзя загрузить решение для задачи с истекшим дедлайном', 'error');
        return;
      }
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

      if (task.value && isTaskExpired(task.value)) {
        showToast('Нельзя загрузить решение для задачи с истекшим дедлайном', 'error');
        return;
      }

      uploadingSolution.value = true;
      try {
        const formData = new FormData();
        formData.append('file', selectedSolutionFile.value);

        await api.uploadStudentSolution(route.params.taskId, formData);
        showToast('Решение успешно загружено');
        removeSolutionFile();
        await fetchStudentSolution();
        await fetchTask();
      } catch (error) {
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
        showToast('Не удалось удалить решение', 'error');
      }
    };

    const openDeleteCommentConfirm = (comment) => {
      commentToDelete.value = comment;
      showDeleteCommentConfirm.value = true;
    };

    const confirmDeleteComment = async () => {
      if (!commentToDelete.value) return;

      try {
        await api.deleteComment(route.params.taskId, commentToDelete.value.id);
        showToast('Комментарий удален');
        await fetchComments(); // Обновляем список комментариев
      } catch (error) {
        console.error('Ошибка при удалении комментария:', error);
        showToast('Не удалось удалить комментарий', 'error');
      } finally {
        cancelDeleteComment();
      }
    };

    const cancelDeleteComment = () => {
      showDeleteCommentConfirm.value = false;
      commentToDelete.value = null;
    };

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
        availableTags.value = response.data;
      } catch (error) {
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

    const assignToOthers = async () => {
      selectedGroupId.value = null;
      await fetchGroups();
      // Загружаем студентов для всех групп при открытии модалки
      for (const group of groups.value) {
        if (!groupStudents.value[group.id]) {
          try {
            const groupUsersResponse = await api.getGroupStudents(group.id);
            groupStudents.value[group.id] = groupUsersResponse.data;
          } catch (error) {
            groupStudents.value[group.id] = [];
          }
        }
      }
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
        const response = await api.getGroups(0, 1000); // Загружаем все группы для модалки
        const data = response.data;

        if (data && Array.isArray(data.content)) {
          groups.value = data.content;
        } else if (Array.isArray(data)) {
          groups.value = data;
        } else {
          groups.value = [];
        }
      } catch (error) {
        showToast('Не удалось загрузить список групп', 'error');
        groups.value = [];
      } finally {
        groupsLoading.value = false;
      }
    };

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

        await api.updateTask(route.params.taskId, taskData);
        showToast('Задача успешно обновлена');
        closeEditModal();
        await fetchTask();
      } catch (error) {
        showToast('Не удалось обновить задачу', 'error');
      } finally {
        updatingTask.value = false;
      }
    };

    const isTaskExpired = (task) => {
      if (!task || !task.deadline) return false;
      return new Date(task.deadline) < new Date();
    };

    const openAttach = () => {
      if (task.value && isTaskExpired(task.value)) {
        showToast('Нельзя прикрепить файл к задаче с истекшим дедлайном', 'error');
        return;
      }
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

    const uploadFile = async () => {
      if (!selectedFile.value) return;

      uploadingFile.value = true;
      try {
        const formData = new FormData();
        formData.append('file', selectedFile.value);

        await api.uploadTaskFile(route.params.taskId, formData);
        showToast('Файл успешно прикреплен');
        removeFile();
        await fetchTaskFiles();
        await fetchAttachedFiles();
      } catch (error) {
        showToast('Не удалось прикрепить файл', 'error');
      } finally {
        uploadingFile.value = false;
      }
    };

    const fetchAttachedFiles = async () => {
      try {
        const response = await api.getTaskFiles(route.params.taskId);
        attachedFiles.value = response.data;
      } catch (error) {
        // Файлы не загружены
      }
    };

    const deleteFile = async (fileId) => {
      try {
        await api.deleteTaskFile(route.params.taskId, fileId);
        showToast('Файл удален');
        await fetchTaskFiles();
        await fetchAttachedFiles();
      } catch (error) {
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
        showToast('Не удалось получить ссылку для скачивания', 'error');
      }
    };
    // Методы для комментариев
    const fetchComments = async () => {
      commentsLoading.value = true;
      try {
        const response = await api.getTaskComments(
            route.params.taskId,
            commentsPage.value - 1,
            commentsPageSize.value
        );

        const data = response.data;
        if (data && Array.isArray(data.content)) {
          comments.value = data.content;
          commentsTotalElements.value = data.totalElements ?? data.content.length;
        } else if (Array.isArray(data)) {
          // Обратная совместимость, если бэкенд вернет просто список
          comments.value = data;
          commentsTotalElements.value = data.length;
        } else {
          comments.value = [];
          commentsTotalElements.value = 0;
        }
      } catch (error) {
        console.error('Ошибка при загрузке комментариев:', error);
        showToast('Не удалось загрузить комментарии', 'error');
      } finally {
        commentsLoading.value = false;
      }
    };

    const commentsTotalPages = computed(() => {
      return commentsPageSize.value > 0
          ? Math.ceil(commentsTotalElements.value / commentsPageSize.value)
          : 0;
    });

    const nextCommentsPage = () => {
      if (commentsPage.value < commentsTotalPages.value) {
        commentsPage.value += 1;
        fetchComments();
      }
    };

    const prevCommentsPage = () => {
      if (commentsPage.value > 1) {
        commentsPage.value -= 1;
        fetchComments();
      }
    };

    const changeCommentsPageSize = () => {
      commentsPage.value = 1;
      fetchComments();
    };

    const addComment = async () => {
      if (!newCommentText.value.trim()) return;

      addingComment.value = true;
      try {
        const commentData = {
          content: newCommentText.value.trim(),
          authorName: user.username,
          authorRole: user.role
        };

        await api.createComment(route.params.taskId, commentData);
        showToast('Комментарий добавлен');
        newCommentText.value = '';
        await fetchComments(); // Обновляем список
      } catch (error) {
        console.error('Ошибка при добавлении комментария:', error);
        showToast('Не удалось добавить комментарий', 'error');
      } finally {
        addingComment.value = false;
      }
    };

    const startEditComment = (comment) => {
      editingCommentId.value = comment.id;
      editCommentText.value = comment.content;
    };

    const cancelEdit = () => {
      editingCommentId.value = null;
      editCommentText.value = '';
    };

    const saveCommentEdit = async (commentId) => {
      if (!editCommentText.value.trim()) return;

      try {
        await api.updateComment(route.params.taskId, commentId, editCommentText.value.trim());
        showToast('Комментарий обновлен');
        editingCommentId.value = null;
        editCommentText.value = '';
        await fetchComments(); // Обновляем список
      } catch (error) {
        console.error('Ошибка при обновлении комментария:', error);
        showToast('Не удалось обновить комментарий', 'error');
      }
    };

    const deleteComment = async (commentId) => {
      if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) return;

      try {
        await api.deleteComment(route.params.taskId, commentId);
        showToast('Комментарий удален');
        await fetchComments(); // Обновляем список
      } catch (error) {
        console.error('Ошибка при удалении комментария:', error);
        showToast('Не удалось удалить комментарий', 'error');
      }
    };

    const toggleReplies = async (commentId) => {
      showReplies.value[commentId] = !showReplies.value[commentId];

      if (showReplies.value[commentId] && !commentReplies.value[commentId]) {
        try {
          const response = await api.getCommentReplies(route.params.taskId, commentId);
          commentReplies.value[commentId] = response.data;
        } catch (error) {
          console.error('Ошибка при загрузке ответов:', error);
          showToast('Не удалось загрузить ответы', 'error');
        }
      }
    };

    const canEditComment = (comment) => {
      return comment.authorId === user.id || user.role === 'ROLE_TEACHER';
    };

    const isCommentAuthor = (comment) => {
      return comment.authorId === user.id;
    };

    const getCommentWord = (count) => {
      if (count % 10 === 1 && count % 100 !== 11) return 'комментарий';
      if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'комментария';
      return 'комментариев';
    };

    const getReplyWord = (count) => {
      if (count % 10 === 1 && count % 100 !== 11) return 'ответ';
      if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'ответа';
      return 'ответов';
    };

    const formatCommentTime = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'только что';
      if (diffMins < 60) return `${diffMins} мин. назад`;
      if (diffHours < 24) return `${diffHours} ч. назад`;
      if (diffDays < 7) return `${diffDays} дн. назад`;

      return date.toLocaleDateString('ru-RU');
    };

    const getRoleText = (role) => {
      const roleMap = {
        'ROLE_TEACHER': 'Преподаватель',
        'ROLE_STUDENT': 'Студент',
        'ROLE_ADMIN': 'Администратор'
      };
      return roleMap[role] || role;
    };

    onMounted(async () => {
      await fetchTask();
      if (user.role === 'ROLE_STUDENT') {
        await fetchStudentSolution();
      }

      await fetchComments();
    });

    return {
      task,
      isTaskExpired,
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
      solutions,
      comments,
      commentsLoading,
      commentsPage,
      commentsPageSize,
      commentsTotalElements,
      newCommentText,
      addingComment,
      editingCommentId,
      editCommentText,
      showReplies,
      commentReplies,
      fetchComments,
      addComment,
      startEditComment,
      cancelEdit,
      saveCommentEdit,
      deleteComment,
      toggleReplies,
      canEditComment,
      isCommentAuthor,
      getCommentWord,
      getReplyWord,
      formatCommentTime,
      getRoleText,
      openDeleteCommentConfirm,
      confirmDeleteComment,
      cancelDeleteComment,
      showDeleteCommentConfirm,
      commentToDelete,


    };
  }
};
</script>

<style scoped>
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
  text-align: left;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 1.5em;
  font-weight: 600;
  text-align: center;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.modal-content p {
  margin: 0 0 20px 0;
  color: var(--text-secondary);
  line-height: 1.6;
  text-align: center;
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

.task-detail {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.loading,
.not-found {
  text-align: center;
  padding: 50px;
  font-size: 1.2em;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

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
  background: var(--bg-secondary);
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
  background-color: #138ca1;
}

.action-btn.delete {
  background-color: #DC3545;
}

.action-btn.delete:hover {
  background-color: #C82333;
}

.action-btn.attach {
  background-color: #17A2B8;
}

.action-btn.attach:hover {
  background-color: #138CA1FF;
}

.action-btn.change {
  background-color: #17A2B8;
}

.action-btn.change:hover {
  background-color: #138CA1FF;
}

.action-btn.solutions {
  background-color: #17A2B8;
}

.action-btn.solutions:hover {
  background-color: #138CA1FF;
}

.status,
.priority {
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

.group-list,
.students-list {
  max-height: 400px;
  overflow-y: auto;
  margin: 20px 0;
  padding-right: 5px;
}

.group-item,
.student-item {
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #e0e0e0;
  background-color: var(--bg-card);
}

.group-item:hover,
.student-item:hover {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

.group-item.selected,
.student-item.selected {
  background-color: #e3f2fd;
  border: 1px solid #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
  animation: pulse 0.5s ease;
}

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
  background-color: #9C27B0;
}

.student-avatar {
  background-color: #4CAF50;
}

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

.no-groups,
.no-students {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

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

.loading-groups,
.loading-students {
  text-align: center;
  padding: 20px;
}

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

.group-item.has-task.selected,
.student-item.has-task.selected {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  box-shadow: none;
  animation: none;
}

.large-modal {
  width: 600px;
  max-width: 95%;
}

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

.attached-files-list,
.attached-files {
  margin: 20px 0;
}

.attached-files h4 {
  margin-bottom: 10px;
  color: var(--text-primary);
}

.file-item,
.attached-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary);
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

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.student-solution-section {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  margin: 20px 0;
  border: 1px solid var(--border-color);
}

.solution-header h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 1.4em;
}

.solution-description {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95em;
}

.solution-uploaded {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid var(--border-color);
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
  color: var(--text-muted);
  font-size: 0.9em;
}

.solution-file-card {
  background: var(--bg-secondary);
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
  color: var(--text-primary);
}

.file-size {
  color: var(--text-muted);
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

.teacher-feedback {
  background: var(--task-not-started);
  border: 1px solid var(--color-warning);
  border-radius: 8px;
  padding: 16px;
}

.teacher-feedback h5 {
  margin: 0 0 12px 0;
  color: var(--task-not-started-text);
}

.grade-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
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
  background: var(--bg-card);
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--color-primary);
}

.comment-label {
  display: block;
  color: var(--text-muted);
  font-size: 0.9em;
  margin-bottom: 4px;
}

.comment-text {
  margin: 0;
  color: var(--text-primary);
  line-height: 1.4;
}

.waiting-feedback {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-radius: 8px;
}

.solution-upload {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 20px;
}

.expired-message {
  background: #f6a8a8;
  border: 1px solid #f53b38;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  margin-bottom: 20px;
}

.expired-message p {
  margin: 0;
  color: #850404;
  font-weight: 500;
  font-size: 1.1em;
}

.upload-area {
  margin-bottom: 20px;
}

.upload-zone {
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-secondary);
  margin-bottom: 16px;
}

.upload-zone:hover {
  border-color: var(--color-primary);
  background: var(--bg-hover);
  transform: translateY(-2px);
}

.upload-content h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.upload-content p {
  margin: 0 0 12px 0;
  color: var(--text-secondary);
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
  color: var(--text-muted);
}

.file-preview-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.preview-title {
  font-weight: 600;
  color: var(--text-primary);
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

.solutions-list {
  max-height: 600px;
  overflow-y: auto;
}

.solution-item {
  justify-content: space-between;
  align-items: flex-start;
  padding: 15px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 10px;
  background: var(--bg-card);
}

.student-info {
  align-items: flex-start;
  flex: 1;
}

.student-details {
  margin-left: 15px;
}

.student-details h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.solution-file, .no-solution {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9em;
}

.no-solution-text {
  color: var(--text-muted);
  font-style: italic;
}

.grading-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

.grade-input, .comment-input {
  border: 1px solid var(--border-color);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  text-align: start;
  gap: 5px;
  background: var(--bg-secondary);
}

.grade-field {
  width: 80px;
  padding: 5px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);
}

.comment-field {
  width: 200px;
  height: 60px;
  padding: 5px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  resize: vertical;
  font-size: 0.9em;
  background: var(--input-bg);
  color: var(--input-text);
}

.no-solutions {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-style: italic;
}
/* Стили для комментариев */
.comments-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid var(--border-color);
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.comments-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.comments-count {
  background: var(--color-primary);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.9em;
  font-weight: 500;
}

.comments-list {
  margin-bottom: 30px;
}

.comment-item {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: box-shadow 0.2s;
}

.comment-item:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #4CAF50;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.role-teacher .comment-avatar {
  background: #9C27B0;
}

.role-admin .comment-avatar {
  background: #f44336;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.comment-author {
  font-weight: 600;
  color: var(--text-primary);
}

.comment-role {
  font-size: 0.8em;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.role-teacher {
  background: rgba(156, 39, 176, 0.2);
  color: var(--color-primary);
}

.role-admin {
  background: rgba(244, 67, 54, 0.2);
  color: var(--color-danger);
}

.comment-time {
  color: var(--text-muted);
  font-size: 0.9em;
}

.comment-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.comment-edit-btn,
.comment-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 0.9em;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.comment-edit-btn:hover,
.comment-delete-btn:hover {
  opacity: 1;
  background: var(--bg-hover);
}

.comment-edit {
  margin-top: 8px;
}

.comment-edit-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.95em;
  resize: vertical;
  margin-bottom: 8px;
  background: var(--input-bg);
  color: var(--input-text);
}

.comment-edit-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.comment-edit-actions {
  display: flex;
  gap: 8px;
}

.save-btn,
.cancel-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.save-btn {
  background: #28a745;
  color: white;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.comment-text {
  color: var(--text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
}

.comment-replies-info {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.replies-count {
  color: var(--text-muted);
  font-size: 0.9em;
}

.show-replies-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 0.9em;
  text-decoration: underline;
}

.show-replies-btn:hover {
  color: var(--color-primary-dark);
}

.comment-replies {
  margin-top: 12px;
  padding-left: 20px;
  border-left: 3px solid var(--border-color);
}

.comment-reply {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.reply-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #17a2b8;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8em;
  flex-shrink: 0;
}

.reply-content {
  flex: 1;
  min-width: 0;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.reply-author {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9em;
}

.reply-role {
  font-size: 0.75em;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.reply-time {
  color: var(--text-muted);
  font-size: 0.8em;
}

.reply-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.reply-text {
  color: var(--text-primary);
  line-height: 1.4;
  font-size: 0.9em;
  white-space: pre-wrap;
}

.no-comments {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 20px;
}

.add-comment {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.comment-input-container {
  margin-bottom: 12px;
}

.comment-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.95em;
  resize: vertical;
  transition: border-color 0.2s;
  background: var(--input-bg);
  color: var(--input-text);
}

.comment-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.comment-input-hint {
  color: var(--text-muted);
  font-size: 0.8em;
  margin-top: 4px;
}

.send-comment-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95em;
  transition: background-color 0.2s;
}

.send-comment-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.send-comment-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
.modal-content {
  background: var(--bg-card);
  padding: 30px;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  text-align: center;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
}

.modal-content h3 {
  margin: 0 0 15px 0;
  color: var(--color-danger);
  font-size: 1.3rem;
}

.modal-content p {
  margin: 0 0 20px 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  min-width: 80px;
}

.delete-btn:hover {
  background-color: #c82333;
  transform: translateY(-1px);
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  min-width: 80px;
}

.cancel-btn:hover {
  background-color: #5a6268;
  transform: translateY(-1px);
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
@media (max-width: 768px) {
  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .comment-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }

  .comment-replies {
    padding-left: 10px;
  }

  .comment-reply {
    padding: 8px;
  }
}

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
</style>