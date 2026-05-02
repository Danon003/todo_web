<template>
  <div class="video-meetings">
    <div class="header">
      <h1>Видеовстречи</h1>
      <button
          v-if="user.role === 'ROLE_TEACHER'"
          @click="openCreateModal"
          class="create-btn"
      >
        ➕ Создать встречу
      </button>
    </div>

    <div class="filters" v-if="!loading && meetings.length > 0">
      <label class="filter-checkbox">
        <input type="checkbox" v-model="hidePastMeetings">
        <span>Скрывать завершенные встречи</span> <!-- Изменили текст -->
      </label>

    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="meetings.length === 0" class="empty-state">
      <p>Нет доступных видеовстреч</p>
      <p v-if="user.role === 'ROLE_STUDENT'" class="empty-hint">
        Встречи появятся здесь, когда преподаватель их создаст для вашей группы
      </p>
    </div>

    <div v-else-if="visibleMeetings.length === 0" class="empty-state">
      <p>Нет встреч, подходящих под текущие фильтры</p>
      <p class="empty-hint">Попробуйте отключить скрытие прошедших встреч</p>
    </div>

    <div v-else class="meetings-list">
      <div
          v-for="meeting in visibleMeetings"
          :key="meeting.id"
          class="meeting-card"
          :class="getMeetingCardClass(meeting)"
      >
        <div class="meeting-header">
          <h3>{{ meeting.title }}</h3>
          <div class="meeting-badges">
            <span v-if="isMeetingCompleted(meeting)" class="badge completed">Завершена</span>
            <span v-else-if="isMeetingActive(meeting)" class="badge active">Активна</span>
            <span v-else class="badge upcoming">Предстоящая</span>
          </div>
          <div class="meeting-actions" v-if="user.role === 'ROLE_TEACHER' || user.role === 'ROLE_ADMIN'">
            <button
                v-if="(meeting.createdById === user.id || user.role === 'ROLE_ADMIN') && !isMeetingCompleted(meeting)"
                @click="openEditModal(meeting)"
                class="action-btn edit"
                title="Редактировать"
            >
              ✏️
            </button>
            <button
                v-if="meeting.createdById === user.id || user.role === 'ROLE_ADMIN'"
                @click="confirmDelete(meeting)"
                class="action-btn delete"
                title="Удалить"
            >
              🗑️
            </button>
          </div>
        </div>

        <div class="meeting-info">
          <p v-if="meeting.description" class="description">{{ meeting.description }}</p>
          <div class="details">
            <p><strong>Начало:</strong> {{ formatDateTime(meeting.startTime) }}</p>
            <p v-if="meeting.endTime"><strong>Окончание:</strong> {{ formatDateTime(meeting.endTime) }}</p>
            <p v-if="meeting.groupName"><strong>Группа:</strong> {{ meeting.groupName }}</p>
            <p v-if="meeting.createdByUsername"><strong>Создал:</strong> {{ meeting.createdByUsername }}</p>
            <p><strong>Статус:</strong>
              <span :class="getStatusClass(meeting)">{{ getStatusText(meeting) }}</span>
            </p>
          </div>
        </div>

        <div class="meeting-footer">
          <!-- Кнопка присоединения -->
          <button
              @click="joinMeeting(meeting.id)"
              class="join-btn"
              :class="{ 'disabled': !canJoinMeeting(meeting) }"
              :disabled="!canJoinMeeting(meeting)"
              :title="getJoinButtonTitle(meeting)"
          >
            {{ getJoinButtonText(meeting) }}
          </button>

          <!-- Кнопка завершения для преподавателей -->
          <button
              v-if="(user.role === 'ROLE_TEACHER' || user.role === 'ROLE_ADMIN') &&
                     (meeting.createdById === user.id || user.role === 'ROLE_ADMIN') &&
                     !isMeetingCompleted(meeting) && isMeetingActive(meeting)"
              @click="confirmComplete(meeting)"
              class="complete-btn"
              title="Завершить встречу"
          >
            ✅ Завершить
          </button>

          <!-- Сообщение о завершенной встрече -->
          <div v-if="isMeetingCompleted(meeting)" class="meeting-completed-message">
            <p v-if="!meeting.isActive">Встреча завершена преподавателем</p>
            <p v-else>Встреча завершена по времени</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания/редактирования -->
    <div v-if="showModal" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <span class="close" @click="closeModal">&times;</span>
        <h3>{{ editingMeeting ? 'Редактировать встречу' : 'Создать встречу' }}</h3>
        <form @submit.prevent="saveMeeting">
          <div class="form-group">
            <label>Название встречи *</label>
            <input
                v-model="meetingForm.title"
                type="text"
                required
                :disabled="saving"
                placeholder="Введите название встречи"
            >
          </div>
          <div class="form-group">
            <label>Описание</label>
            <textarea
                v-model="meetingForm.description"
                rows="4"
                :disabled="saving"
                placeholder="Описание встречи (необязательно)"
            ></textarea>
          </div>
          <div class="form-group">
            <label>Дата и время начала *</label>
            <input
                v-model="meetingForm.startTime"
                type="datetime-local"
                required
                :disabled="saving"
            >
          </div>
          <div class="form-group">
            <label>Дата и время окончания</label>
            <input
                v-model="meetingForm.endTime"
                type="datetime-local"
                :disabled="saving"
            >
          </div>
          <div class="form-group">
            <label>Группа (опционально)</label>
            <select
                v-model="meetingForm.groupId"
                :disabled="saving"
            >
              <option :value="null">Для всех студентов</option>
              <option
                  v-for="group in availableGroups"
                  :key="group.id"
                  :value="group.id"
              >
                {{ group.name }}
              </option>
            </select>
            <!-- Отладка - временно -->
            <div v-if="availableGroups.length === 0" class="debug-groups">
              <p class="form-hint debug">Группы не загружены. Проверьте консоль браузера (F12)</p>
            </div>
            <div v-else class="debug-groups" style="display: none;">
              <p class="form-hint">Загружено групп: {{ availableGroups.length }}</p>
            </div>
            <p class="form-hint" v-if="user.role === 'ROLE_TEACHER'">
              Если выбрать группу, встречу увидят только её студенты
            </p>

            <p class="form-hint" v-if="user.role === 'ROLE_TEACHER'">
              Если выбрать группу, встречу увидят только её студенты
            </p>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-btn" :disabled="saving">
              Отмена
            </button>
            <button type="submit" class="save-btn" :disabled="saving">
              <span v-if="saving">Сохранение...</span>
              <span v-else>{{ editingMeeting ? 'Сохранить' : 'Создать' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Модальное окно подтверждения удаления -->
    <div v-if="showDeleteConfirm" class="modal" @click.self="cancelDelete">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить встречу "{{ meetingToDelete?.title }}"?</p>
        <div class="form-actions">
          <button @click="cancelDelete" class="cancel-btn">Отмена</button>
          <button @click="deleteMeeting" class="delete-btn">Удалить</button>
        </div>
      </div>
    </div>
    <div v-if="showCompleteConfirm" class="modal" @click.self="cancelComplete">
      <div class="modal-content">
        <h3>Завершение встречи</h3>
        <p>Вы уверены, что хотите завершить встречу "{{ meetingToComplete?.title }}"?</p>
        <p class="warning-text">⚠️ Участники больше не смогут присоединиться к этой встрече</p>
        <div class="form-actions">
          <button @click="cancelComplete" class="cancel-btn">Отмена</button>
          <button @click="completeMeeting" class="complete-confirm-btn">Завершить встречу</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'

export default {
  name: 'VideoMeetings',
  setup() {
    const meetings = ref([])
    const loading = ref(true)
    const showModal = ref(false)
    const showDeleteConfirm = ref(false)
    const showCompleteConfirm = ref(false)
    const editingMeeting = ref(null)
    const meetingToDelete = ref(null)
    const meetingToComplete = ref(null)
    const saving = ref(false)
    const completing = ref(false)
    const availableGroups = ref([])
    const hidePastMeetings = ref(true)

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const currentUserId = user?.id

    const meetingForm = ref({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      groupId: null
    })

    // Функции для работы с датами
    const toInputValue = (value) => {
      if (!value) return ''
      return value.slice(0, 16)
    }

    const formatDateTime = (dateTime) => {
      if (!dateTime) return ''
      const localDate = new Date(dateTime)
      return localDate.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Основные функции для статусов встреч
    const isMeetingPast = (meeting) => {
      if (!meeting.isActive) return true // Если завершена вручную - считаем прошедшей
      if (!meeting.startTime) return false
      const now = new Date()
      if (meeting.endTime) {
        return now > new Date(meeting.endTime)
      }
      return now > new Date(meeting.startTime)
    }

    const isMeetingActive = (meeting) => {
      if (!meeting.isActive) return false
      if (!meeting.startTime) return false
      const now = new Date()
      const startTime = new Date(meeting.startTime)
      return now >= startTime
    }

    const isMeetingCompleted = (meeting) => {
      return !meeting.isActive || isMeetingPast(meeting)
    }

    const canJoinMeeting = (meeting) => {
      return meeting.isActive && isMeetingActive(meeting) && !isMeetingPast(meeting)
    }

    // Классы и тексты для встреч
    const getMeetingCardClass = (meeting) => {
      if (isMeetingCompleted(meeting)) return 'meeting-completed'
      if (isMeetingActive(meeting)) return 'meeting-active'
      return 'meeting-upcoming'
    }

    const getStatusText = (meeting) => {
      if (!meeting.isActive) return 'Завершена'
      if (isMeetingPast(meeting)) return 'Завершена'
      if (isMeetingActive(meeting)) return 'Активна'
      return 'Предстоящая'
    }

    const getStatusClass = (meeting) => {
      if (isMeetingCompleted(meeting)) return 'status-completed'
      if (isMeetingActive(meeting)) return 'status-active'
      return 'status-pending'
    }

    const getJoinButtonText = (meeting) => {
      if (isMeetingCompleted(meeting)) return '❌ Завершена'
      if (!isMeetingActive(meeting)) return '⏰ Не началась'
      return '🎥 Присоединиться'
    }

    const getJoinButtonTitle = (meeting) => {
      if (!meeting.isActive) return 'Встреча завершена преподавателем'
      if (isMeetingPast(meeting)) return 'Встреча завершена по времени'
      if (!isMeetingActive(meeting)) return 'Встреча еще не началась'
      return 'Присоединиться к встрече'
    }

    // Фильтрация встреч
    const visibleMeetings = computed(() => {
      const sorted = [...meetings.value].sort((a, b) => {
        return new Date(a.startTime) - new Date(b.startTime)
      })

      return sorted.filter(meeting => {
        // Если включен фильтр скрытия прошедших - скрываем ВСЕ завершенные встречи
        if (hidePastMeetings.value && isMeetingCompleted(meeting)) {
          return false
        }
        return true
      })
    })

    // API функции
    const fetchMeetings = async () => {
      try {
        loading.value = true
        const response = await api.getVideoMeetings()
        meetings.value = response.data || []
      } catch (error) {
        console.error('Ошибка при загрузке встреч:', error)
        meetings.value = []
      } finally {
        loading.value = false
      }
    }

    const fetchGroups = async () => {
      // Загружаем группы для всех, кто может создавать встречи
      if (user.role !== 'ROLE_TEACHER' && user.role !== 'ROLE_ADMIN') return;

      try {
        console.log('Загружаем группы...');
        const response = await api.getGroups();
        console.log('Ответ от сервера (группы):', response);

        // Проверяем структуру ответа
        let groups = [];
        if (response.data && Array.isArray(response.data)) {
          groups = response.data;
        } else if (response.data && response.data.content && Array.isArray(response.data.content)) {
          // Пагинированный ответ
          groups = response.data.content;
        } else if (Array.isArray(response)) {
          groups = response;
        }

        console.log('Обработанные группы:', groups);
        availableGroups.value = groups || [];

        if (groups.length === 0) {
          console.log('Нет доступных групп');
        }
      } catch (error) {
        console.error('Детальная ошибка при загрузке групп:', error);
        console.error('Статус:', error.response?.status);
        console.error('Данные ошибки:', error.response?.data);
        console.error('Заголовки:', error.response?.headers);

        // Показываем пользователю понятную ошибку
        if (error.response?.status === 403) {
          alert('У вас нет прав для просмотра списка групп');
        } else if (error.response?.status === 401) {
          alert('Сессия истекла. Пожалуйста, войдите снова');
        } else {
          alert('Не удалось загрузить список групп. Проверьте консоль для деталей');
        }
      }
    };

    const joinMeeting = async (meetingId) => {
      try {
        const response = await api.getVideoMeetingJoinUrl(meetingId)
        const joinUrl = response.data.joinUrl
        window.open(joinUrl, '_blank')
      } catch (error) {
        console.error('Ошибка при получении ссылки для подключения:', error)
        alert('Не удалось получить ссылку для подключения')
      }
    }

    const completeMeeting = async () => {
      if (!meetingToComplete.value) return

      completing.value = true
      try {
        await api.completeVideoMeeting(meetingToComplete.value.id)
        // Обновляем локальные данные вместо полной перезагрузки
        const meetingIndex = meetings.value.findIndex(m => m.id === meetingToComplete.value.id)
        if (meetingIndex !== -1) {
          meetings.value[meetingIndex].isActive = false
        }
        cancelComplete()
      } catch (error) {
        console.error('Ошибка при завершении встречи:', error)
        alert(error.response?.data?.message || 'Не удалось завершить встречу')
      } finally {
        completing.value = false
      }
    }

    // Остальные функции (create, edit, delete) остаются без изменений
    const openCreateModal = () => {
      editingMeeting.value = null
      meetingForm.value = {
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        groupId: null
      }
      showModal.value = true
    }

    const openEditModal = (meeting) => {
      editingMeeting.value = meeting
      meetingForm.value = {
        title: meeting.title,
        description: meeting.description || '',
        startTime: toInputValue(meeting.startTime),
        endTime: meeting.endTime ? toInputValue(meeting.endTime) : '',
        groupId: meeting.groupId || null
      }
      showModal.value = true
    }

    const closeModal = () => {
      showModal.value = false
      editingMeeting.value = null
      meetingForm.value = {
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        groupId: null
      }
    }

    const saveMeeting = async () => {
      if (!meetingForm.value.title || meetingForm.value.title.trim() === '') {
        alert('Пожалуйста, укажите название встречи')
        return
      }

      if (!meetingForm.value.startTime) {
        alert('Пожалуйста, укажите время начала встречи')
        return
      }

      saving.value = true
      try {
        const meetingData = {
          title: meetingForm.value.title.trim(),
          description: meetingForm.value.description ? meetingForm.value.description.trim() : null,
          startTime: meetingForm.value.startTime,
          endTime: meetingForm.value.endTime || null,
          groupId: meetingForm.value.groupId || null
        }

        if (editingMeeting.value) {
          await api.updateVideoMeeting(editingMeeting.value.id, meetingData)
        } else {
          await api.createVideoMeeting(meetingData)
        }

        await fetchMeetings()
        closeModal()
      } catch (error) {
        console.error('Ошибка при сохранении встречи:', error)
        const errorMessage = error.response?.data?.message ||
            (error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : 'Не удалось сохранить встречу')
        alert(errorMessage)
      } finally {
        saving.value = false
      }
    }

    const confirmDelete = (meeting) => {
      meetingToDelete.value = meeting
      showDeleteConfirm.value = true
    }

    const cancelDelete = () => {
      showDeleteConfirm.value = false
      meetingToDelete.value = null
    }

    const deleteMeeting = async () => {
      try {
        await api.deleteVideoMeeting(meetingToDelete.value.id)
        await fetchMeetings()
        cancelDelete()
      } catch (error) {
        console.error('Ошибка при удалении встречи:', error)
        alert(error.response?.data?.message || 'Не удалось удалить встречу')
      }
    }

    const confirmComplete = (meeting) => {
      meetingToComplete.value = meeting
      showCompleteConfirm.value = true
    }

    const cancelComplete = () => {
      showCompleteConfirm.value = false
      meetingToComplete.value = null
      completing.value = false
    }

    onMounted(() => {
      fetchMeetings()
      fetchGroups()
    })

    return {
      user,
      meetings,
      loading,
      showModal,
      showDeleteConfirm,
      showCompleteConfirm,
      editingMeeting,
      meetingToDelete,
      meetingToComplete,
      saving,
      completing,
      availableGroups,
      meetingForm,
      hidePastMeetings,
      visibleMeetings,
      openCreateModal,
      openEditModal,
      closeModal,
      saveMeeting,
      confirmDelete,
      cancelDelete,
      deleteMeeting,
      confirmComplete,
      cancelComplete,
      completeMeeting,
      joinMeeting,
      formatDateTime,
      isMeetingActive,
      isMeetingPast,
      isMeetingCompleted,
      canJoinMeeting,
      getMeetingCardClass,
      getStatusText,
      getStatusClass,
      getJoinButtonText,
      getJoinButtonTitle
    }
  }
}
</script>


<style scoped>
.video-meetings {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 2em;
  font-weight: 600;
}

.filters {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95em;
  color: var(--text-primary);
  cursor: pointer;
}

.filter-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: #17A2B8;
}

.admin-hint {
  font-size: 0.85em;
  color: #6c757d;
  font-style: italic;
}

.create-btn {
  background: #17A2B8;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(23, 162, 184, 0.3);
}

.create-btn:hover {
  background: #138ca1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(23, 162, 184, 0.4);
}

.loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  font-size: 1.1em;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
}

.empty-state p:first-child {
  font-size: 1.2em;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.empty-hint {
  margin-top: 10px;
  font-size: 0.9em;
  color: var(--text-muted);
  line-height: 1.5;
}

/* Стили для списка встреч */
.meetings-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
}

.meeting-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;
  border-left: 6px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

/* Активная встреча */
.meeting-active {
  border-left-color: #28a745;
  box-shadow: 0 6px 20px rgba(40, 167, 69, 0.15);
}

.meeting-active:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(40, 167, 69, 0.2);
}

/* Завершенная вручную встреча */
.meeting-completed {
  border-left-color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  opacity: 0.85;
}

.meeting-completed:hover {
  transform: none;
  box-shadow: var(--shadow-sm);
}

.meeting-completed .meeting-header h3 {
  color: var(--text-muted);
  text-decoration: line-through;
}

.meeting-completed .description {
  color: var(--text-muted);
}

.meeting-completed .details {
  color: var(--text-muted);
}

/* Прошедшая по времени встреча */
.meeting-past {
  border-left-color: #8c8883;
  opacity: 0.9;
}

.meeting-past:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 193, 7, 0.15);
}

.meeting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.meeting-header h3 {
  margin: 0;
  color: var(--text-primary);
  flex: 1;
  font-size: 1.3em;
  line-height: 1.3;
  font-weight: 600;
}

.meeting-badge {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.completed {
  background: #9ba1a4;
  color: white;
}

.badge.past {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.meeting-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.action-btn:hover:not(:disabled) {
  opacity: 1;
  transform: scale(1.1);
  background: rgba(0, 0, 0, 0.05);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
}

.action-btn.edit:hover:not(:disabled) {
  background: rgba(23, 162, 184, 0.1);
}

.action-btn.delete:hover:not(:disabled) {
  background: rgba(220, 53, 69, 0.1);
}

.meeting-info {
  margin-bottom: 20px;
}

.description {
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
  font-size: 0.95em;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border-left: 3px solid var(--border-color);
}

.details {
  font-size: 0.9em;
  color: var(--text-secondary);
}

.details p {
  margin: 8px 0;
  display: flex;
  align-items: flex-start;
}

.details strong {
  min-width: 100px;
  margin-right: 12px;
  color: var(--text-primary);
  font-weight: 600;
}

/* Статусы встреч */
.status-active {
  color: #28a745;
  font-weight: 600;
}

.status-pending {
  color: #ff9c07;
  font-weight: 600;
}

.status-ended {
  color: #fd1414;
  font-weight: 600;
}

.status-completed {
  color: #6c757d;
  font-weight: 600;
}

.meeting-footer {
  border-top: 1px solid #e9ecef;
  padding-top: 20px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.join-btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: 500;
  border: none;
  transition: all 0.3s ease;
  text-align: center;
  background: #28a745;
  color: white;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.join-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
}

.join-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.6;
}

/* Кнопка завершения */
.complete-btn {
  background: #ffc107;
  color: #212529;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.3s ease;
  flex: 1;
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

.complete-btn:hover {
  background: #e0a800;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
}

.complete-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Сообщение о завершенной встрече */
.meeting-completed-message {
  text-align: center;
  padding: 12px;
  background: #e9ecef;
  border-radius: 8px;
  margin-top: 12px;
  width: 100%;
}

.meeting-completed-message p {
  margin: 0;
  color: #6c757d;
  font-size: 0.9em;
  font-weight: 500;
}

/* Модальные окна */
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
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  padding: 30px;
  border-radius: 16px;
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  position: relative;
  border: 1px solid var(--border-color);
}

.modal-content h3 {
  margin: 0 0 24px 0;
  color: var(--text-primary);
  font-size: 1.5em;
  font-weight: 600;
  text-align: center;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--border-color);
}

.close {
  position: absolute;
  top: 20px;
  right: 24px;
  font-size: 28px;
  cursor: pointer;
  color: #888;
  transition: color 0.2s;
  line-height: 1;
  background: none;
  border: none;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
  font-size: 0.95em;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 1em;
  transition: all 0.3s;
  box-sizing: border-box;
  font-family: inherit;
  background: var(--input-bg);
  color: var(--input-text);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 195, 247, 0.1);
}

.form-group input:disabled,
.form-group textarea:disabled,
.form-group select:disabled {
  background-color: var(--input-disabled);
  cursor: not-allowed;
  opacity: 0.7;
}

.form-hint {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-top: 6px;
  margin-bottom: 0;
  font-style: italic;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 28px;
}

.cancel-btn {
  background-color: #6c757d;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.95em;
}

.cancel-btn:hover:not(:disabled) {
  background-color: #5a6268;
  transform: translateY(-1px);
}

.save-btn {
  background-color: #17A2B8;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.95em;
}

.save-btn:hover:not(:disabled) {
  background-color: #138ca1;
  transform: translateY(-1px);
}

.delete-btn {
  background-color: #dc3545;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
  font-size: 0.95em;
}

.delete-btn:hover {
  background-color: #c82333;
  transform: translateY(-1px);
}

.complete-confirm-btn {
  background: #ffc107;
  color: #212529;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
  font-size: 0.95em;
}

.complete-confirm-btn:hover:not(:disabled) {
  background: #e00000;
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.warning-text {
  color: #856404;
  background: #fff3cd;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #ffeaa7;
  margin: 16px 0;
  font-size: 0.9em;
}

.meeting-upcoming {
  border-left-color: #17A2B8;
}

.meeting-upcoming:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(23, 162, 184, 0.15);
}

/* Обновляем баджи */
.meeting-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.active {
  background: #28a745;
  color: white;
}

.badge.upcoming {
  background: #17A2B8;
  color: white;
}

.badge.past {
  background: #6c757d;
  color: white;
}

.badge.completed {
  background: #343a40;
  color: white;
}

/* Для прошедших встреч делаем кнопки серыми */
.meeting-past .join-btn {
  background: #6c757d !important;
  cursor: not-allowed;
  opacity: 0.6;
}

.meeting-past .join-btn:hover {
  transform: none !important;
  box-shadow: none !important;
}

.meeting-completed {
  border-left-color: #6c757d;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  opacity: 0.8;
}

.meeting-completed:hover {
  transform: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.meeting-completed .meeting-header h3 {
  color: #6c757d;
  text-decoration: line-through;
}

.meeting-completed .description {
  color: #868e96;
}

.meeting-completed .details {
  color: #868e96;
}

.meeting-completed .join-btn {
  background: #6c757d !important;
  cursor: not-allowed;
  opacity: 0.6;
}

.meeting-completed .join-btn:hover {
  transform: none !important;
  box-shadow: none !important;
}

.meeting-completed .action-btn.edit {
  opacity: 0.3;
  cursor: not-allowed;
}

.meeting-completed .action-btn.edit:hover {
  transform: none;
  background: none;
}

/* Бейджи */
.badge.completed {
  background: #343a40;
  color: white;
}

.badge.active {
  background: #28a745;
  color: white;
}

.badge.upcoming {
  background: #17A2B8;
  color: white;
}

/* Статусы */
.status-completed {
  color: #6c757d;
  font-weight: 600;
}

.status-active {
  color: #28a745;
  font-weight: 600;
}

.status-pending {
  color: #ffc107;
  font-weight: 600;
}
/* Адаптивность */
@media (max-width: 768px) {
  .video-meetings {
    padding: 16px;
  }

  .header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    margin-bottom: 24px;
  }

  .header h1 {
    font-size: 1.7em;
    text-align: center;
  }

  .meetings-list {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .meeting-card {
    padding: 20px;
  }

  .meeting-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .meeting-header h3 {
    text-align: center;
  }

  .meeting-actions {
    justify-content: center;
  }

  .meeting-footer {
    flex-direction: column;
  }

  .filters {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .form-actions {
    flex-direction: column;
  }

  .modal-content {
    padding: 24px;
    margin: 20px;
  }
}

@media (max-width: 480px) {
  .video-meetings {
    padding: 12px;
  }

  .meeting-card {
    padding: 16px;
  }

  .meeting-header h3 {
    font-size: 1.2em;
  }

  .details p {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .details strong {
    min-width: auto;
    margin-right: 0;
  }
}
</style>