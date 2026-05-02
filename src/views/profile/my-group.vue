<template>
  <div class="my-group-container">
    <div class="header">
      <h2>Моя группа</h2>
      <div class="group-info" v-if="group">
        <h3>{{ group.name }}</h3>
      </div>
      <div v-else-if="!loading" class="no-group">
        Вы не состоите в группе
      </div>
    </div>

    <div class="members-list">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Загрузка данных...</p>
      </div>

      <template v-else>
        <div v-if="group">
          <div class="section-title">Участники группы ({{ members.length }})</div>
          <div v-if="filteredMembers.length > 0">
            <div
                class="member-card"
                v-for="member in filteredMembers"
                :key="member.id"
            >
              <div class="member-avatar" :style="{ backgroundColor: getAvatarColor(member) }">
                {{ getInitials(member.username) }}
              </div>
              <div class="member-info">
                <h4>{{ member.username }}</h4>
                <p>{{ member.email }}</p>
              </div>
            </div>
          </div>
          <div v-else class="no-members">
            Ничего не найдено
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import api from "@/api/index.js";

export default {
  name: 'MyGroup',
  setup() {
    const group = ref(null);
    const members = ref([]);
    const loading = ref(true);
    const searchQuery = ref('');
    const user = JSON.parse(localStorage.getItem('user') || {});

    const fetchGroupData = async () => {
      try {
        const token = localStorage.getItem('jwt-token');

        const groupResponse = await api.getGroupData();

        group.value = groupResponse.data;

        if (group.value) {
          const membersResponse = await api.getGroupStudents(group.value.id);
          members.value = membersResponse.data;
        }
      } catch (error) {
        console.error('Ошибка при получении данных группы:', error);
      } finally {
        loading.value = false;
      }
    };

    const filteredMembers = computed(() => {
      if (!searchQuery.value) return members.value;

      const query = searchQuery.value.toLowerCase();
      return members.value.filter(member =>
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
      );
    });

    const getInitials = (name) => {
      if (!name) return '';
      const parts = name.split(' ');
      return parts.map(part => part[0]).join('').toUpperCase();
    };

    const getAvatarColor = (member) => {
      const colors = [
        '#4CAF50', '#2196F3', '#9C27B0',
        '#FF9800', '#E91E63', '#009688'
      ];
      return colors[member.id % colors.length];
    };

    const getRoleText = (role) => {
      const roleMap = {
        'STUDENT': 'Студент',
        'TEACHER': 'Преподаватель',
        'ADMIN': 'Администратор'
      };
      return roleMap[role] || role;
    };

    onMounted(() => {
      fetchGroupData();
    });

    return {
      group,
      members,
      loading,
      searchQuery,
      filteredMembers,
      getInitials,
      getAvatarColor,
      getRoleText,
      user
    };
  }
};
</script>

<style scoped>
.my-group-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header {
  margin-bottom: 30px;
}

.group-info {
  margin-top: 15px;
  padding: 15px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
}

.group-info h3 {
  margin: 0 0 5px 0;
  color: var(--text-primary);
  font-size: 1.3em;
}

.group-info p {
  margin: 0;
  color: var(--text-secondary);
}

.no-group {
  padding: 15px;
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
  border-radius: var(--border-radius);
  border: 1px solid var(--color-warning);
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--bg-tertiary);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.section-title {
  font-size: 1.1em;
  font-weight: bold;
  margin-bottom: 15px;
  color: var(--text-primary);
}

.search-box {
  margin-bottom: 15px;
}

.search-box input {
  width: 100%;
  padding: 10px 15px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--input-text);
  border-radius: var(--border-radius);
  font-size: 1em;
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.no-members {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
  background: var(--bg-card);
  border-radius: var(--border-radius);
  border: 1px dashed var(--border-color);
}

.member-card {
  display: flex;
  align-items: center;
  padding: 15px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
}

.member-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  background: var(--bg-hover);
}

.member-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
  flex-shrink: 0;
  font-size: 1.2em;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-info h4 {
  margin: 0 0 5px 0;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-info p {
  margin: 0 0 5px 0;
  color: var(--text-secondary);
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: bold;
}

.role-student {
  background-color: var(--color-success-light);
  color: var(--color-success-dark);
}

.role-teacher {
  background-color: var(--color-info-light);
  color: var(--color-info-dark);
}

.role-curator {
  background-color: var(--color-secondary-light);
  color: var(--color-secondary-dark);
}

.role-admin {
  background-color: var(--color-danger-light);
  color: var(--color-danger-dark);
}
</style>