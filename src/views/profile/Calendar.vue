<template>
  <div class="calendar-container">
    <h2>Мой календарь</h2>

    <div class="calendar-header">
      <button @click="prevMonth" class="nav-btn">&lt;</button>
      <h3>{{ currentMonthName }} {{ currentYear }}</h3>
      <button @click="nextMonth" class="nav-btn">&gt;</button>
    </div>

    <div class="calendar-grid">
      <div class="day-header" v-for="day in dayNames" :key="day">
        {{ day }}
      </div>

      <div v-for="day in calendarDays" :key="day.date"
           :class="['day-cell', {
             'current-month': day.isCurrentMonth,
             'today': day.isToday,
             'has-tasks': day.hasTasks
           }]"
           @click="viewDayTasks(day.date)">
        <div class="day-number">{{ day.dayNumber }}</div>
        <div v-if="day.hasTasks" class="task-indicator"></div>
      </div>
    </div>

    <div v-if="selectedDate" class="day-tasks">
      <h3>Задачи на {{ formatSelectedDate }}</h3>
      <div v-if="tasksForSelectedDate.length > 0" class="tasks-list">
        <div v-for="task in tasksForSelectedDate" :key="task.id" class="task-item">
          <h4>{{ task.title }}</h4>
          <p class="deadline">До: {{ formatDateTime(task.deadline) }}</p>
          <p class="priority">Приоритет: {{ getPriorityText(task.priority) }}</p>
          <p class="status" :class="'status-' + task.userStatus.toLowerCase()">
            {{ getStatusText(task.userStatus) }}
          </p>
        </div>
      </div>
      <div v-else class="no-tasks">
        Нет задач на выбранную дату
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import api from "@/api/index.js";

export default {
  name: 'Calendar',
  setup() {
    const currentDate = ref(new Date());
    const selectedDate = ref(null);
    const tasks = ref([]);
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem('jwt-token');
        const response = await api.getMyTasks();
        tasks.value = response.data;
      } catch (error) {
        console.error('Ошибка при получении задач:', error);
      }
    };

    onMounted(() => {
      fetchTasks();
      // Устанавливаем текущую дату в формате YYYY-MM-DD
      selectedDate.value = formatDateToISO(new Date());
    });

    const formatDateToISO = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const currentYear = computed(() => {
      return currentDate.value.getFullYear();
    });

    const currentMonth = computed(() => {
      return currentDate.value.getMonth();
    });

    const currentMonthName = computed(() => {
      const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
      ];
      return months[currentMonth.value];
    });

    const daysInMonth = computed(() => {
      return new Date(currentYear.value, currentMonth.value + 1, 0).getDate();
    });

    const firstDayOfMonth = computed(() => {
      // Возвращаем день недели (0-6), где 0 - воскресенье
      return new Date(currentYear.value, currentMonth.value, 1).getDay();
    });

    const calendarDays = computed(() => {
      const days = [];
      const today = new Date();
      const todayStr = formatDateToISO(today);

      // Корректировка для первого дня месяца (Пн = 1, Вс = 0)
      let startDay = firstDayOfMonth.value === 0 ? 6 : firstDayOfMonth.value - 1;

      // Добавляем дни предыдущего месяца
      const prevMonth = new Date(currentYear.value, currentMonth.value - 1, 1);
      const daysInPrevMonth = new Date(
          prevMonth.getFullYear(),
          prevMonth.getMonth() + 1,
          0
      ).getDate();

      for (let i = startDay; i > 0; i--) {
        const day = daysInPrevMonth - i + 1;
        const date = new Date(
            prevMonth.getFullYear(),
            prevMonth.getMonth(),
            day
        );
        const dateStr = formatDateToISO(date);

        days.push({
          dayNumber: day,
          date: dateStr,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
          hasTasks: hasTasksForDate(dateStr)
        });
      }

      // Добавляем дни текущего месяца
      for (let i = 1; i <= daysInMonth.value; i++) {
        const date = new Date(
            currentYear.value,
            currentMonth.value,
            i
        );
        const dateStr = formatDateToISO(date);

        days.push({
          dayNumber: i,
          date: dateStr,
          isCurrentMonth: true,
          isToday: dateStr === todayStr,
          hasTasks: hasTasksForDate(dateStr)
        });
      }

      // Добавляем дни следующего месяца, чтобы заполнить календарь
      const totalCells = 42; // 6 недель * 7 дней
      const nextMonthDays = totalCells - days.length;
      const nextMonth = new Date(currentYear.value, currentMonth.value + 1, 1);

      for (let i = 1; i <= nextMonthDays; i++) {
        const date = new Date(
            nextMonth.getFullYear(),
            nextMonth.getMonth(),
            i
        );
        const dateStr = formatDateToISO(date);

        days.push({
          dayNumber: i,
          date: dateStr,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
          hasTasks: hasTasksForDate(dateStr)
        });
      }

      return days;
    });

    const hasTasksForDate = (date) => {
      return tasks.value.some(task => {
        if (!task.deadline) return false;
        const taskDate = task.deadline.split('T')[0];
        return taskDate === date;
      });
    };

    const tasksForSelectedDate = computed(() => {
      if (!selectedDate.value) return [];
      return tasks.value.filter(task => {
        if (!task.deadline) return false;
        const taskDate = task.deadline.split('T')[0];
        return taskDate === selectedDate.value;
      });
    });

    const formatSelectedDate = computed(() => {
      if (!selectedDate.value) return '';
      const date = new Date(selectedDate.value);
      return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    });

    const formatDateTime = (datetime) => {
      if (!datetime) return '';
      const date = new Date(datetime);
      return date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
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

    const prevMonth = () => {
      currentDate.value = new Date(
          currentYear.value,
          currentMonth.value - 1,
          1
      );
    };

    const nextMonth = () => {
      currentDate.value = new Date(
          currentYear.value,
          currentMonth.value + 1,
          1
      );
    };

    const viewDayTasks = (date) => {
      selectedDate.value = date;
    };

    return {
      currentDate,
      selectedDate,
      dayNames,
      currentYear,
      currentMonthName,
      calendarDays,
      tasksForSelectedDate,
      formatSelectedDate,
      formatDateTime,
      getStatusText,
      getPriorityText,
      prevMonth,
      nextMonth,
      viewDayTasks
    };
  }
};
</script>

<style scoped>
.calendar-container {
  margin: 0;
}

.calendar-header {
  display: flex;
  justify-content: center;
  align-items: center;

}

.nav-btn {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  padding: 0 15px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.day-header {
  text-align: center;
  font-weight: bold;
  padding: 10px;
  background: #f0f0f0;
}

.day-cell {
  height: 80px;
  border: 1px solid #ddd;
  padding: 5px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.day-cell.current-month {
  background: white;
}

.day-cell:not(.current-month) {
  background: #f9f9f9;
  color: #aaa;
}

.day-cell.today {
  border: 2px solid #4CAF50;
}

.day-cell.has-tasks {
  background: #e6f7ff;
}

.day-number {
  align-self: flex-end;
}

.task-indicator {
  width: 8px;
  height: 8px;
  background-color: #ff0606;
  border-radius: 50%;
  margin-top: auto;
  align-self: center;
}

.day-tasks {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tasks-list {
  margin-top: 15px;
}

.task-item {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.task-item:last-child {
  border-bottom: none;
}

.task-item h4 {
  margin: 0 0 5px 0;
}

.deadline, .priority {
  margin: 5px 0;
  color: #666;
  font-size: 0.9em;
}

.status {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.9em;
}
.status-overdue {
  background-color: #f8d7da;
  color: #721c24;
}
.status-not_started {
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

.no-tasks {
  text-align: center;
  padding: 20px;
  color: #666;
}
</style>