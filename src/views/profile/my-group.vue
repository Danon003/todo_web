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
                {{ getInitials(member.name) }}
              </div>
              <div class="member-info">
                <h4>{{ member.name }}</h4>
                <p>{{ member.email }}</p>
                <span class="role-badge" :class="member.role.toLowerCase()">
                  {{ getRoleText(member.role) }}
                </span>
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

        const groupResponse = await axios.get('http://localhost:8080/user/my-group', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        group.value = groupResponse.data;

        if (group.value) {
          const membersResponse = await axios.get(
              `http://localhost:8080/group/${group.value.id}/students`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
          );
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
        'CURATOR': 'Куратор',
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
}

.header {
  margin-bottom: 30px;
}

.group-info {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.group-info h3 {
  margin: 0 0 5px 0;
  color: #333;
  font-size: 1.3em;
}

.group-info p {
  margin: 0;
  color: #666;
}

.no-group {
  padding: 15px;
  background: #fff3cd;
  border-radius: 8px;
  color: #856404;
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
  color: #666;
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

.section-title {
  font-size: 1.1em;
  font-weight: bold;
  margin-bottom: 15px;
  color: #333;
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
}

.no-members {
  text-align: center;
  padding: 30px;
  color: #666;
  background: #f8f9fa;
  border-radius: 8px;
}

.member-card {
  display: flex;
  align-items: center;
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.member-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
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
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-info p {
  margin: 0 0 5px 0;
  color: #666;
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
  background-color: #D4EDDA;
  color: #155724;
}

.role-teacher {
  background-color: #D1ECF1;
  color: #0C5460;
}

.role-curator {
  background-color: #E2E3E5;
  color: #383D41;
}

.role-admin {
  background-color: #F8D7DA;
  color: #721C24;
}
</style>