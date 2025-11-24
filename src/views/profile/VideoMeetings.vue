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

    <div
        class="filters"
        v-if="!loading && meetings.length > 0"
    >
      <label class="filter-checkbox">
        <input type="checkbox" v-model="hidePastMeetings">
        <span>Скрывать прошедшие встречи</span>
      </label>
      <span v-if="user.role === 'ROLE_ADMIN'" class="admin-hint">
        Админ может удалять прошедшие встречи
      </span>
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
          :class="{
            'meeting-active': isMeetingActive(meeting),
            'meeting-past': hasMeetingEnded(meeting)
          }"
      >
        <div class="meeting-header">
          <h3>{{ meeting.title }}</h3>
          <div class="meeting-actions" v-if="canEditMeeting(meeting) || canDeleteMeeting(meeting)">
            <button
                v-if="canEditMeeting(meeting)"
                @click="openEditModal(meeting)"
                class="action-btn edit"
                title="Редактировать"
            >
              ✏️
            </button>
            <button
                v-if="canDeleteMeeting(meeting)"
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
          <button
              @click="joinMeeting(meeting.id)"
              class="join-btn"
              :disabled="!isMeetingActive(meeting)"
              :title="getJoinTooltip(meeting)"
          >
            {{ isMeetingActive(meeting) ? '🎥 Присоединиться' : hasMeetingEnded(meeting) ? '✔ Встреча завершена' : '⏰ Не началась' }}
          </button>
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
    const showEmbed = ref(false)
    const editingMeeting = ref(null)
    const meetingToDelete = ref(null)
    const currentMeeting = ref(null)
    const saving = ref(false)
    const availableGroups = ref([])
    const embedUrl = ref('')
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
      if (user.role !== 'ROLE_TEACHER') {
        return
      }

      try {
        const response = await api.getGroups()
        availableGroups.value = response.data || []
      } catch (error) {
        console.error('Ошибка при загрузке групп:', error)
      }
    }

    const onIframeLoad = () => {
      console.log('✅ Iframe видеовстречи загружен')
    }

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

    const hasMeetingEnded = (meeting) => {
      if (!meeting.startTime) return false
      const now = new Date()
      if (meeting.endTime) {
        return now > new Date(meeting.endTime)
      }
      return now > new Date(meeting.startTime)
    }

    const hasMeetingStarted = (meeting) => {
      if (!meeting.startTime) return false
      return new Date() >= new Date(meeting.startTime)
    }

    const isMeetingActive = (meeting) => {
      return hasMeetingStarted(meeting) && !hasMeetingEnded(meeting)
    }

    const getStatusText = (meeting) => {
      if (hasMeetingEnded(meeting)) return 'Завершена'
      if (!hasMeetingStarted(meeting)) return 'Не началась'
      return 'Активна'
    }

    const getStatusClass = (meeting) => {
      if (hasMeetingEnded(meeting)) return 'status-ended'
      if (!hasMeetingStarted(meeting)) return 'status-pending'
      return 'status-active'
    }

    const isCurrentUserCreator = (meeting) => {
      if (!currentUserId) return false
      return meeting.createdById === currentUserId
    }

    const canEditMeeting = (meeting) => {
      if (user.role !== 'ROLE_TEACHER') return false
      if (!isCurrentUserCreator(meeting)) return false
      return !hasMeetingEnded(meeting)
    }

    const canDeleteMeeting = (meeting) => {
      if (user.role === 'ROLE_ADMIN') return true
      if (user.role !== 'ROLE_TEACHER') return false
      if (!isCurrentUserCreator(meeting)) return false
      return !hasMeetingEnded(meeting)
    }

    const getJoinTooltip = (meeting) => {
      if (hasMeetingEnded(meeting)) return 'Встреча завершена'
      if (!hasMeetingStarted(meeting)) return 'Встреча ещё не началась'
      return 'Присоединиться к встрече'
    }

    const visibleMeetings = computed(() => {
      const sorted = [...meetings.value].sort((a, b) => {
        return new Date(a.startTime) - new Date(b.startTime)
      })

      return sorted.filter(meeting => {
        if (hidePastMeetings.value && hasMeetingEnded(meeting)) {
          return false
        }
        return true
      })
    })

    onMounted(() => {
      fetchMeetings()
      fetchGroups()
    })

    return {
      user,
      meetings,
      visibleMeetings,
      hidePastMeetings,
      loading,
      showModal,
      showDeleteConfirm,
      showEmbed,
      editingMeeting,
      meetingToDelete,
      currentMeeting,
      saving,
      availableGroups,
      meetingForm,
      embedUrl,
      openCreateModal,
      openEditModal,
      closeModal,
      saveMeeting,
      confirmDelete,
      cancelDelete,
      deleteMeeting,
      joinMeeting,
      onIframeLoad,
      formatDateTime,
      isMeetingActive,
      hasMeetingEnded,
      getStatusText,
      getStatusClass,
      canEditMeeting,
      canDeleteMeeting,
      getJoinTooltip
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
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h1 {
  margin: 0;
  color: #333;
}

.filters {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95em;
  color: #333;
}

.filter-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: #17A2B8;
}

.admin-hint {
  font-size: 0.85em;
  color: #6c757d;
}

.create-btn {
  background: #17A2B8;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.3s;
}

.create-btn:hover {
  background: #138ca1;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-hint {
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
}

/* Embed стили */
.embed-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 95vw;
  height: 85vh;
  background: white;
  border: 2px solid #007bff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.embed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #007bff;
  color: white;
  border-radius: 10px 10px 0 0;
}

.embed-header h3 {
  margin: 0;
  font-size: 1.3em;
}

.embed-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-outline {
  background: transparent;
  border: 1px solid white;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.3s;
}

.btn-outline:hover {
  background: white;
  color: #007bff;
}

.btn-close {
  background: transparent;
  border: none;
  color: white;
  font-size: 1.5em;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: background 0.3s;
}

.btn-close:hover {
  background: rgba(255,255,255,0.2);
}

.embed-content {
  flex: 1;
  border-radius: 0 0 10px 10px;
  overflow: hidden;
  background: #f8f9fa;
}

.jitsi-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.embed-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #666;
}

/* Стили для списка встреч */
.meetings-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
}

.meeting-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border-left: 4px solid #e9ecef;
}

.meeting-past {
  border-left-color: #adb5bd;
  opacity: 0.8;
}

.meeting-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.meeting-active {
  border-left-color: #28a745;
}

.meeting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.meeting-header h3 {
  margin: 0;
  color: #333;
  flex: 1;
  font-size: 1.2em;
  line-height: 1.3;
}

.meeting-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  transform: scale(1.1);
  background: rgba(0,0,0,0.05);
}

.meeting-info {
  margin-bottom: 15px;
}

.description {
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
  font-size: 0.95em;
}

.details {
  font-size: 0.9em;
  color: #555;
}

.details p {
  margin: 6px 0;
  display: flex;
  align-items: center;
}

.details strong {
  min-width: 80px;
  margin-right: 8px;
}

/* Статусы встреч */
.status-active {
  color: #28a745;
  font-weight: 600;
}

.status-pending {
  color: #ffc107;
  font-weight: 600;
}

.status-ended {
  color: #dc3545;
  font-weight: 600;
}

.meeting-footer {
  border-top: 1px solid #eee;
  padding-top: 15px;
  display: flex;
  gap: 10px;
}

.join-btn, .embed-btn {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95em;
  border: none;
  transition: all 0.3s;
  text-align: center;
}

.join-btn {
  background: #28a745;
  color: white;
}

.join-btn:hover:not(:disabled) {
  background: #218838;
  transform: translateY(-1px);
}

.join-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.embed-btn {
  background: #17A2B8;
  color: white;
}

.embed-btn:hover {
  background: #138ca1;
  transform: translateY(-1px);
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
  background: white;
  padding: 30px;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  position: relative;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 1.5em;
  font-weight: 600;
  text-align: center;
  padding-bottom: 15px;
  border-bottom: 2px solid #e9ecef;
}

.close {
  position: absolute;
  top: 15px;
  right: 20px;
  font-size: 28px;
  cursor: pointer;
  color: #888;
  transition: color 0.2s;
  line-height: 1;
}

.close:hover {
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #495057;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1em;
  transition: border-color 0.3s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #17A2B8;
  box-shadow: 0 0 0 3px rgba(23, 162, 184, 0.1);
}

.form-group input:disabled,
.form-group textarea:disabled,
.form-group select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-hint {
  font-size: 0.85em;
  color: #666;
  margin-top: 5px;
  margin-bottom: 0;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 25px;
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
}

.cancel-btn:hover:not(:disabled) {
  background-color: #5a6268;
}

.save-btn {
  background-color: #17A2B8;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.save-btn:hover:not(:disabled) {
  background-color: #138ca1;
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
}

.delete-btn:hover {
  background-color: #c82333;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Адаптивность */
@media (max-width: 768px) {
  .video-meetings {
    padding: 15px;
  }

  .header {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }

  .meetings-list {
    grid-template-columns: 1fr;
  }

  .meeting-footer {
    flex-direction: column;
  }

  .embed-container {
    width: 98vw;
    height: 80vh;
  }

  .embed-header {
    padding: 10px 15px;
  }

  .embed-header h3 {
    font-size: 1.1em;
  }
}
</style>