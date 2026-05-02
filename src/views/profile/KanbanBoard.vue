<template>
  <div class="kanban-container">
    <!-- Тосты -->
    <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
      <span>{{ toast.message }}</span>
      <button @click="hideToast" class="toast-close">×</button>
    </div>

    <!-- Заголовок и панель инструментов -->
    <div class="kanban-header">
      <h2>Канбан-доска</h2>
      <div v-if="isStudent" class="kanban-tools">
        <div class="tool-group">
          <label>Максимум задач в день:</label>
          <select v-model.number="dailyLimit" class="tool-select">
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
            <option :value="5">5</option>
            <option :value="99">Без лимита</option>
          </select>
        </div>
        <div class="tool-group">
          <label>Запас дней перед дедлайном:</label>
          <select v-model.number="bufferDays" class="tool-select">
            <option :value="0">Без запаса</option>
            <option :value="1">1 день</option>
            <option :value="2">2 дня</option>
          </select>
        </div>
        <button @click="openOptimization" class="optimize-btn" :disabled="loading">
          🎯 Оптимизировать
        </button>
        <button @click="openWhatIf" class="tool-btn what-if-btn" :disabled="loading">
          🔬 What-if
        </button>
        <button @click="openWeeklyPlan" class="tool-btn weekly-btn" :disabled="loading">
          📅 План на неделю
        </button>
      </div>
      <div v-else class="teacher-hint">
        <span>📅 Обзор дедлайнов студентов и встреч</span>
      </div>
    </div>

    <!-- Доска -->
    <div v-if="loading" class="loading">Загрузка доски...</div>
    <div v-else class="kanban-board">
      <div class="kanban-week" v-for="(week, weekIndex) in weeks" :key="weekIndex">
        <div
            v-for="day in week"
            :key="day.date"
            :class="['kanban-day', {
            'today': isToday(day.date),
            'past': isPast(day.date),
            'drag-over': isStudent && dragOverDate === day.date
          }]"
            @dragover.prevent="isStudent && onDragOver(day.date)"
            @dragleave="isStudent && onDragLeave"
            @drop.prevent="isStudent && onDrop(day.date)"
        >
          <div class="day-header">
            <span class="day-name">{{ formatDayName(day.date) }}</span>
            <span class="day-date">{{ formatDayDate(day.date) }}</span>
            <span class="day-count">{{ day.items.length }}</span>
          </div>
          <div class="day-items">
            <div
                v-for="card in day.items"
                :key="card.id"
                :class="getCardClass(card)"
                :draggable="isStudent && !card.isFixed"
                @dragstart="isStudent && onDragStart(card, $event)"
                @dragend="isStudent && onDragEnd"
                @click="onCardClick(card)"
            >
              <div v-if="card.itemType === 'TASK' && card.priority"
                   :class="['priority-strip', card.priority.toLowerCase()]"></div>
              <div class="card-icon">
                <span v-if="card.itemType === 'TASK'"></span>
                <span v-else>📹</span>
              </div>
              <div class="card-body">
                <div class="card-title">{{ card.title }}</div>
                <div class="card-meta">
                  <span v-if="card.itemType === 'TASK' && card.deadline" class="card-deadline">
                    ⏰ {{ formatDeadline(card.deadline) }}
                  </span>
                  <span v-if="card.itemType === 'MEETING' && card.startTime" class="card-time">
                    {{ formatTime(card.startTime) }}
                  </span>
                </div>
              </div>
              <div class="card-badges">
                <span v-if="card.isFixed" title="Фиксированное">🔒</span>
                <span v-if="card.isOptimized && isStudent" title="Оптимизировано">🤖</span>
              </div>
            </div>
            <div v-if="day.items.length === 0" class="empty-day">—</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Рекомендации -->
    <div v-if="isStudent && recommendations.length > 0" class="recommendations">
      <h3>💡 Рекомендации по планированию</h3>
      <div v-for="(rec, i) in recommendations" :key="i" class="rec-item">{{ rec }}</div>
    </div>

    <!-- Коучинг -->
    <div v-if="isStudent && coaching" class="coaching-block">
      <h3>🧠 Персональный коучинг</h3>
      <div class="coaching-stats">
        <div class="coaching-stat">
          <span class="stat-label">Задач за 7 дней</span>
          <span class="stat-value">{{ coaching.completedLast7Days }}</span>
        </div>
        <div class="coaching-stat">
          <span class="stat-label">В среднем в неделю</span>
          <span class="stat-value">{{ formatNumber(coaching.avgCompletedPerWeek) }}</span>
        </div>
        <div class="coaching-stat">
          <span class="stat-label">Просрочек за месяц</span>
          <span class="stat-value" :class="{ 'danger': coaching.overdueLast28Days > 2 }">
            {{ coaching.overdueLast28Days }}
          </span>
        </div>
      </div>
      <div :class="['burnout-badge', coaching.burnoutRisk?.toLowerCase()]">
        {{ burnoutText(coaching.burnoutRisk) }}
      </div>
      <p class="coaching-advice">{{ coaching.advice }}</p>
    </div>

    <!-- Модалка оптимизации -->
    <div v-if="showOptimization" class="modal" @click.self="showOptimization = false">
      <div class="modal-content optimization-modal">
        <span class="close" @click="showOptimization = false">&times;</span>
        <h3>🎯 Предлагаемая оптимизация</h3>
        <div v-if="optimizationLoading" class="loading">Анализируем график...</div>
        <div v-else-if="optimizationResult">
          <div class="optimization-info">
            <p>Алгоритм учитывает: максимум <strong>{{ dailyLimit }}</strong> задач в день,
              запас <strong>{{ bufferDays }}</strong> дн. перед дедлайном.</p>
            <p v-if="optimizationResult.effectiveDailyLimit && optimizationResult.effectiveDailyLimit !== dailyLimit">
              ⚡ Ваша историческая норма: <strong>{{ optimizationResult.effectiveDailyLimit }}</strong> задач/день
            </p>
          </div>
          <div class="suggestions-list">
            <div
                v-for="suggestion in optimizationResult.suggestions"
                :key="suggestion.kanbanTaskId"
                class="suggestion-item"
            >
              <label class="suggestion-label">
                <input type="checkbox" v-model="selectedSuggestions" :value="suggestion" />
                <div class="suggestion-info">
                  <span class="suggestion-move">
                    Перенести с <strong>{{ formatDayDate(suggestion.currentDate) }}</strong>
                    на <strong>{{ formatDayDate(suggestion.suggestedDate) }}</strong>
                  </span>
                  <span class="suggestion-reason">{{ suggestion.reason }}</span>
                  <span v-if="suggestion.riskLevel" :class="['risk-tag', suggestion.riskLevel.toLowerCase()]">
                    {{ suggestion.riskLevel }}
                  </span>
                </div>
              </label>
            </div>
            <div v-if="optimizationResult.suggestions.length === 0" class="no-suggestions">
              График уже оптимален! Отлично планируете 👍
            </div>
          </div>
          <div v-if="optimizationResult.recommendations?.length > 0" class="optimization-recs">
            <h4>📝 Рекомендации:</h4>
            <div v-for="(rec, i) in optimizationResult.recommendations" :key="i" class="opt-rec-item">
              {{ rec }}
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showOptimization = false" class="cancel-btn">Отмена</button>
          <button
              @click="applyOptimization"
              class="apply-btn"
              :disabled="selectedSuggestions.length === 0 || applyingOptimization"
          >
            {{ applyingOptimization ? 'Применение...' : 'Применить выбранные' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Модалка What-if -->
    <div v-if="showWhatIf" class="modal" @click.self="showWhatIf = false">
      <div class="modal-content what-if-modal">
        <span class="close" @click="showWhatIf = false">&times;</span>
        <h3>🔬 What-if симуляция</h3>
        <div v-if="whatIfLoading" class="loading">Считаю сценарии...</div>
        <div v-else-if="whatIfResult">
          <div class="best-scenario">
            <h4>✅ Лучший сценарий:</h4>
            <p>Лимит: <strong>{{ whatIfResult.bestScenarioDailyLimit }}</strong> задач/день,
              буфер: <strong>{{ whatIfResult.bestScenarioBufferDays }}</strong> дн.</p>
            <p class="scenario-reason">{{ whatIfResult.bestScenarioReason }}</p>
          </div>
          <div class="scenarios-table">
            <div class="scenario-header">
              <span>Лимит</span><span>Буфер</span><span>Риски</span><span>Перегруз</span><span>Переносов</span>
            </div>
            <div
                v-for="(sc, i) in whatIfResult.scenarios"
                :key="i"
                :class="['scenario-row', {
                'best': sc.effectiveDailyLimit === whatIfResult.bestScenarioDailyLimit
                        && sc.riskTasksCount === whatIfResult.scenarios[0].riskTasksCount
              }]"
            >
              <span>{{ sc.effectiveDailyLimit }}</span>
              <span>{{ sc.effectiveDailyLimit }}</span>
              <span :class="{ 'danger': sc.riskTasksCount > 0 }">{{ sc.riskTasksCount }}</span>
              <span :class="{ 'warning': sc.overloadedDays > 2 }">{{ sc.overloadedDays }}</span>
              <span>{{ sc.suggestions?.length || 0 }}</span>
            </div>
          </div>
          <button @click="applyBestScenario" class="apply-btn" style="margin-top: 15px;">
            Применить лучший сценарий
          </button>
        </div>
        <div class="modal-actions">
          <button @click="showWhatIf = false" class="cancel-btn">Закрыть</button>
        </div>
      </div>
    </div>

    <!-- Модалка Weekly Plan -->
    <div v-if="showWeeklyPlan" class="modal" @click.self="showWeeklyPlan = false">
      <div class="modal-content weekly-modal">
        <span class="close" @click="showWeeklyPlan = false">&times;</span>
        <h3>📅 План на неделю</h3>
        <div v-if="weeklyPlanLoading" class="loading">Формирую план...</div>
        <div v-else-if="weeklyPlan">
          <div class="week-summary">
            <span>Всего задач: <strong>{{ weeklyPlan.totalPlannedTasks }}</strong></span>
            <span>Ваша норма в день: <strong>{{ weeklyPlan.capacityPerDay }}</strong> задач</span>
          </div>
          <div v-for="day in weeklyPlan.days" :key="day.date" :class="['week-day', day.loadLevel.toLowerCase()]">
            <div class="week-day-header">
              <span class="week-day-name">{{ formatDayName(day.date) }}, {{ formatDayDate(day.date) }}</span>
              <span class="week-day-load">{{ day.plannedTasks }}/{{ day.capacity }}</span>
              <span :class="['load-badge', day.loadLevel.toLowerCase()]">{{ loadText(day.loadLevel) }}</span>
            </div>
            <ul class="day-actions">
              <li v-for="(action, i) in day.actions" :key="i">{{ action }}</li>
            </ul>
          </div>
          <div v-if="weeklyPlan.globalActions?.length" class="global-actions">
            <h4>🎯 На неделю:</h4>
            <ul>
              <li v-for="(action, i) in weeklyPlan.globalActions" :key="i">{{ action }}</li>
            </ul>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showWeeklyPlan = false" class="cancel-btn">Закрыть</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { provide, inject } from 'vue'
import api from '@/api/index.js'

export default {
  name: 'KanbanBoard',
  setup() {
    const router = useRouter()
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const isStudent = computed(() => user.role === 'ROLE_STUDENT')

    const board = ref(null)
    const loading = ref(true)
    const draggedCard = ref(null)
    const dragOverDate = ref(null)
    const dailyLimit = ref(4)
    const bufferDays = ref(1)
    const recommendations = ref([])
    const coaching = ref(null)

    const toast = ref({ show: false, message: '', type: 'success' })
    const showToast = (msg, type = 'success') => {
      toast.value = { show: true, message: msg, type }
      setTimeout(() => { toast.value.show = false }, 4000)
    }
    const hideToast = () => { toast.value.show = false }

    // Оптимизация
    const showOptimization = ref(false)
    const optimizationLoading = ref(false)
    const optimizationResult = ref(null)
    const applyingOptimization = ref(false)
    const selectedSuggestions = ref([])

    // What-if
    const showWhatIf = ref(false)
    const whatIfLoading = ref(false)
    const whatIfResult = ref(null)

    // Weekly Plan
    const showWeeklyPlan = ref(false)
    const weeklyPlanLoading = ref(false)
    const weeklyPlan = ref(null)

    const weeks = computed(() => {
      if (!board.value?.days) return []
      return [board.value.days.slice(0, 7), board.value.days.slice(7, 14)]
    })

    const fetchBoard = async () => {
      loading.value = true
      try {
        const today = new Date()
        const start = new Date(today)
        start.setDate(today.getDate())
        const startDate = start.toISOString().split('T')[0]

        const end = new Date(start)
        end.setDate(start.getDate() + 13)
        const endDate = end.toISOString().split('T')[0]

        const response = await api.getKanbanBoard(startDate, endDate)
        board.value = response.data
        await fetchInsights()
      } catch (error) {
        showToast('Не удалось загрузить доску', 'error')
      } finally {
        loading.value = false
      }
    }
    const refreshBoard = () => {
      fetchBoard()
    }
    provide('refreshKanban', refreshBoard)

    const fetchInsights = async () => {
      if (!isStudent.value) return
      try {
        const today = new Date()
        const end = new Date(today)
        end.setDate(end.getDate() + 13)
        const response = await api.getKanbanInsights(
            today.toISOString().split('T')[0],
            end.toISOString().split('T')[0]
        )
        coaching.value = response.data.coaching
        if (response.data.recommendations?.length) {
          recommendations.value = response.data.recommendations
        }
      } catch (e) {
        // не фатально
      }
    }
    const getTodayStr = () => {
      const d = new Date()
      return d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0')
    }

    const isToday = (dateStr) => dateStr === getTodayStr()
    const isPast = (dateStr) => dateStr < getTodayStr()

    const formatDayName = (d) => new Date(d).toLocaleDateString('ru-RU', { weekday: 'short' })
    const formatDayDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    const formatDeadline = (dl) => new Date(dl).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    const formatTime = (t) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    const formatNumber = (num) => num != null ? Number(num).toFixed(1) : '0'

    const daysUntilDeadline = (deadline) => {
      const now = new Date()
      const dl = new Date(deadline)
      return Math.ceil((dl - now) / (1000 * 60 * 60 * 24))
    }

    const getCardClass = (card) => ({
      'kanban-card': true,
      'fixed': card.isFixed,
      'optimized': card.isOptimized && isStudent.value,
      'urgent': isStudent.value && card.itemType === 'TASK' && card.deadline && daysUntilDeadline(card.deadline) <= 2,
      'warning': isStudent.value && card.itemType === 'TASK' && card.deadline && daysUntilDeadline(card.deadline) > 2 && daysUntilDeadline(card.deadline) <= 5,
      'dragging': draggedCard.value?.id === card.id,
      'readonly': !isStudent.value
    })

    const onDragStart = (card, event) => {
      if (!isStudent.value || card.isFixed) return
      draggedCard.value = card
      event.dataTransfer.effectAllowed = 'move'
    }
    const onDragEnd = () => {
      draggedCard.value = null
      dragOverDate.value = null
    }
    const onDragOver = (date) => {
      if (isStudent.value && draggedCard.value) dragOverDate.value = date
    }
    const onDragLeave = () => { dragOverDate.value = null }

    const onDrop = async (targetDate) => {
      if (!isStudent.value || !draggedCard.value) return
      const card = draggedCard.value
      if (isPast(targetDate)) {
        showToast('Нельзя переместить на прошедшую дату', 'error')
        onDragEnd()
        return
      }
      if (card.itemType === 'TASK' && card.deadline) {
        if (targetDate > card.deadline.split('T')[0]) {
          showToast('Нельзя переместить задачу после дедлайна', 'error')
          onDragEnd()
          return
        }
      }
      if (card.isFixed || card.scheduledDate === targetDate) {
        onDragEnd()
        return
      }
      try {
        const dayItems = board.value.days.find(d => d.date === targetDate)?.items || []
        await api.moveKanbanTask(card.id, { scheduledDate: targetDate, position: dayItems.length })
        showToast('Задача перемещена')
        await fetchBoard()
      } catch (error) {
        showToast(error.response?.data?.message || 'Не удалось переместить', 'error')
      } finally {
        onDragEnd()
      }
    }

    const onCardClick = (card) => {
      if (card.itemType === 'TASK') router.push(`/profile/tasks/${card.itemId}`)
    }

    // Оптимизация
    const openOptimization = async () => {
      if (!isStudent.value) return
      showOptimization.value = true
      optimizationLoading.value = true
      optimizationResult.value = null
      selectedSuggestions.value = []
      try {
        const response = await api.optimizeKanban(dailyLimit.value, bufferDays.value)
        optimizationResult.value = response.data
        selectedSuggestions.value = [...response.data.suggestions]
      } catch (error) {
        showToast('Не удалось выполнить оптимизацию', 'error')
        showOptimization.value = false
      } finally {
        optimizationLoading.value = false
      }
    }

    const applyOptimization = async () => {
      if (selectedSuggestions.value.length === 0) return
      applyingOptimization.value = true
      try {
        const items = selectedSuggestions.value.map(s => ({
          kanbanTaskId: s.kanbanTaskId,
          suggestedDate: s.suggestedDate,
          suggestedPosition: s.suggestedPosition
        }))
        await api.applyOptimization(items)
        showToast('Оптимизация применена')
        showOptimization.value = false
        await fetchBoard()
      } catch (error) {
        showToast('Не удалось применить оптимизацию', 'error')
      } finally {
        applyingOptimization.value = false
      }
    }

    // What-if
    const openWhatIf = async () => {
      showWhatIf.value = true
      whatIfLoading.value = true
      whatIfResult.value = null
      try {
        const response = await api.whatIfKanban(2, 5, 1, 2)
        whatIfResult.value = response.data
      } catch (e) {
        showToast('Не удалось выполнить симуляцию', 'error')
        showWhatIf.value = false
      } finally {
        whatIfLoading.value = false
      }
    }

    const applyBestScenario = async () => {
      if (!whatIfResult.value) return
      if (whatIfResult.value.scenarios?.length) {
        const best = whatIfResult.value.scenarios[0]
        if (best.suggestions?.length) {
          selectedSuggestions.value = best.suggestions.map(s => ({
            kanbanTaskId: s.kanbanTaskId,
            suggestedDate: s.suggestedDate,
            suggestedPosition: s.suggestedPosition
          }))
          await applyOptimization()
        }
      }
      dailyLimit.value = whatIfResult.value.bestScenarioDailyLimit
      bufferDays.value = whatIfResult.value.bestScenarioBufferDays
      showWhatIf.value = false
      showToast('Лучший сценарий применён')
    }

    // Weekly Plan
    const openWeeklyPlan = async () => {
      showWeeklyPlan.value = true
      weeklyPlanLoading.value = true
      weeklyPlan.value = null
      try {
        const response = await api.getKanbanWeeklyPlan()
        weeklyPlan.value = response.data
      } catch (e) {
        showToast('Не удалось загрузить план', 'error')
        showWeeklyPlan.value = false
      } finally {
        weeklyPlanLoading.value = false
      }
    }

    const burnoutText = (risk) => {
      const map = { 'HIGH': '⚠️ Высокий риск выгорания', 'MEDIUM': '⚡ Умеренная нагрузка', 'LOW': '✅ Оптимальный темп' }
      return map[risk] || risk || ''
    }

    const loadText = (level) => {
      const map = { 'OVERLOADED': '🔴 Перегруз', 'NORMAL': '🟢 Норма', 'FREE': '⚪ Свободно' }
      return map[level] || level
    }

    onMounted(fetchBoard)

    return {
      board, loading, weeks,
      isStudent,
      draggedCard, dragOverDate,
      dailyLimit, bufferDays,
      recommendations, coaching,
      toast, showToast, hideToast,
      isToday, isPast,
      formatDayName, formatDayDate, formatDeadline, formatTime, formatNumber,
      getCardClass,
      daysUntilDeadline,
      onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
      onCardClick,
      showOptimization, optimizationLoading, optimizationResult,
      applyingOptimization, selectedSuggestions,
      openOptimization, applyOptimization,
      showWhatIf, whatIfLoading, whatIfResult,
      openWhatIf, applyBestScenario,
      showWeeklyPlan, weeklyPlanLoading, weeklyPlan,
      openWeeklyPlan,
      burnoutText, loadText
    }
  }
}
</script>

<style scoped>
.kanban-container {
  padding: 20px;
  color: var(--text-primary);
}

.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}
.kanban-header h2 { margin: 0; font-size: 1.5em; }

.kanban-tools {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.tool-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tool-group label {
  font-size: 0.75em;
  color: var(--text-secondary);
  white-space: nowrap;
}
.tool-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--input-text);
  font-size: 0.85em;
}

.tool-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85em;
  transition: background 0.2s;
  color: white;
}
.optimize-btn {
  padding: 8px 16px;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
  font-size: 0.85em;
}
.optimize-btn:hover:not(:disabled) { background: #138496; }
.optimize-btn:disabled { background: #ccc; cursor: not-allowed; }
.what-if-btn { background: #6f42c1; }
.what-if-btn:hover:not(:disabled) { background: #5a32a3; }
.weekly-btn { background: #20c997; }
.weekly-btn:hover:not(:disabled) { background: #1aa87d; }
.tool-btn:disabled { background: #ccc; cursor: not-allowed; }

.teacher-hint {
  font-size: 0.9em;
  color: var(--text-secondary);
  padding: 10px 15px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.kanban-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.kanban-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.kanban-day {
  min-height: 150px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 8px;
  background: var(--bg-card);
  transition: all 0.2s;
}
.kanban-day.today {
  border: 2px solid #007bff;
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.2);
}
.kanban-day.past {
  background: var(--bg-tertiary);
  opacity: 0.6;
}
.kanban-day.drag-over {
  background: var(--calendar-today);
  border-color: #28a745;
  box-shadow: 0 0 12px rgba(40, 167, 69, 0.3);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color-light);
}
.day-name { font-weight: 600; font-size: 0.85em; }
.day-date { font-size: 0.75em; color: var(--text-secondary); }
.day-count {
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  font-weight: bold;
}

.day-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.empty-day {
  text-align: center;
  color: var(--text-muted);
  padding: 15px 0;
  font-size: 0.9em;
}

.kanban-card {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: grab;
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
  user-select: none;
}
.kanban-card.readonly { cursor: pointer; opacity: 0.85; }
.kanban-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.kanban-card:active { cursor: grabbing; }
.kanban-card.dragging { opacity: 0.4; }
.kanban-card.fixed {
  border-left: 3px solid #6c757d;
  background: var(--bg-tertiary);
  cursor: default;
}
.kanban-card.optimized { border-left: 3px solid #17a2b8; }
.kanban-card.urgent {
  border-left: 3px solid #dc3545;
  background: rgba(220, 53, 69, 0.05);
  animation: urgentPulse 2s infinite;
}
.kanban-card.warning {
  border-left: 3px solid #ffc107;
  background: rgba(255, 193, 7, 0.05);
}

@keyframes urgentPulse {
  0%, 100% { border-left-color: #dc3545; }
  50% { border-left-color: #ff6b6b; }
}

.priority-strip {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
}
.priority-strip.high { background: #dc3545; }
.priority-strip.medium { background: #ffc107; }
.priority-strip.low { background: #28a745; }

.card-icon { font-size: 0.9em; flex-shrink: 0; margin-top: 2px; line-height: 1.2; }
.card-body { flex: 1; min-width: 0; }
.card-title {
  font-size: 0.8em;
  font-weight: 500;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.card-meta {
  font-size: 0.65em;
  color: var(--text-secondary);
  margin-top: 3px;
  line-height: 1.2;
}
.card-badges {
  display: flex;
  gap: 2px;
  font-size: 0.65em;
  flex-shrink: 0;
  margin-top: 1px;
}

.recommendations {
  margin-top: 25px;
  padding: 15px 20px;
  background: var(--bg-card);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}
.recommendations h3 { margin: 0 0 10px 0; font-size: 1em; }
.rec-item {
  padding: 6px 0;
  font-size: 0.9em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color-light);
}
.rec-item:last-child { border-bottom: none; }

/* Коучинг */
.coaching-block {
  margin-top: 20px;
  padding: 18px 22px;
  background: linear-gradient(135deg, #f8f9ff, #e8f0fe);
  border-radius: 12px;
  border: 1px solid #c3d9ff;
}
.coaching-block h3 { margin: 0 0 12px 0; font-size: 1.1em; }
.coaching-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.coaching-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 14px;
  background: white;
  border-radius: 8px;
  min-width: 80px;
}
.stat-label { font-size: 0.7em; color: var(--text-secondary); }
.stat-value { font-size: 1.3em; font-weight: 700; }
.stat-value.danger { color: #dc3545; }

.burnout-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: 600;
  margin-bottom: 10px;
}
.burnout-badge.high { background: #fde8e8; color: #dc3545; }
.burnout-badge.medium { background: #fff3cd; color: #856404; }
.burnout-badge.low { background: #d4edda; color: #155724; }

.coaching-advice {
  font-size: 0.9em;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

/* Модалки */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: var(--bg-card);
  padding: 25px;
  border-radius: 12px;
  width: 620px;
  max-width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}
.what-if-modal { width: 700px; }
.weekly-modal { width: 650px; }
.optimization-modal h3, .what-if-modal h3, .weekly-modal h3 { margin: 0 0 15px 0; }
.close {
  float: right;
  font-size: 1.5em;
  cursor: pointer;
  background: none;
  border: none;
  color: var(--text-secondary);
  line-height: 1;
}

.optimization-info {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 15px;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.suggestions-list { margin-bottom: 15px; }
.suggestion-item { padding: 8px 0; border-bottom: 1px solid var(--border-color-light); }
.suggestion-label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.suggestion-label input[type="checkbox"] { margin-top: 2px; }
.suggestion-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.suggestion-move { font-size: 0.9em; }
.suggestion-reason { font-size: 0.8em; color: var(--text-muted); }
.risk-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.7em;
  font-weight: 600;
  margin-top: 2px;
  align-self: flex-start;
}
.risk-tag.high { background: #fde8e8; color: #dc3545; }
.risk-tag.medium { background: #fff3cd; color: #856404; }
.risk-tag.low { background: #d4edda; color: #155724; }
.no-suggestions { text-align: center; padding: 20px; color: #28a745; font-weight: 500; }

.optimization-recs {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
}
.optimization-recs h4 { margin: 0 0 8px 0; }
.opt-rec-item { font-size: 0.85em; color: var(--text-secondary); padding: 3px 0; }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.cancel-btn {
  padding: 8px 20px;
  background: var(--color-secondary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.apply-btn {
  padding: 8px 20px;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.apply-btn:disabled { background: #ccc; cursor: not-allowed; }

/* What-if */
.best-scenario {
  padding: 12px 16px;
  background: #d4edda;
  border-radius: 8px;
  margin-bottom: 15px;
}
.best-scenario h4 { margin: 0 0 6px 0; color: #155724; }
.best-scenario p { margin: 0; font-size: 0.9em; }
.scenario-reason { color: #6c757d; font-size: 0.85em; margin-top: 4px; }

.scenarios-table { margin-bottom: 15px; }
.scenario-header, .scenario-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  padding: 6px 10px;
  font-size: 0.85em;
}
.scenario-header { font-weight: 600; border-bottom: 2px solid var(--border-color); }
.scenario-row { border-bottom: 1px solid var(--border-color-light); }
.scenario-row.best { background: #d4edda; }
.scenario-row span.danger { color: #dc3545; font-weight: 600; }
.scenario-row span.warning { color: #856404; font-weight: 600; }

/* Weekly Plan */
.week-summary {
  display: flex;
  gap: 30px;
  margin-bottom: 15px;
  font-size: 0.9em;
  color: var(--text-secondary);
}
.week-day {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--border-color-light);
}
.week-day.overloaded { background: rgba(220, 53, 69, 0.05); border-left: 3px solid #dc3545; }
.week-day.normal { background: var(--bg-card); border-left: 3px solid #28a745; }
.week-day.free { background: var(--bg-tertiary); border-left: 3px solid #6c757d; }
.week-day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.week-day-name { font-weight: 600; }
.load-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 600;
}
.load-badge.overloaded { background: #fde8e8; color: #dc3545; }
.load-badge.normal { background: #d4edda; color: #155724; }
.load-badge.free { background: #e2e3e5; color: #383d41; }
.day-actions { margin: 0; padding-left: 18px; font-size: 0.85em; color: var(--text-secondary); }
.day-actions li { margin-bottom: 2px; }
.global-actions {
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.global-actions h4 { margin: 0 0 6px 0; }
.global-actions ul { margin: 0; padding-left: 18px; font-size: 0.9em; }

/* Тосты */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 18px;
  border-radius: 8px;
  color: white;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-lg);
  animation: slideIn 0.3s ease-out;
}
.toast-success { background: #28a745; }
.toast-error { background: #dc3545; }
.toast-close { background: none; border: none; color: white; font-size: 1.2em; cursor: pointer; }
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.loading { text-align: center; padding: 40px; color: var(--text-muted); }

@media (max-width: 1200px) {
  .kanban-week { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 768px) {
  .kanban-week { grid-template-columns: repeat(2, 1fr); }
  .kanban-header { flex-direction: column; }
  .coaching-stats { flex-direction: column; gap: 8px; }
}
</style>